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
import hashlib

# Router for all file-related routes
router = APIRouter()


@router.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    folder_id: str = Form(None),
    current_user: dict = Depends(get_current_user)
):
    # Get the currently logged-in user's ID from Firebase auth
    user_id = current_user["uid"]

    # If a folder_id was provided, make sure it belongs to the current user
    # and also make sure the folder has not been deleted
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

    # Read the uploaded file data into memory
    file_data = await file.read()

    # Generate a SHA-256 hash of the file contents
    # This is used for duplicate file detection
    file_hash = hashlib.sha256(file_data).hexdigest()

    # Check if a file with the same hash already exists in the same folder
    # for this user. If yes, block the upload.
    existing_duplicate = db.files.find_one({
        "owner_id": user_id,
        "folder_id": folder_id,
        "file_hash": file_hash,
        "is_deleted": {"$ne": True}
    })

    if existing_duplicate:
        raise HTTPException(
            status_code=400,
            detail="Duplicate file detected in this folder. Upload blocked."
        )

    # Create a unique blob name so files with the same original filename
    # do not overwrite each other in storage
    unique_id = str(uuid.uuid4())
    blob_name = f"{user_id}/{folder_id if folder_id else 'root'}/{unique_id}_{file.filename}"

    # Upload the real file data into Azurite blob storage
    try:
        blob_client = container_client.get_blob_client(blob_name)
        blob_client.upload_blob(file_data, overwrite=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blob upload failed: {str(e)}")

    # Store file metadata in MongoDB
    # The actual file content is in Azurite, while MongoDB stores info about it
    file_doc = {
        "filename": file.filename,
        "owner_id": user_id,
        "folder_id": folder_id,
        "content_type": file.content_type,
        "size": len(file_data),
        "blob_name": blob_name,
        "file_hash": file_hash,
        "uploaded_at": datetime.utcnow(),
        "is_deleted": False,
        "deleted_at": None,
        "original_folder_id": folder_id
    }

    result = db.files.insert_one(file_doc)

    # Return a success response with the inserted file ID and blob name
    return {
        "message": "File uploaded successfully",
        "file_id": str(result.inserted_id),
        "blob_name": blob_name,
        "file_hash": file_hash
    }


@router.get("/files")
def list_files(folder_id: str = None, current_user: dict = Depends(get_current_user)):
    # Get current user's ID
    user_id = current_user["uid"]

    # Only return files that belong to this user, are in the current folder,
    # and are not deleted
    query = {
        "owner_id": user_id,
        "folder_id": folder_id,
        "is_deleted": {"$ne": True}
    }

    files = list(db.files.find(query))

    # Convert MongoDB ObjectId and datetime into string format
    # so they can be returned as JSON safely
    for file in files:
        file["_id"] = str(file["_id"])
        file["uploaded_at"] = file["uploaded_at"].isoformat()

    return files


@router.get("/files/{file_id}/download")
def download_file(file_id: str, current_user: dict = Depends(get_current_user)):
    # Get current user's ID
    user_id = current_user["uid"]

    # Look up the file in MongoDB and make sure the user owns it
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

    # Download the file bytes from Azurite blob storage
    try:
        blob_client = container_client.get_blob_client(file_doc["blob_name"])
        downloaded_blob = blob_client.download_blob()
        file_data = downloaded_blob.readall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blob download failed: {str(e)}")

    # Return the file as a downloadable response
    return StreamingResponse(
        io.BytesIO(file_data),
        media_type=file_doc.get("content_type") or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{file_doc["filename"]}"'
        }
    )


@router.delete("/files/{file_id}")
def delete_file(file_id: str, current_user: dict = Depends(get_current_user)):
    # Get current user's ID
    user_id = current_user["uid"]

    # Find the file and make sure it exists and belongs to the current user
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

    # Soft delete means move the file to Trash instead of removing it immediately
    soft_delete_file(file_doc)

    return {"message": "File moved to trash"}


@router.post("/files/{file_id}/restore")
def restore_deleted_file(file_id: str, current_user: dict = Depends(get_current_user)):
    # Get current user's ID
    user_id = current_user["uid"]

    # Find the deleted file for this user
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

    # Restore the file back from Trash to its original location
    restore_file(file_doc)

    return {"message": "File restored successfully"}


@router.delete("/files/{file_id}/permanent")
def permanently_delete_file(file_id: str, current_user: dict = Depends(get_current_user)):
    # Get current user's ID
    user_id = current_user["uid"]

    # Only allow permanent delete for files that are already in Trash
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

    # Try to delete the real file from Azurite storage
    # If blob deletion fails for some reason, the code continues
    # so the MongoDB record can still be removed
    try:
        blob_client = container_client.get_blob_client(file_doc["blob_name"])
        blob_client.delete_blob()
    except Exception:
        pass

    # Remove the file metadata completely from MongoDB
    db.files.delete_one({"_id": file_doc["_id"]})

    return {"message": "File permanently deleted"}