from fastapi import APIRouter, Depends
from app.db import db
from app.auth import get_current_user

router = APIRouter()


@router.get("/directory")
def get_directory_contents(folder_id: str = None, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]

    folder_query = {
        "owner_id": user_id,
        "parent_id": folder_id,
        "is_deleted": {"$ne": True}
    }

    file_query = {
        "owner_id": user_id,
        "folder_id": folder_id,
        "is_deleted": {"$ne": True}
    }

    folders = list(db.folders.find(folder_query))
    files = list(db.files.find(file_query))

    for folder in folders:
        folder["_id"] = str(folder["_id"])
        folder["created_at"] = folder["created_at"].isoformat()

    for file in files:
        file["_id"] = str(file["_id"])
        file["uploaded_at"] = file["uploaded_at"].isoformat()

    return {
        "current_folder_id": folder_id,
        "folders": folders,
        "files": files
    }


@router.get("/trash")
def get_deleted_items(current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]

    folders = list(db.folders.find({
        "owner_id": user_id,
        "is_deleted": True
    }))

    files = list(db.files.find({
        "owner_id": user_id,
        "is_deleted": True
    }))

    for folder in folders:
        folder["_id"] = str(folder["_id"])
        if folder.get("deleted_at"):
            folder["deleted_at"] = folder["deleted_at"].isoformat()

    for file in files:
        file["_id"] = str(file["_id"])
        if file.get("deleted_at"):
            file["deleted_at"] = file["deleted_at"].isoformat()

    return {
        "folders": folders,
        "files": files
    }