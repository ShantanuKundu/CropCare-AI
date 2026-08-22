from pydantic import BaseModel, EmailStr
from typing import Optional

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str 
    confirm_password: str
    
class LoginRequest(BaseModel):
    email: EmailStr
    password: str    

class FarmCreate(BaseModel):
    farm_name: str
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    area_hectares: Optional[float] = None
 
class FarmResponse(BaseModel):
    id: int
    farm_name: str
    location_name: Optional[str]
    latitude: float
    longitude: float
    area_hectares: Optional[float]
 
    class Config:
        from_attributes = True    

class FertilizerRequest(BaseModel):
    crop: Optional[str] = None
    farming_type: str   # "chemical" | "organic" | "traditional"
 
    # Optional manual override — if not provided, latest SHC data from DB is used
    nitrogen: Optional[float] = None
    phosphorous: Optional[float] = None
    potassium: Optional[float] = None
    ph: Optional[float] = None

# NEW — added for Crop Yield Prediction feature
class YieldRequest(BaseModel):
    crop: str                   # from recommendation dropdown OR manual
    farming_type: str           # "chemical" | "organic" | "traditional"
    season: str                 # "Kharif" | "Rabi" | "Zaid"
    farm_id: Optional[int] = None          # pulls lat/lon for NASA POWER weather
    nitrogen:    Optional[float] = None    # manual override; falls back to latest SoilData
    phosphorous: Optional[float] = None
    potassium:   Optional[float] = None
    ph:          Optional[float] = None
    irrigation_type: Optional[str] = "rainfed"  # "rainfed" | "irrigated" | "drip"
    area_acres:  Optional[float] = None          # if given → total production returned 

#Research
class SoilBranchRequest(BaseModel):
    crop: str                        # e.g. "tomato", "potato"
    nitrogen:      Optional[float] = None
    phosphorus:    Optional[float] = None
    potassium:     Optional[float] = None
    ph:            Optional[float] = None
    organic_carbon:Optional[float] = None
    zinc:          Optional[float] = None
    sulphur:       Optional[float] = None
    # If all None → pulls latest SoilData from DB automatically

# Branch 3 — Fusion Engine Request
class FusionRequest(BaseModel):
    crop: str                          # e.g. "tomato" | "potato" | "pepper" | "apple" | "grape" | "corn"

    # Soil Branch inputs (same as SoilBranchRequest — all optional, falls back to latest SHC in DB)
    nitrogen:       Optional[float] = None
    phosphorus:     Optional[float] = None
    potassium:      Optional[float] = None
    ph:             Optional[float] = None
    organic_carbon: Optional[float] = None
    zinc:           Optional[float] = None
    sulphur:        Optional[float] = None

    # Fusion weight overrides (defaults: image=0.70, soil=0.30)
    image_weight:   Optional[float] = None    # must be in (0, 1] if provided
    soil_weight:    Optional[float] = None    # must be in (0, 1] if provided

    # Image branch: prediction_id from a prior /predict call.
    # The fusion endpoint will fetch the stored top-N probabilities for that prediction.
    # If omitted, the LATEST prediction for the current user is used automatically.
    prediction_id:  Optional[int]   = None