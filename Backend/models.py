from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable = False)
    email = Column(String, unique=True, index=True, nullable= False)
    password = Column(String, nullable=False)

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    disease = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)

    image_name = Column(String, nullable=True)
    image_url = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

class SoilData(Base):
    __tablename__ = "soil_data"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    ph = Column(String, nullable=True)
    nitrogen = Column(String, nullable=True)
    phosphorus = Column(String, nullable=True)
    potassium = Column(String, nullable=True)
    organic_carbon = Column(String, nullable=True)  # %
    zinc           = Column(String, nullable=True)   # ppm
    sulphur        = Column(String, nullable=True)   # ppm
    entry_method   = Column(String, nullable=True, default="ocr")

    timestamp = Column(DateTime, default=datetime.utcnow)    

class Farm(Base):
    __tablename__ = "farms"
 
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
 
    farm_name = Column(String, nullable=False)
    location_name = Column(String, nullable=True)       # human readable e.g. "Kullu, HP"
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    area_hectares = Column(Float, nullable=True)
 
    created_at = Column(DateTime, default=datetime.utcnow)

class CropRecommendation(Base):
    __tablename__ = "crop_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    farm_id = Column(Integer, ForeignKey("farms.id"), nullable=False)
    season = Column(String, nullable=False)

    recommendations = Column(String)  # store JSON as string

    created_at = Column(DateTime, default=datetime.utcnow)

class FertilizerRecommendation(Base):
    __tablename__ = "fertilizer_recommendations"
 
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
 
    crop = Column(String, nullable=False)
    farming_type = Column(String, nullable=False)   # chemical | organic | traditional
 
    # Soil values used for this recommendation (snapshot)
    nitrogen = Column(Float, nullable=True)
    phosphorous = Column(Float, nullable=True)
    potassium = Column(Float, nullable=True)
    ph = Column(Float, nullable=True)
 
    # Full result stored as JSON string
    result = Column(String, nullable=False)
 
    created_at = Column(DateTime, default=datetime.utcnow)
 
class YieldPrediction(Base):
    __tablename__ = "yield_predictions"
    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=False)
    farm_id         = Column(Integer, ForeignKey("farms.id"), nullable=True)
    crop            = Column(String, nullable=False)
    season          = Column(String, nullable=False)
    farming_type    = Column(String, nullable=False)
    irrigation_type = Column(String, nullable=True)
    #area_acres      = Column(Float,  nullable=True)
    nitrogen        = Column(Float,  nullable=True)
    phosphorous     = Column(Float,  nullable=True)
    potassium       = Column(Float,  nullable=True)
    ph              = Column(Float,  nullable=True)
    result          = Column(String, nullable=False)   # JSON string
    created_at      = Column(DateTime, default=datetime.utcnow)