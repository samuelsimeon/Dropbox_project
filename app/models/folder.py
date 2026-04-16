from pydantic import BaseModel, Field
from typing import Optional

class FolderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    parent_id: Optional[str] = None