from fastapi import APIRouter, HTTPException, Depends
from app.db import db
from app.models.share import ShareCreate
from app.auth import get_current_user
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime

router = APIRouter()


@router.post("/shares")
def share_file(share: ShareCreate, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]

    try:
        file_obj_id = ObjectId(share.file_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid file ID")

    file_doc = db.files.find_one({
        "_id": file_obj_id,
        "owner_id": user_id
    })

    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found or you do not own this file")

    if share.shared_with_user_id == user_id:
        raise HTTPException(status_code=400, detail="You cannot share a file with yourself")

    existing_share = db.shares.find_one({
        "file_id": share.file_id,
        "owner_id": user_id,
        "shared_with_user_id": share.shared_with_user_id
    })

    if existing_share:
        raise HTTPException(status_code=400, detail="This file is already shared with that user")

    share_doc = {
        "file_id": share.file_id,
        "owner_id": user_id,
        "shared_with_user_id": share.shared_with_user_id,
        "created_at": datetime.utcnow()
    }

    result = db.shares.insert_one(share_doc)

    return {
        "message": "File shared successfully",
        "share_id": str(result.inserted_id)
    }


@router.get("/shares/shared-with-me")
def list_shared_with_me(current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]

    shares = list(db.shares.find({
        "shared_with_user_id": user_id
    }))

    shared_files = []

    for share in shares:
        try:
            file_doc = db.files.find_one({"_id": ObjectId(share["file_id"])})
        except InvalidId:
            continue

        if file_doc:
            shared_files.append({
                "share_id": str(share["_id"]),
                "shared_by": share["owner_id"],
                "shared_at": share["created_at"].isoformat(),
                "file": {
                    "_id": str(file_doc["_id"]),
                    "filename": file_doc["filename"],
                    "owner_id": file_doc["owner_id"],
                    "folder_id": file_doc.get("folder_id"),
                    "content_type": file_doc.get("content_type"),
                    "size": file_doc.get("size"),
                    "blob_name": file_doc.get("blob_name"),
                    "uploaded_at": file_doc["uploaded_at"].isoformat()
                }
            })

    return {
        "user_id": user_id,
        "shared_files": shared_files
    }