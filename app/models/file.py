from pydantic import BaseModel
from typing import Optional

class FileMetadata(BaseModel):
    filename: str
    folder_id: Optional[str] = None
    content_type: Optional[str] = None
    size: int
    blob_name: str