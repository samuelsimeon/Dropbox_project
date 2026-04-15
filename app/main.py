from fastapi import FastAPI
from app.db import db
from app.auth import verify_firebase_token

app = FastAPI()

@app.get("/")
def home():
    return {"message": "App is running"}

@app.get("/test-db")
def test_db():
    return {
        "message": "MongoDB connection successful",
        "collections": db.list_collection_names()
    }

@app.get("/test-firebase")
def test_firebase():
    return {"message": "Firebase Admin initialized successfully"}