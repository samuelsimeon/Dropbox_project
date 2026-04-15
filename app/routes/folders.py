from fastapi import APIRouter
from app.db import db
from app.models.folder import FolderCreate
from datetime import datetime
from bson import ObjectId

router = APIRouter()

@router.post("/folders")
def create_folder(folder: FolderCreate):
    folder_data = {
        "name": folder.name,
        "owner_id": "user123",   # temporary until Firebase user routes are connected
        "parent_id": folder.parent_id,
        "created_at": datetime.utcnow()
    }

    result = db.folders.insert_one(folder_data)

    return {
        "message": "Folder created successfully",
        "folder_id": str(result.inserted_id)
    }

@router.get("/folders")
def list_folders(parent_id: str = None):
    query = {
        "owner_id": "user123",
        "parent_id": parent_id
    }

    folders = list(db.folders.find(query))

    for folder in folders:
        folder["_id"] = str(folder["_id"])

    return folders