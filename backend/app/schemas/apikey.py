import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class APIKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    expires_in_days: Optional[int] = Field(None, description="Optional lifespan of key in days")

class APIKeyResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    key_prefix: str
    is_active: bool
    created_at: datetime
    expires_at: Optional[datetime] = None
    # For one-time display on generation
    raw_key: Optional[str] = None
    
    class Config:
        from_attributes = True
