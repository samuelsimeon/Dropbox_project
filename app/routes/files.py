from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import StreamingResponse
from app.db import db
from app.storage import container_client
from app.auth import get_current_user
from app.services.trash import soft_delete_file, restore_file
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime
import uuid
import io

router = APIRouter()


@router.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    folder_id: str = Form(None),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["uid"]

    if folder_id:
        try:
            folder = db.folders.find_one({
                "_id": ObjectId(folder_id),
                "owner_id": user_id,
                "is_deleted": {"$ne": True}
            })
        except InvalidId:
            raise HTTPException(status_code=400, detail="Invalid folder ID")

        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")

    unique_id = str(uuid.uuid4())
    blob_name = f"{user_id}/{folder_id if folder_id else 'root'}/{unique_id}_{file.filename}"

    file_data = await file.read()

    try:
        blob_client = container_client.get_blob_client(blob_name)
        blob_client.upload_blob(file_data, overwrite=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blob upload failed: {str(e)}")

    file_doc = {
        "filename": file.filename,
        "owner_id": user_id,
        "folder_id": folder_id,
        "content_type": file.content_type,
        "size": len(file_data),
        "blob_name": blob_name,
        "uploaded_at": datetime.utcnow(),
        "is_deleted": False,
        "deleted_at": None,
        "original_folder_id": folder_id
    }

    result = db.files.insert_one(file_doc)

    return {
        "message": "File uploaded successfully",
        "file_id": str(result.inserted_id),
        "blob_name": blob_name
    }


@router.get("/files")
def list_files(folder_id: str = None, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]

    query = {
        "owner_id": user_id,
        "folder_id": folder_id,
        "is_deleted": {"$ne": True}
    }

    files = list(db.files.find(query))

    for file in files:
        file["_id"] = str(file["_id"])
        file["uploaded_at"] = file["uploaded_at"].isoformat()

    return files


@router.get("/files/{file_id}/download")
def download_file(file_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]

    try:
        file_doc = db.files.find_one({
            "_id": ObjectId(file_id),
            "owner_id": user_id,
            "is_deleted": {"$ne": True}
        })
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid file ID")

    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        blob_client = container_client.get_blob_client(file_doc["blob_name"])
        downloaded_blob = blob_client.download_blob()
        file_data = downloaded_blob.readall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blob download failed: {str(e)}")

    return StreamingResponse(
        io.BytesIO(file_data),
        media_type=file_doc.get("content_type") or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{file_doc["filename"]}"'
        }
    )


@router.delete("/files/{file_id}")
def delete_file(file_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]

    try:
        file_doc = db.files.find_one({
            "_id": ObjectId(file_id),
            "owner_id": user_id,
            "is_deleted": {"$ne": True}
        })
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid file ID")

    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    soft_delete_file(file_doc)

    return {"message": "File moved to trash"}


@router.post("/files/{file_id}/restore")
def restore_deleted_file(file_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]

    try:
        file_doc = db.files.find_one({
            "_id": ObjectId(file_id),
            "owner_id": user_id,
            "is_deleted": True
        })
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid file ID")

    if not file_doc:
        raise HTTPException(status_code=404, detail="Deleted file not found")

    restore_file(file_doc)

    return {"message": "File restored successfully"}


@router.delete("/files/{file_id}/permanent")
def permanently_delete_file(file_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]

    try:
        file_doc = db.files.find_one({
            "_id": ObjectId(file_id),
            "owner_id": user_id,
            "is_deleted": True
        })
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid file ID")

    if not file_doc:
        raise HTTPException(status_code=404, detail="Deleted file not found")

    try:
        blob_client = container_client.get_blob_client(file_doc["blob_name"])
        blob_client.delete_blob()
    except Exception:
        pass

    db.files.delete_one({"_id": file_doc["_id"]})

    return {"message": "File permanently deleted"}