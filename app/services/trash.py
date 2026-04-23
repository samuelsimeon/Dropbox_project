from datetime import datetime, timedelta
from bson import ObjectId
from app.db import db
from app.storage import container_client


def permanently_delete_file_doc(file_doc):
    try:
        blob_client = container_client.get_blob_client(file_doc["blob_name"])
        blob_client.delete_blob()
    except Exception:
        pass

    db.files.delete_one({"_id": file_doc["_id"]})


def soft_delete_file(file_doc):
    db.files.update_one(
        {"_id": file_doc["_id"]},
        {
            "$set": {
                "is_deleted": True,
                "deleted_at": datetime.utcnow(),
                "original_folder_id": file_doc.get("folder_id")
            }
        }
    )


def restore_file(file_doc):
    db.files.update_one(
        {"_id": file_doc["_id"]},
        {
            "$set": {
                "is_deleted": False,
                "deleted_at": None,
                "folder_id": file_doc.get("original_folder_id")
            }
        }
    )


def soft_delete_folder_recursive(folder_doc, user_id):
    folder_id = str(folder_doc["_id"])

    db.folders.update_one(
        {"_id": folder_doc["_id"]},
        {
            "$set": {
                "is_deleted": True,
                "deleted_at": datetime.utcnow(),
                "original_parent_id": folder_doc.get("parent_id")
            }
        }
    )

    files_in_folder = list(db.files.find({
        "owner_id": user_id,
        "folder_id": folder_id,
        "is_deleted": {"$ne": True}
    }))

    for file_doc in files_in_folder:
        soft_delete_file(file_doc)

    child_folders = list(db.folders.find({
        "owner_id": user_id,
        "parent_id": folder_id,
        "is_deleted": {"$ne": True}
    }))

    for child_folder in child_folders:
        soft_delete_folder_recursive(child_folder, user_id)


def restore_folder_recursive(folder_doc, user_id):
    folder_id = str(folder_doc["_id"])

    db.folders.update_one(
        {"_id": folder_doc["_id"]},
        {
            "$set": {
                "is_deleted": False,
                "deleted_at": None,
                "parent_id": folder_doc.get("original_parent_id")
            }
        }
    )

    files_in_folder = list(db.files.find({
        "owner_id": user_id,
        "folder_id": folder_id,
        "is_deleted": True
    }))

    for file_doc in files_in_folder:
        restore_file(file_doc)

    child_folders = list(db.folders.find({
        "owner_id": user_id,
        "parent_id": folder_id,
        "is_deleted": True
    }))

    for child_folder in child_folders:
        restore_folder_recursive(child_folder, user_id)


def permanently_delete_folder_recursive(folder_doc, user_id):
    folder_id = str(folder_doc["_id"])

    child_folders = list(db.folders.find({
        "owner_id": user_id,
        "parent_id": folder_id
    }))

    for child_folder in child_folders:
        permanently_delete_folder_recursive(child_folder, user_id)

    files_in_folder = list(db.files.find({
        "owner_id": user_id,
        "folder_id": folder_id
    }))

    for file_doc in files_in_folder:
        permanently_delete_file_doc(file_doc)

    db.folders.delete_one({"_id": folder_doc["_id"]})


def purge_expired_deleted_items():
    cutoff = datetime.utcnow() - timedelta(hours=1)

    deleted_files = list(db.files.find({
        "is_deleted": True,
        "deleted_at": {"$lte": cutoff}
    }))

    for file_doc in deleted_files:
        permanently_delete_file_doc(file_doc)

    deleted_folders = list(db.folders.find({
        "is_deleted": True,
        "deleted_at": {"$lte": cutoff}
    }))

    for folder_doc in deleted_folders:
        existing = db.folders.find_one({"_id": folder_doc["_id"]})
        if existing:
            permanently_delete_folder_recursive(existing, existing["owner_id"])