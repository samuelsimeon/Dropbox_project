from fastapi import FastAPI, Depends
from app.auth import get_current_user
from app.routes.folders import router as folder_router
from app.routes.files import router as file_router
from app.routes.directory import router as directory_router
from app.routes.shares import router as share_router

app = FastAPI()

app.include_router(folder_router)
app.include_router(file_router)
app.include_router(directory_router)
app.include_router(share_router)

@app.get("/")
def home():
    return {"message": "App is running"}

@app.get("/test-db")
def test_db():
    from app.db import db
    return {
        "message": "MongoDB connection successful",
        "collections": db.list_collection_names()
    }

@app.get("/test-firebase")
def test_firebase():
    return {"message": "Firebase Admin initialized successfully"}

@app.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "uid": current_user.get("uid"),
        "email": current_user.get("email")
    }