from fastapi import APIRouter, HTTPException, Depends
from app.db import db
from app.models.folder import FolderCreate
from app.auth import get_current_user
from datetime import datetime
from bson import ObjectId
from bson.errors import InvalidId

router = APIRouter()


@router.post("/folders")
def create_folder(folder: FolderCreate, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]
    folder_name = folder.name.strip()

    if not folder_name:
        raise HTTPException(status_code=400, detail="Folder name cannot be empty")

    if folder.parent_id is not None:
        try:
            parent_folder = db.folders.find_one({
                "_id": ObjectId(folder.parent_id),
                "owner_id": user_id
            })
        except InvalidId:
            raise HTTPException(status_code=400, detail="Invalid parent folder ID")

        if not parent_folder:
            raise HTTPException(status_code=404, detail="Parent folder not found")

    existing_folder = db.folders.find_one({
        "name": folder_name,
        "owner_id": user_id,
        "parent_id": folder.parent_id
    })

    if existing_folder:
        raise HTTPException(
            status_code=400,
            detail="A folder with this name already exists in this location"
        )

    folder_data = {
        "name": folder_name,
        "owner_id": user_id,
        "parent_id": folder.parent_id,
        "created_at": datetime.utcnow()
    }

    result = db.folders.insert_one(folder_data)

    return {
        "message": "Folder created successfully",
        "folder_id": str(result.inserted_id)
    }


@router.get("/folders")
def list_folders(parent_id: str = None, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]

    query = {
        "owner_id": user_id,
        "parent_id": parent_id
    }

    folders = list(db.folders.find(query))

    for folder in folders:
        folder["_id"] = str(folder["_id"])
        folder["created_at"] = folder["created_at"].isoformat()

    return folders


@router.get("/folders/{folder_id}")
def get_folder(folder_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]

    try:
        folder = db.folders.find_one({
            "_id": ObjectId(folder_id),
            "owner_id": user_id
        })
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid folder ID")

    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    folder["_id"] = str(folder["_id"])
    folder["created_at"] = folder["created_at"].isoformat()

    return folder