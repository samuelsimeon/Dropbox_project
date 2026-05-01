from fastapi import APIRouter, Depends
from app.db import db
from app.auth import get_current_user
from bson import ObjectId
from bson.errors import InvalidId

router = APIRouter()


def build_folder_path(folder_id: str, user_id: str) -> str:
    if folder_id is None:
        return "Root"

    parts = []
    current_id = folder_id

    while current_id:
        try:
            folder = db.folders.find_one({
                "_id": ObjectId(current_id),
                "owner_id": user_id,
                "is_deleted": {"$ne": True}
            })
        except InvalidId:
            break

        if not folder:
            break

        parts.append(folder["name"])
        current_id = folder.get("parent_id")

    parts.reverse()
    return "Root / " + " / ".join(parts) if parts else "Root"


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


@router.get("/duplicates")
def get_duplicate_files(current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]

    files = list(db.files.find({
        "owner_id": user_id,
        "is_deleted": {"$ne": True},
        "file_hash": {"$exists": True, "$ne": None}
    }))

    groups = {}

    for file_doc in files:
        file_hash = file_doc.get("file_hash")
        if not file_hash:
            continue

        file_id = str(file_doc["_id"])
        folder_id = file_doc.get("folder_id")
        path = build_folder_path(folder_id, user_id)

        item = {
            "_id": file_id,
            "filename": file_doc["filename"],
            "folder_id": folder_id,
            "path": path,
            "size": file_doc.get("size"),
            "content_type": file_doc.get("content_type"),
            "file_hash": file_hash,
            "uploaded_at": file_doc["uploaded_at"].isoformat()
        }

        groups.setdefault(file_hash, []).append(item)

    duplicate_groups = []
    for file_hash, items in groups.items():
        if len(items) > 1:
            duplicate_groups.append({
                "file_hash": file_hash,
                "count": len(items),
                "files": items
            })

    return {
        "duplicate_groups": duplicate_groups
    }