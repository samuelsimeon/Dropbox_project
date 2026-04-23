from pydantic import BaseModel

class ShareCreate(BaseModel):
    file_id: str
    shared_with_email: str