from fastapi import FastAPI
from app.db import db

app = FastAPI()

@app.get("/")
def home():
    return {"message": "App is running"}

@app.get("/test-db")
def test_db():
    collections = db.list_collection_names()
    return {
        "message": "MongoDB connection successful",
        "collections": collections
    }