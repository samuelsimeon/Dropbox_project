from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from firebase_admin import auth as firebase_auth
from app.db import db
from app.models.share import ShareCreate
from app.auth import get_current_user
from app.storage import container_client
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime
import io

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
        "owner_id": user_id,
        "is_deleted": {"$ne": True}
    })

    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found or you do not own this file")

    try:
        recipient = firebase_auth.get_user_by_email(share.shared_with_email.strip())
    except Exception:
        raise HTTPException(status_code=404, detail="No user found with that email")

    if recipient.uid == user_id:
        raise HTTPException(status_code=400, detail="You cannot share a file with yourself")

    existing_share = db.shares.find_one({
        "file_id": share.file_id,
        "owner_id": user_id,
        "shared_with_user_id": recipient.uid
    })

    if existing_share:
        raise HTTPException(status_code=400, detail="This file is already shared with that email")

    share_doc = {
        "file_id": share.file_id,
        "owner_id": user_id,
        "shared_with_user_id": recipient.uid,
        "shared_with_email": share.shared_with_email.strip(),
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
            file_doc = db.files.find_one({
                "_id": ObjectId(share["file_id"]),
                "is_deleted": {"$ne": True}
            })
        except InvalidId:
            continue

        if file_doc:
            shared_files.append({
                "share_id": str(share["_id"]),
                "shared_by": share["owner_id"],
                "shared_with_email": share.get("shared_with_email"),
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


@router.get("/shares/files/{file_id}/download")
def download_shared_file(file_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]

    try:
        file_obj_id = ObjectId(file_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid file ID")

    share_doc = db.shares.find_one({
        "file_id": file_id,
        "shared_with_user_id": user_id
    })

    if not share_doc:
        raise HTTPException(status_code=403, detail="You do not have access to this shared file")

    file_doc = db.files.find_one({
        "_id": file_obj_id,
        "is_deleted": {"$ne": True}
    })

    if not file_doc:
        raise HTTPException(status_code=404, detail="Shared file not found")

    try:
        blob_client = container_client.get_blob_client(file_doc["blob_name"])
        downloaded_blob = blob_client.download_blob()
        file_data = downloaded_blob.readall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Shared file download failed: {str(e)}")

    return StreamingResponse(
        io.BytesIO(file_data),
        media_type=file_doc.get("content_type") or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{file_doc["filename"]}"'
        }
    )