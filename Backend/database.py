import os
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base   

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:sk-27@localhost:5432/cropcare_db")

engine = create_engine(DATABASE_URL)
SessionLocal =sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
print("Database connected")