from fastapi import datastructures
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile
from fertilizer_engine import get_fertilizer_recommendation 
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from database import engine, SessionLocal
from models import Base, User, Prediction, SoilData, Farm, CropRecommendation, FertilizerRecommendation, YieldPrediction
from sqlalchemy.orm import Session
from sqlalchemy.exc import  IntegrityError
from schemas import RegisterRequest, LoginRequest, FarmCreate, FarmResponse, FertilizerRequest, YieldRequest
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta 
from dotenv import load_dotenv
import os
from tensorflow.keras.models import load_model
from tensorflow.keras.applications.efficientnet import preprocess_input
import numpy as np
from PIL import Image
import json
#from paddleocr import PaddleOCR
import pytesseract
import re
import cv2
import joblib
import requests
import logging
import cloudinary
import cloudinary.uploader
import io
from yield_engine import predict_yield
from typing import List, Union, Optional

#Additional features import
from mandi_engine import fetch_mandi_prices
from scheme_engine import check_scheme_eligibility
from irrigation_engine import get_irrigation_advisory
from calendar_engine import get_crop_calendar

#Research Imports
from soil_branch import run_soil_branch
from fusion_engine import run_fusion
from schemas import SoilBranchRequest, FusionRequest

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


#Weather Cache
weather_cache = {}

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

app =  FastAPI()
from fastapi.responses import JSONResponse
from fastapi.requests import Request

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print("ERROR:", str(exc))
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)}
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


#dot-env Data here
load_dotenv()
print("API KEY:", os.getenv("DATAGOVIN_API_KEY"))
cloudinary.config(
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key    = os.getenv("CLOUDINARY_API_KEY"),
    api_secret = os.getenv("CLOUDINARY_API_SECRET")
)
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))
#OAuth2 Schema
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

#Disease Severity Function
def calculate_entropy(probs):
    return -np.sum(probs * np.log(probs + 1e-10))

def get_severity(probs):
    confidence = np.max(probs)

    # When called with a single probability (e.g. from history fallback),
    # log(1) = 0 which causes division by zero. Fall back to confidence only.
    if len(probs) <= 1:
        if confidence >= 0.7:
            return "High"
        elif confidence >= 0.4:
            return "Medium"
        else:
            return "Low"

    entropy = calculate_entropy(probs)
    max_entropy = np.log(len(probs))
    norm_entropy = entropy / max_entropy if max_entropy > 0 else 0
    severity_score = confidence * (1 - norm_entropy)

    if severity_score < 0.4:
        return "Low"
    elif severity_score < 0.7:
        return "Medium"
    else:
        return "High"

def upload_to_cloudinary(file_bytes: bytes, prediction_id: int, db: Session):
    try:
        upload_result = cloudinary.uploader.upload(
            io.BytesIO(file_bytes),
            folder="leaf_uploads",
            resource_type="image"
        )
        image_url = upload_result["secure_url"]
        
        # Update the DB row after upload completes
        db.query(Prediction).filter(Prediction.id == prediction_id).update(
            {"image_url": image_url}
        )
        db.commit()
    except Exception as e:
        logger.error(f"Cloudinary upload failed: {str(e)}")

#Creating Tables
Base.metadata.create_all(bind=engine)
 
#Hashing Password 
pwd_context = CryptContext(schemes=["bcrypt_sha256"], deprecated="auto")
#Verifying the password 
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

#Helper Functions
def hash_password(password: str):
    return pwd_context.hash(password.strip())

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

#Loading the keras model and classes
MODEL_PATH = "six-crop-model.keras"
#model = load_model(MODEL_PATH, compile=False) keras dont need this
model = load_model(
    MODEL_PATH,
    custom_objects={"preprocess_input": preprocess_input}
)
print("Model loaded successfully.")
with open("six-crop-classes.json", "r") as f:
    class_names = json.load(f)
with open("disease_info.json", "r") as f:
    disease_info = json.load(f)

print("Disease info loaded successfully")    

print("Class names loaded successfully")

#OCR Extraction
# ocr = PaddleOCR(
#     use_angle_cls=True,
#     lang='en' 
# )

print("PaddleOCR initialized successfully")
 
# Load once (at startup)
crop_model = joblib.load("crop_model.pkl")
scaler = joblib.load("scaler.pkl")
le = joblib.load("label_encoder.pkl")

# reverse mapping
#crop_map = {v: k for k, v in crop_dict.items()} 

def get_season_months(season):
    if season == "Kharif":
        return [6, 7, 8, 9]
    elif season == "Rabi":
        return [10, 11, 12, 1, 2]
    elif season == "Zaid":
        return [3, 4, 5]
    else:
        return []
    
def fetch_weather(lat, lon, season):
    cache_key = f"{lat}_{lon}_{season}"

    # ✅ return from cache
    if cache_key in weather_cache:
        return weather_cache[cache_key]

    months = get_season_months(season)

    url = "https://power.larc.nasa.gov/api/temporal/daily/point"

    params = {
        "parameters": "T2M,RH2M,PRECTOTCORR",
        "community": "AG",
        "longitude": lon,
        "latitude": lat,
        "start": "20100101",
        "end": "20201231",
        "format": "JSON"
    }

    def safe_avg(arr):
        return sum(arr) / len(arr) if len(arr) > 0 else 0

    try:
        response = requests.get(url, params=params, timeout=5)
        response.raise_for_status()

        data = response.json()["properties"]["parameter"]

        temps, humidity, rainfall = [], [], []

        for date in data["T2M"]:
            month = int(date[4:6])

            if month in months:
                temps.append(data["T2M"][date])
                humidity.append(data["RH2M"][date])

                rain_data = data.get("PRECTOTCORR", {})
                if date in rain_data:
                    rainfall.append(rain_data[date])

        result = {
            "temperature": safe_avg(temps),
            "humidity": safe_avg(humidity),
            "rainfall": safe_avg(rainfall)
        }

        # ✅ store in cache
        weather_cache[cache_key] = result
        return result

    except Exception:
        result = {
            "temperature": 25,
            "humidity": 70,
            "rainfall": 120
        }

        # ✅ store fallback also
        weather_cache[cache_key] = result
        return result
        
def build_features(N, P, K, ph, weather):
    return [
        float(N),
        float(P),
        float(K),
        weather["temperature"],
        weather["humidity"],
        weather["rainfall"],
        float(ph)
    ]

season_crops = {
    "Kharif": ["rice", "maize", "cotton", "jute", "blackgram", "mungbean", "mothbeans", "pigeonpeas", "coconut"],
    "Rabi":   ["chickpea", "lentil", "kidneybeans", "pigeonpeas", "coffee"],
    "Zaid":   ["watermelon", "muskmelon", "mango", "banana", "papaya", "orange", "apple", "grapes", "pomegranate", "coconut"]
}

def get_confidence_level(score):
    if score >= 80:
        return "High"
    elif score >= 50:
        return "Moderate"
    else:
        return "Low"

def get_reason(crop):
    reasons = {
        "rice": "High rainfall and humidity are ideal for rice",
        "maize": "Balanced nutrients and warm temperature support maize",
        "cotton": "Warm climate and moderate rainfall suit cotton",
        "chickpea": "Low rainfall and cool climate favor chickpea",
        "watermelon": "Warm temperature and moderate water suit watermelon"
    }
    return reasons.get(crop, "Suitable based on soil and climate conditions")

def get_top_crops(features, season):
    features = np.array(features, dtype=np.float64).reshape(1, -1)

    # ✅ APPLY LOG TRANSFORM (MUST MATCH TRAINING)
    
    features[:, 0:3] = np.log1p(features[:, 0:3])

    # Scale
    scaled = scaler.transform(features)

    # Predict probabilities
    probs = crop_model.predict_proba(scaled)[0]
    print("ALL CLASSES IN MODEL:", le.classes_)  # ← add this
    print("SEASON FILTER LIST:", season_crops.get(season, []))
    
     # Top 3 filtered by season
    top_indices = probs.argsort()[::-1]  # sort ALL descending, not just top 3

    allowed = [c.lower() for c in season_crops.get(season, [])]

    results = []
    for idx in top_indices:
        crop_name = le.classes_[idx]
        if crop_name.lower() in allowed:   # ← THIS is the missing filter
            results.append({
                "crop": crop_name,
                "confidence": max(0, min(100, round(float(probs[idx] * 100), 2))),
                "confidence_level": get_confidence_level(round(float(probs[idx] * 100), 2)),
                "reason": get_reason(crop_name)
            })
        if len(results) == 3:
            break

    return results

#Geolocation Helper function
def get_lat_lon(location_name: str):
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": location_name,
        "format": "json",
        "limit": 1
    }
    headers = {"User-Agent": "cropcare-app"}

    res = requests.get(url, params=params, headers=headers, timeout=5)

    if res.status_code != 200 or not res.json():
        raise HTTPException(status_code=400, detail="Invalid location")

    data = res.json()[0]
    return float(data["lat"]), float(data["lon"])

def safe_float(value, field_name):
    if value is None:
        return None

    try:
        # Convert to string first
        value = str(value).strip().lower()

        # Remove common unwanted text
        value = value.replace("kg/ha", "").replace("kg", "").strip()

        # Handle empty or invalid
        if value == "" or value == "na" or value == "n/a":
            raise ValueError

        return float(value)

    except:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid value for {field_name}: {value}"
        )
#-------------------STARTING IF ENDPOINTS---------------------
#Health check 
@app.get("/health")
def health():
    return {"status" : "ok"}

#Database Depenency
def get_db():
    db = SessionLocal()
    try: 
        yield db
    finally:
        db.close()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")

        if email is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()

    if user is None:
        raise credentials_exception

    return user

#User Protected Route
@app.get("/users/me")
def read_users_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email
    }
        

#User Registration
@app.post("/register")
def register(user: RegisterRequest, db: Session = Depends(get_db)):
    print("New Register Hit")
    #Cofirm passwords match
    if user.password != user.confirm_password:
        raise HTTPException(
            status_code=400,
            detail="Passwords do not match"
        )
    # Check duplicate email
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    if len(user.password) > 72:
        raise HTTPException(
            status_code=400,
            detail="Password must be 72 characters or less"
        )
    new_user = User(name=user.name, email=user.email, password=hash_password(user.password))

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message" : "User registered successfully.",
        "user_id" : new_user.id
    }     

#JWT Token Creation Function
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

#Login API
@app.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.email})

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


#Image Module
def preprocess_image(image):
    img = Image.open(image).convert("RGB")
    img = img.resize((128, 128))   # match training

    img_array = np.array(img)
    img_array = preprocess_input(img_array)  #Same Preprocessing as input

    img_array = np.expand_dims(img_array, axis=0)
    return img_array

#Prediction  Endpoint 
@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    #Validating file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only image files allowed."
        )

    try:
        #Preprocess Image
        file_bytes = await file.read()

        upload_result = cloudinary.uploader.upload(
            io.BytesIO(file_bytes),
            folder="leaf_uploads",
            resource_type="image"
        )
        image_url = upload_result["secure_url"]

        image = preprocess_image(io.BytesIO(file_bytes))

        #Model Prediction
        predictions = model.predict(image)[0]
        predicted_class = int(np.argmax(predictions))
        confidence = float(np.max(predictions))
        
        disease_name = class_names[predicted_class]
        if "healthy" in disease_name.lower():
            severity = "Low"
        else:
            severity = get_severity(predictions)
        
        
        info = disease_info.get(disease_name, {})
        if "healthy" in disease_name.lower():
            info = {
                "cause": "No disease detected",
                "symptoms": "Plant is healthy",
                "treatment": "No action required"
            }
        image_name = file.filename

        #Storing in the database
        new_prediction = Prediction(
            user_id=current_user.id,
            disease=disease_name,
            confidence=confidence,
            image_url=image_url,
            image_name=image_name
        )

        db.add(new_prediction)
        db.commit()
        db.refresh(new_prediction)

        #Response
        return {
            "prediction_id": new_prediction.id,
            "disease": disease_name,
            "confidence": round(confidence, 4),
            "severity": severity,
            "cause": info.get("cause", "N/A"),
            "symptoms": info.get("symptoms", "N/A"),
            "treatment": info.get("treatment", "N/A") 
            #"image_name": file.filename,
            #"timestamp": new_prediction.created_at
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Prediction failed: {str(e)}"
        )

#Prediction History
@app.get("/prediction-history")
def get_prediction_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    predictions = db.query(Prediction).filter(
        Prediction.user_id == current_user.id
    ).order_by(Prediction.created_at.desc()).all()

    if not predictions:
        return []

    return [
        {
            "id": p.id,
            "disease": p.disease,
            "confidence": p.confidence,
            "image_url": p.image_url,
            #"image": p.image_name,
            "date": p.created_at,
            "severity": get_severity([p.confidence])  # fallback approx
        }
        for p in predictions
    ]
@app.post("/farms", response_model=FarmResponse)
def add_farm(
    farm: FarmCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Case 1 → location only
    if farm.location_name and (farm.latitude is None and farm.longitude is None or farm.latitude == 0 or farm.longitude == 0):
        lat, lon = get_lat_lon(farm.location_name)

    # Case 2 → coordinates only
    elif farm.latitude is not None and farm.longitude is not None:
        lat = float(farm.latitude)
        lon = float(farm.longitude)

    # Invalid
    else:
        raise HTTPException(
            status_code=400,
            detail="Provide either location_name OR latitude & longitude"
        )

    new_farm = Farm(
        user_id=current_user.id,
        farm_name=farm.farm_name,
        location_name=farm.location_name,
        latitude=lat,
        longitude=lon,
        area_hectares=farm.area_hectares
    )

    db.add(new_farm)
    db.commit()
    db.refresh(new_farm)

    return new_farm
 
# ── GET /farms ────────────────────────────────────────────────
@app.get("/farms")
def get_farms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    farms = db.query(Farm).filter(
        Farm.user_id == current_user.id
    ).order_by(Farm.created_at.desc()).all()
    
    if not farms:
        return {
            "message" :  "No farms added yet" 
        }
    return {
        "data" : farms
    }

 
 
# ── DELETE /farms/{farm_id} ───────────────────────────────────
@app.delete("/farms/{farm_id}")
def delete_farm(
    farm_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    farm = db.query(Farm).filter(
        Farm.farm_name == farm_name,
        Farm.user_id == current_user.id     # ensure farmer owns this farm
    ).first()
 
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
 
    db.delete(farm)
    db.commit()
    return {"message": "Farm deleted successfully"}



#--------CROP RECOMMENDATION----------------    
#SHC-OCR Extraction
@app.post("/extract_shc")
def extract_shc(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Validating the  image type first
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only image files allowed."
        )

    try:
        #Image Reading
        contents = file.file.read()

        np_arr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(
                status_code=400,
                detail="Invalid image file"
            )

        #Preprocessing
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Resize (improves OCR accuracy)
        gray = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)

        # Remove noise
        gray = cv2.medianBlur(gray, 3) 

        # Adaptive threshold
        thresh = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            11,
            2
        )

        #OCR
        text = pytesseract.image_to_string(thresh, config="--psm 6")
        #print("RAW OCR TEXT:", text)
        if not text.strip():
            raise HTTPException(
                status_code=400,
                detail="No readable text found. Please upload a valid Soil Health Card."
        )
        clean_text = text.replace("\n", " ").replace("|", " ")
        print("RAW OCR TEXT:", clean_text)
        if not any(keyword in clean_text.lower() for keyword in ["ph", "nitrogen", "phosphorus", "potassium"]):
            raise HTTPException(
                status_code=400,
                detail="Uploaded image is not a Soil Health Card"
            )
        #Structured Extraction
        data = {}

        # pH extraction
        ph_match = re.search(r"pH\s*[:\-]?\s*(\d+\.?\d*)", clean_text, re.IGNORECASE)
        if ph_match:
            ph_value = ph_match.group(1)

            # Fix OCR decimal issue (e.g., 653 → 6.53)
            if "." not in ph_value and len(ph_value) == 3:
                ph_value = ph_value[0] + "." + ph_value[1:]

            data["pH"] = ph_value

        # Nitrogen extraction
        n_match = re.search(
            r"Nitrogen.*?(\d+\.?\d*)",
            clean_text,
            re.IGNORECASE
        )
        if n_match:
            data["Nitrogen"] = n_match.group(1)

        # Phosphorus extraction
        p_match = re.search(
            r"Phosphorus.*?(\d+\.?\d*)",
            clean_text,
            re.IGNORECASE
        )
        if p_match:
            p_value = p_match.group(1)

            # Fix decimal (963 → 9.63)
            if "." not in p_value and float(p_value) > 50:
                p_value = p_value[:-2] + "." + p_value[-2:]

            data["Phosphorus"] = p_value

        # Potassium extraction
        k_match = re.search(
            r"Potassium\s*\(K\)?.*?(\d+\.?\d*)",
            clean_text,
            re.IGNORECASE
        )
        if k_match:
            k_value = k_match.group(1)

            if "." not in k_value and float(k_value) > 500:
                k_value = k_value[:-2] + "." + k_value[-2:]

            data["Potassium"] = k_value
        if not any([
            data.get("pH"),
            data.get("Nitrogen"),
            data.get("Phosphorus"),
            data.get("Potassium")
        ]):
            raise HTTPException(
                status_code=400,
                detail="Invalid Soil Health Card. Required values not detected."
            )
        
        # Organic Carbon extraction
        oc_match = re.search(
            r"Organic\s+Carbon\s*(?:\(OC\))?\s*[:\-]?\s*(\d+\.?\d*)",
            clean_text, re.IGNORECASE
        )
        if oc_match:
            data["OrganicCarbon"] = oc_match.group(1)

        # Zinc — handles OCR misreads: "Zine" for "Zinc", "S32" for "5.32"
        zn_raw_match = re.search(
            r"Zin[ce]\s*(?:\(Zn\))?\s*[:\-]?\s*([S5]?\d+\.?\d*)",
            clean_text, re.IGNORECASE
        )
        if zn_raw_match:
            zn_raw = zn_raw_match.group(1)
            # Replace leading S with 5 (OCR misread)
            zn_raw = zn_raw.lstrip("S").lstrip("s")
            # If no decimal and 2 digits (e.g. "32"), prepend "5."
            if "." not in zn_raw and len(zn_raw) <= 2:
                zn_raw = "5." + zn_raw
            data["Zinc"] = zn_raw

        # Sulphur extraction
        s_match = re.search(
            r"Sul(?:ph|f)ur\.?\s*(?:\(S\))?\s*[:\-]?\s*(\d+\.?\d*)",
            clean_text, re.IGNORECASE
        )
        if s_match:
            data["Sulphur"] = s_match.group(1)


        #Storing in database
        new_soil_entry = SoilData(
            user_id=current_user.id,
            ph=data.get("pH"),
            nitrogen=data.get("Nitrogen"),
            phosphorus=data.get("Phosphorus"),
            potassium=data.get("Potassium"),
            organic_carbon=data.get("OrganicCarbon"),   
            zinc=data.get("Zinc"),                       
            sulphur=data.get("Sulphur"),                 
            entry_method="ocr"                           
        )

        db.add(new_soil_entry)
        db.commit()
        db.refresh(new_soil_entry)

        #Response
        return {
            "pH": data.get("pH"),
            "Nitrogen": data.get("Nitrogen"),
            "Phosphorus": data.get("Phosphorus"),
            "Potassium": data.get("Potassium"),
            "OrganicCarbon": data.get("OrganicCarbon"),
            "Zinc": data.get("Zinc"),
            "Sulphur": data.get("Sulphur"),
            "entry_method": "ocr"
        }
    except HTTPException as e:
        raise e
    
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"OCR processing failed: {str(e)}"
        )
 
#SHC History
@app.get("/soil-history")
def get_soil_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    records = db.query(SoilData).filter(
        SoilData.user_id == current_user.id
    ).order_by(SoilData.timestamp.desc()).all()

    if not records:
        return []

    return [
        {
            "id": r.id,
            "pH": r.ph,
            "Nitrogen": r.nitrogen,
            "Phosphorus": r.phosphorus,
            "Potassium": r.potassium,
            "timestamp": r.timestamp,
            "OrganicCarbon": r.organic_carbon,   
            "Zinc": r.zinc,                      
            "Sulphur": r.sulphur,                 
            "timestamp": r.timestamp
        }
        for r in records
    ]

@app.post("/recommend-crop")
def recommend_crop(
    farm_id: int,                                
    season: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    season = season.capitalize()
    if season not in ["Kharif", "Rabi", "Zaid"]:
        raise HTTPException(status_code=400, detail="Invalid season")
 
    # 1. Get farm and extract coordinates
    farm = db.query(Farm).filter(
        Farm.id == farm_id,
        Farm.user_id == current_user.id
    ).first()
 
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
 
    lat = farm.latitude
    lon = farm.longitude
 
    # 2. Get latest soil data
    soil = db.query(SoilData).filter(
        SoilData.user_id == current_user.id
    ).order_by(SoilData.timestamp.desc()).first()
 
    if not soil:
        raise HTTPException(status_code=404, detail="No soil data found")
 
    if not soil.nitrogen or not soil.phosphorus or not soil.potassium or not soil.ph:
        raise HTTPException(status_code=400, detail="Incomplete soil data")
 
    if not (0 < float(soil.ph) <= 14):
        raise HTTPException(status_code=400, detail="Invalid pH value")
 
    N = float(soil.nitrogen)
    P = float(soil.phosphorus)
    K = float(soil.potassium)
    ph = float(soil.ph)
 
    # 3. Fetch weather using farm coordinates
    weather = fetch_weather(lat, lon, season)
 
    # 4. Build features and get recommendations
    features = build_features(N, P, K, ph, weather)
    recommendations = get_top_crops(features, season)
 
    # SAVE TO DATABASE
    new_recommendation = CropRecommendation(
        user_id=current_user.id,
        farm_id=farm.id,
        season=season,
        recommendations=json.dumps(recommendations)
    )

    db.add(new_recommendation)
    db.commit()
    db.refresh(new_recommendation)

    return {
        "id": new_recommendation.id,
        "farm": farm.farm_name,
        "season": season,
        "weather": weather,
        "recommendations": recommendations
    }

@app.get("/latest-crop-recommendation")
def get_latest_crop_recommendation(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rec = db.query(CropRecommendation).filter(
        CropRecommendation.user_id == current_user.id
    ).order_by(CropRecommendation.created_at.desc()).first()

    if not rec:
        return {
            "message": "No crop recommendation found"
        }

    return {
        "id": rec.id,
        "farm_id": rec.farm_id,
        "season": rec.season,
        "recommendations": json.loads(rec.recommendations),
        "created_at": rec.created_at
    }

@app.post("/recommend-fertilizer")
def recommend_fertilizer(
    request: FertilizerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # -----------------------------
    # 1. Normalize inputs
    # -----------------------------
    crop = request.crop.lower().strip() if request.crop else "default"
    VALID_CROPS = [
    "rice", "wheat", "maize", "barley", "millets", "sorghum",
    "chickpea", "lentil", "kidneybeans", "pigeonpeas", "blackgram",
    "mungbean", "mothbeans", "pulses", "cotton", "sugarcane", "jute",
    "tobacco", "coffee", "oil seeds", "ground nuts", "mango", "banana",
    "papaya", "orange", "apple", "grapes", "pomegranate", "coconut",
    "watermelon", "muskmelon"
    ]
    if crop not in VALID_CROPS:
        # Don't block — just warn the user in the response
        crop_warning = f"'{request.crop}' is not in our crop database. Using default NPK requirements."
    else:
        crop_warning = None

        
    farming_type = request.farming_type.lower().strip()

    if farming_type not in ["chemical", "organic", "traditional"]:
        raise HTTPException(status_code=400, detail="Invalid farming_type")

    # -----------------------------
    # 2. Get soil values
    # -----------------------------
    N = request.nitrogen
    P = request.phosphorous
    K = request.potassium
    ph = request.ph

    # Fallback to SHC if missing
    if any(v is None for v in [N, P, K, ph]):
        soil = db.query(SoilData).filter(
            SoilData.user_id == current_user.id
        ).order_by(SoilData.timestamp.desc()).first()

        # FIXED HERE ✅
        if soil:
            N = N if N is not None else soil.nitrogen
            P = P if P is not None else soil.phosphorus
            K = K if K is not None else soil.potassium
            ph = ph if ph is not None else soil.ph


    # Final validation ✅
    if any(v is None for v in [N, P, K, ph]):
        raise HTTPException(
            status_code=400,
            detail="Incomplete soil data. Provide all values or upload SHC."
        )
    # -----------------------------
    # 3. Safe conversion
    # -----------------------------
    N = safe_float(N, "Nitrogen")
    P = safe_float(P, "Phosphorous")
    K = safe_float(K, "Potassium")
    ph = safe_float(ph, "pH")

    # -----------------------------
    # 4. Validation
    # -----------------------------
    if N < 0 or P < 0 or K < 0:
        raise HTTPException(status_code=400, detail="NPK cannot be negative")

    if not (0 < ph <= 14):
        raise HTTPException(status_code=400, detail="Invalid pH value")

    # -----------------------------
    # 5. Call fertilizer engine
    # -----------------------------
    result = get_fertilizer_recommendation(
        crop=crop,
        N=N,
        P=P,
        K=K,
        ph=ph,
        farming_type=farming_type
    )

    # -----------------------------
    # 6. Save to DB
    # -----------------------------
    new_rec = FertilizerRecommendation(
        user_id=current_user.id,
        crop=crop,
        farming_type=farming_type,
        nitrogen=N,
        phosphorous=P,
        potassium=K,
        ph=ph,
        result=json.dumps(result)
    )

    db.add(new_rec)
    db.commit()
    db.refresh(new_rec)

    # -----------------------------
    # 7. Return response
    # -----------------------------
    return {
        "id": new_rec.id,
        "created_at": new_rec.created_at,
        **result
    }

@app.get("/fertilizer-history")
def get_fertilizer_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    records = db.query(FertilizerRecommendation).filter(
        FertilizerRecommendation.user_id == current_user.id
    ).order_by(FertilizerRecommendation.created_at.desc()).all()

    return [
        {
            "id": r.id,
            "crop": r.crop,
            "farming_type": r.farming_type,
            "result": json.loads(r.result),
            "created_at": r.created_at
        }
        for r in records
    ]

@app.get("/fertilizer-history/latest")
def get_latest_fertilizer(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rec = db.query(FertilizerRecommendation).filter(
        FertilizerRecommendation.user_id == current_user.id
    ).order_by(FertilizerRecommendation.created_at.desc()).first()

    if not rec:
        return {"message": "No fertilizer recommendation found"}

    return {
        "id": rec.id,
        "crop": rec.crop,
        "farming_type": rec.farming_type,
        "result": json.loads(rec.result),
        "created_at": rec.created_at
    }

# ── Soil resolver: manual override → latest SHC from DB ──────────
def resolve_soil(
    user_id: int,
    db: Session,
    N: Optional[float],
    P: Optional[float],
    K: Optional[float],
    ph: Optional[float]
):
    """
    Returns (N, P, K, ph, source) where source is 'manual' or 'soil_health_card'.
    Priority: values provided in the request body → latest SoilData row for the user.
    Raises HTTP 404 if any value is still missing after fallback.
    """
    source = "manual"

    if any(v is None for v in [N, P, K, ph]):
        source = "soil_health_card"
        soil = db.query(SoilData).filter(
            SoilData.user_id == user_id
        ).order_by(SoilData.timestamp.desc()).first()

        if not soil:
            raise HTTPException(
                status_code=404,
                detail="No soil data found. Upload your Soil Health Card first, or provide N, P, K, pH values manually."
            )

        if N  is None: N  = safe_float(soil.nitrogen,   "Nitrogen")
        if P  is None: P  = safe_float(soil.phosphorus,  "Phosphorous")
        if K  is None: K  = safe_float(soil.potassium,   "Potassium")
        if ph is None: ph = safe_float(soil.ph,          "pH")

    # Final None check (covers case where SHC row exists but a field is blank)
    for val, name in [(N, "Nitrogen"), (P, "Phosphorous"), (K, "Potassium"), (ph, "pH")]:
        if val is None:
            raise HTTPException(
                status_code=400,
                detail=f"{name} value is missing from your soil data. Provide it manually or re-upload your SHC."
            )

    if not (0 < ph <= 14):
        raise HTTPException(status_code=400, detail="Invalid pH: must be between 0 and 14.")
    if any(v < 0 for v in [N, P, K]):
        raise HTTPException(status_code=400, detail="N, P, K values cannot be negative.")

    return N, P, K, ph, source


# ── Yield Prediction ──────────────────────────────────────────────
@app.post("/predict-yield")
def predict_crop_yield(request: YieldRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    farming_type = request.farming_type.lower().strip()
    if farming_type not in ["chemical", "organic", "traditional"]:
        raise HTTPException(status_code=400, detail="Invalid farming_type")

    season = request.season.capitalize()
    if season not in ["Kharif", "Rabi", "Zaid"]:
        raise HTTPException(status_code=400, detail="Invalid season")

    N, P, K, ph, soil_source = resolve_soil(
        user_id=current_user.id,
        db=db,
        N=request.nitrogen,
        P=request.phosphorous,
        K=request.potassium,
        ph=request.ph
    )
 
    # ── Resolve farm, weather, and area ──────────────────────────────
    farm = None
    area_acres = None

    if request.farm_id:
        farm = db.query(Farm).filter(Farm.id == request.farm_id, Farm.user_id == current_user.id).first()
        if not farm:
            raise HTTPException(status_code=404, detail="Farm not found")

        # Auto-convert farm's hectares → acres (1 ha = 2.47105 acres)
        if farm.area_hectares and farm.area_hectares > 0:
            area_acres = round(farm.area_hectares * 2.47105, 4)
            logger.info(f"Area resolved from farm #{farm.id}: {farm.area_hectares} ha → {area_acres} acres")
        else:
            logger.warning(f"Farm #{farm.id} has no area_hectares set — total_production will be skipped")

        weather = fetch_weather(farm.latitude, farm.longitude, season)
    else:
        weather = {"temperature": 25.0, "humidity": 70.0, "rainfall": 120.0}

    result = predict_yield(
        crop=request.crop, N=N, P=P, K=K, ph=ph,
        temperature=weather["temperature"], humidity=weather["humidity"], rainfall=weather["rainfall"],
        farming_type=farming_type,
        irrigation_type=request.irrigation_type or "rainfed",
        area_acres=area_acres      # auto-resolved from farm; None if no farm_id or area not set
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    new_yield = YieldPrediction(
        user_id=current_user.id, farm_id=farm.id if farm else None,
        crop=request.crop.lower().strip(), season=season, farming_type=farming_type,
        irrigation_type=request.irrigation_type,
        nitrogen=N, phosphorous=P, potassium=K, ph=ph,
        result=json.dumps(result)
    )
    db.add(new_yield)
    db.commit()
    db.refresh(new_yield)
    return {
        "id": new_yield.id,
        "created_at": new_yield.created_at,
        "soil_source": soil_source,       # "manual" | "soil_health_card"
        "weather_used": weather,
        "area_resolved": {
            "farm_id": farm.id if farm else None,
            "area_hectares": farm.area_hectares if farm else None,
            "area_acres": area_acres
        },
        **result
    }
 
@app.get("/yield-history")
def get_yield_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.query(YieldPrediction).filter(YieldPrediction.user_id == current_user.id).order_by(YieldPrediction.created_at.desc()).all()
    return [{"id": r.id, "crop": r.crop, "season": r.season, "farming_type": r.farming_type, "result": json.loads(r.result), "created_at": r.created_at} for r in records]
 
@app.get("/yield-history/latest")
def get_latest_yield(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rec = db.query(YieldPrediction).filter(YieldPrediction.user_id == current_user.id).order_by(YieldPrediction.created_at.desc()).first()
    if not rec:
        return {"message": "No yield prediction found"}
    return {"id": rec.id, "crop": rec.crop, "season": rec.season, "farming_type": rec.farming_type, "result": json.loads(rec.result), "created_at": rec.created_at}
 
# ── Supported crops for frontend dropdown ─────────────────────────
@app.get("/yield-supported-crops")
def get_yield_supported_crops():
    """Returns the list of crops the yield model supports — use for frontend dropdown."""
    from yield_engine import yield_le
    return {"supported_crops": sorted(list(yield_le.classes_))}


#Additional Endpoint


from pydantic import BaseModel
from typing import Optional

class MandiRequest(BaseModel):
    crop: str
    state: Optional[str] = None
    district: Optional[str] = None
    limit: Optional[int] = 10

class SchemeRequest(BaseModel):
    crop: Optional[str] = None
    land_area_hectares: Optional[float] = None
    state: Optional[str] = None
    irrigation_type: Optional[str] = None
    is_tenant: Optional[bool] = None
    has_land_records: Optional[bool] = True
    family_income_lakh: Optional[float] = None
    is_government_employee: Optional[bool] = False
    is_institutional_farmer: Optional[bool] = False
    has_existing_npa: Optional[bool] = False
    farming_type: Optional[str] = None

class IrrigationRequest(BaseModel):
    crop: str
    soil_type: Optional[str] = "loam"
    irrigation_method: Optional[str] = "furrow"
    days_after_sowing: Optional[int] = None
    farm_id: Optional[int] = None          # pulls weather from farm's lat/lon
    """temperature: Optional[float] = None    # manual override
    humidity: Optional[float] = None
    rainfall_mm_last7days: Optional[float] = None
    area_acres: Optional[float] = None"""

class CalendarRequest(BaseModel):
    state: Optional[str] = None
    zone: Optional[str] = None
    season_filter: Optional[str] = None   # "Kharif" | "Rabi" | "Zaid"


# ════════════════════════════════════════════════════════════════════
#  1. LIVE MANDI PRICES
# ════════════════════════════════════════════════════════════════════

@app.post("/mandi-prices")
def get_mandi_prices(
    request: MandiRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Returns live Agmarknet mandi prices for a crop.
    Falls back to MSP reference prices if data.gov.in API key is not set.

    Set DATAGOVIN_API_KEY in .env for live data.
    Get a free key at https://data.gov.in/
    """
    from mandi_engine import fetch_mandi_prices

    result = fetch_mandi_prices(
        crop=request.crop,
        state=request.state,
        district=request.district,
        limit=request.limit or 10,
    )
    return result


@app.get("/mandi-prices/{crop}")
def get_mandi_prices_get(
    crop: str,
    state: Optional[str] = None,
    district: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """
    GET convenience endpoint: /mandi-prices/rice?state=Punjab&district=Ludhiana
    """
    from mandi_engine import fetch_mandi_prices

    return fetch_mandi_prices(crop=crop, state=state, district=district)


# ════════════════════════════════════════════════════════════════════
#  2. GOVT. SCHEME ELIGIBILITY
# ════════════════════════════════════════════════════════════════════

@app.post("/scheme-eligibility")
def scheme_eligibility(
    request: SchemeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Checks eligibility for major Central Govt agricultural schemes:
    PM-KISAN, PMFBY, KCC, SMAM, PMKSY, NFSM, ATMA.

    Provide as many fields as known — more data = more accurate result.
    All fields are optional.
    """
    from scheme_engine import check_scheme_eligibility

    result = check_scheme_eligibility(
        crop                   = request.crop,
        land_area_hectares     = request.land_area_hectares,
        state                  = request.state,
        irrigation_type        = request.irrigation_type,
        is_tenant              = request.is_tenant,
        has_land_records       = request.has_land_records,
        family_income_lakh     = request.family_income_lakh,
        is_government_employee = request.is_government_employee,
        is_institutional_farmer= request.is_institutional_farmer,
        has_existing_npa       = request.has_existing_npa,
        farming_type           = request.farming_type,
    )
    return result


# ════════════════════════════════════════════════════════════════════
#  3. IRRIGATION ADVISORY
# ════════════════════════════════════════════════════════════════════

@app.post("/irrigation-advisory")
def irrigation_advisory(
    request: IrrigationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns irrigation schedule: daily water need, interval, and volume.

    If farm_id is supplied, live weather (temp/humidity) is fetched from NASA POWER
    for the farm's coordinates and used to adjust water demand.
    """
    if not request.farm_id:
        raise HTTPException(status_code=400, detail="farm_id is required")
    
    from irrigation_engine import get_irrigation_advisory

    temperature  = None
    humidity     = None
    rainfall     = None
    area_acres   = None   # initialized here; assigned from farm below

    # ── Pull weather from farm if farm_id given ───────────────────
    if request.farm_id:
        farm = db.query(Farm).filter(
            Farm.id == request.farm_id,
            Farm.user_id == current_user.id
        ).first()

        if not farm:
            raise HTTPException(status_code=404, detail="Farm not found")

        # Reuse existing fetch_weather helper from main.py
        # Use current season based on today's month
        today = __import__("datetime").date.today()
        month = today.month
        if month in [6, 7, 8, 9]:
            season = "Kharif"
        elif month in [10, 11, 12, 1, 2]:
            season = "Rabi"
        else:
            season = "Zaid"

        weather = fetch_weather(farm.latitude, farm.longitude, season)

        temperature = weather.get("temperature", 30)
        humidity = weather.get("humidity", 60)
        rainfall = weather.get("rainfall", 0)           

        

        if farm.area_hectares:
            area_acres = round(farm.area_hectares * 2.47105, 4) 

    result = get_irrigation_advisory(
        crop                  = request.crop,
        soil_type             = request.soil_type or "loam",
        irrigation_method     = request.irrigation_method or "furrow",
        days_after_sowing     = request.days_after_sowing,
        temperature           = temperature,
        humidity              = humidity,
        rainfall_mm_last7days = rainfall,
        area_acres            = area_acres,
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@app.get("/irrigation-supported-crops")
def irrigation_supported_crops():
    """Lists crops supported by the irrigation advisory engine."""
    from irrigation_engine import CROP_WATER
    return {"supported_crops": sorted(CROP_WATER.keys())}


@app.get("/mandi-supported-crops")
def get_mandi_supported_crops():
    """Lists crops supported by the mandi price engine (for frontend dropdown)."""
    from mandi_engine import CROP_ALIASES
    return {"crops": sorted(CROP_ALIASES.keys())}


# ════════════════════════════════════════════════════════════════════
#  4. SEASONAL CROP CALENDAR
# ════════════════════════════════════════════════════════════════════

@app.post("/crop-calendar")
def crop_calendar(
    request: CalendarRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Returns the seasonal crop calendar for a state/zone with live window status.

    Crops are labelled: SOW NOW / WINDOW CLOSING / Coming up / Off-season.
    Sorted by urgency so the most time-sensitive crops appear first.
    """
    from calendar_engine import get_crop_calendar
    from datetime import date

    result = get_crop_calendar(
        state          = request.state,
        zone           = request.zone,
        current_month  = date.today().month,
        season_filter  = request.season_filter,
    )
    return result


@app.get("/crop-calendar")
def crop_calendar_get(
    state: Optional[str] = None,
    zone: Optional[str] = None,
    season_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """
    GET convenience endpoint: /crop-calendar?state=Maharashtra&season_filter=Kharif
    """
    from calendar_engine import get_crop_calendar
    from datetime import date

    return get_crop_calendar(
        state         = state,
        zone          = zone,
        current_month = date.today().month,
        season_filter = season_filter,
    )


@app.get("/crop-calendar/zones")
def list_zones():
    """Lists all supported agro-climatic zones."""
    from calendar_engine import ZONE_CALENDARS, STATE_ZONE
    return {
        "zones": list(ZONE_CALENDARS.keys()),
        "state_to_zone": STATE_ZONE,
    }

#Research Additionals
@app.post("/soil-branch")
def soil_branch_analysis(
    request: SoilBranchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # If values not provided, pull from latest SoilData in DB
    soil = db.query(SoilData).filter(
        SoilData.user_id == current_user.id
    ).order_by(SoilData.timestamp.desc()).first()

    shc_values = {
        "N":   request.nitrogen       or (float(soil.nitrogen)       if soil and soil.nitrogen       else None),
        "P":   request.phosphorus     or (float(soil.phosphorus)     if soil and soil.phosphorus     else None),
        "K":   request.potassium      or (float(soil.potassium)      if soil and soil.potassium      else None),
        "pH":  request.ph             or (float(soil.ph)             if soil and soil.ph             else None),
        "OC":  request.organic_carbon or (float(soil.organic_carbon) if soil and soil.organic_carbon else None),
        "Zn":  request.zinc           or (float(soil.zinc)           if soil and soil.zinc           else None),
        "S":   request.sulphur        or (float(soil.sulphur)        if soil and soil.sulphur        else None),
    }

    if not any(shc_values.values()):
        raise HTTPException(status_code=400, detail="No soil data available. Upload SHC or provide values.")

    result = run_soil_branch(crop=request.crop, shc_values=shc_values)
    return result


# ════════════════════════════════════════════════════════════════════
#  BRANCH 3 — FUSION ENDPOINT
#  POST /fusion
#
#  Chains:
#    Branch 1 (Image)  → re-runs inference on the stored prediction OR
#                        fetches the latest /predict result for the user
#    Branch 2 (Soil)   → runs run_soil_branch() with SHC values
#    Branch 3 (Fusion) → runs run_fusion() with configurable weights
#
#  Design decisions:
#    - The image branch probabilities are reconstructed from the model
#      using the prediction's stored image_url, OR the endpoint accepts
#      a prediction_id so the caller can re-fuse any past prediction.
#    - Soil values follow the same fallback chain as /soil-branch:
#      request body → latest SoilData row for the user.
#    - No data is written to the DB — this is a research/analysis endpoint.
# ════════════════════════════════════════════════════════════════════

@app.post("/fusion")
async def fusion_analysis(
    file: UploadFile = File(...),
    crop: str = "",
    image_weight: Optional[float] = None,
    soil_weight:  Optional[float] = None,
    nitrogen:       Optional[float] = None,
    phosphorus:     Optional[float] = None,
    potassium:      Optional[float] = None,
    ph:             Optional[float] = None,
    organic_carbon: Optional[float] = None,
    zinc:           Optional[float] = None,
    sulphur:        Optional[float] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Branch 3 — Multimodal Fusion Endpoint.

    Accepts a leaf image upload and optional soil parameter overrides.
    Runs the Image Branch (EfficientNetB0) and Soil Branch (rule system)
    in sequence, then fuses both disease probability vectors using
    weighted late fusion.

    Parameters (multipart/form-data):
        file           : Leaf image file (required)
        crop           : Crop name — must match one of the supported crops
                         (tomato, potato, pepper, apple, grape, corn)
        image_weight   : Fusion weight for Image Branch (default 0.70)
        soil_weight    : Fusion weight for Soil Branch  (default 0.30)
        nitrogen       : N kg/ha  (optional; falls back to latest SHC in DB)
        phosphorus     : P kg/ha  (optional)
        potassium      : K kg/ha  (optional)
        ph             : Soil pH  (optional)
        organic_carbon : OC %     (optional)
        zinc           : Zn ppm   (optional)
        sulphur        : S ppm    (optional)

    Returns:
        Full fusion output from fusion_engine.run_fusion(), including:
        - crop, fusion_weights
        - top_3 ranked diseases with fused scores
        - full_vector (all diseases)
        - image_vector and soil_vector (normalised inputs)
        - recommendation (combined agronomic advice)
        - fusion_meta (agreement, top diseases per branch, etc.)
        - image_branch_raw: raw image model output for auditability
        - soil_branch_raw: raw soil branch output for auditability
    """
    # ── 1. Validate file type ──────────────────────────────────────────
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only image files are accepted."
        )

    crop = crop.lower().strip()
    if not crop:
        raise HTTPException(
            status_code=400,
            detail="crop parameter is required (e.g. tomato, potato, pepper, apple, grape, corn)."
        )

    try:
        # ── 2. Run Image Branch ────────────────────────────────────────
        file_bytes = await file.read()
        image_input = preprocess_image(io.BytesIO(file_bytes))

        # Full softmax probability vector over all 27 classes
        raw_probs = model.predict(image_input)[0]           # shape: (27,)
        predicted_idx   = int(np.argmax(raw_probs))
        top_confidence  = float(np.max(raw_probs))
        predicted_class = class_names[predicted_idx]

        # Build the full image probability vector {PlantVillage_name: probability}
        image_vector_full: dict[str, float] = {
            class_names[i]: float(raw_probs[i])
            for i in range(len(class_names))
        }

        predicted_crop_raw = predicted_class.split("___")[0].lower()
        predicted_crop = predicted_crop_raw.split(",")[0].split("(")[0].strip()

        if predicted_crop != crop.lower():
            raise HTTPException(
                status_code=400,
                detail=f"Crop mismatch: uploaded image appears to be '{predicted_crop}' "
                    f"but crop parameter was '{crop}'. Please verify the image or crop selection."
            )

        # ── 3. Resolve SHC / soil values ──────────────────────────────
        soil = db.query(SoilData).filter(
            SoilData.user_id == current_user.id
        ).order_by(SoilData.timestamp.desc()).first()

        shc_values = {
            "N":  nitrogen       or (float(soil.nitrogen)       if soil and soil.nitrogen       else None),
            "P":  phosphorus     or (float(soil.phosphorus)     if soil and soil.phosphorus     else None),
            "K":  potassium      or (float(soil.potassium)      if soil and soil.potassium      else None),
            "pH": ph             or (float(soil.ph)             if soil and soil.ph             else None),
            "OC": organic_carbon or (float(soil.organic_carbon) if soil and soil.organic_carbon else None),
            "Zn": zinc           or (float(soil.zinc)           if soil and soil.zinc           else None),
            "S":  sulphur        or (float(soil.sulphur)        if soil and soil.sulphur        else None),
        }

        if not any(shc_values.values()):
            raise HTTPException(
                status_code=400,
                detail="No soil data available. Upload your Soil Health Card first, or provide soil values manually."
            )

        # ── 4. Run Soil Branch (Branch 2) ─────────────────────────────
        soil_branch_result = run_soil_branch(
            crop=crop,
            shc_values=shc_values
        )
        soil_susceptibility_vector = soil_branch_result["susceptibility_vector"]

        # ── 5. Run Fusion (Branch 3) ───────────────────────────────────
        fusion_result = run_fusion(
            crop         = crop,
            image_vector = image_vector_full,
            soil_vector  = soil_susceptibility_vector,
            image_weight = image_weight,
            soil_weight  = soil_weight,
        )

        # ── 6. Attach raw branch outputs for auditability ──────────────
        fusion_result["image_branch_raw"] = {
            "predicted_class": predicted_class,
            "top_confidence":  round(top_confidence, 4),
            "severity":        get_severity(raw_probs),
        }
        fusion_result["soil_branch_raw"] = {
            "top_disease":       soil_branch_result.get("top_disease"),
            "vulnerability_score": soil_branch_result.get("vulnerability_score"),
            "soil_health_score": soil_branch_result.get("soil_health_score"),
            "flags":             soil_branch_result.get("flags", []),
            "skipped_params":    soil_branch_result.get("skipped_params", []),
            "narrative":         soil_branch_result.get("narrative", {}),
        }

        return fusion_result

    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Fusion endpoint error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Fusion analysis failed: {str(e)}"
        )
