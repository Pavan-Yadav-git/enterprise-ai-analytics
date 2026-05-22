import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class EventCreate(BaseModel):
    event_name: str = Field(..., min_length=1, max_length=100, pattern="^[a-zA-Z0-9_.-]+$")
    payload: Dict[str, Any] = Field(default_factory=dict)
    timestamp: Optional[datetime] = Field(default=None, description="ISO-8601 string. Fallbacks to server time.")

class EventBatchCreate(BaseModel):
    events: List[EventCreate] = Field(..., min_items=1, max_items=1000)

class EventResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    event_name: str
    source_type: str
    payload: Dict[str, Any]
    timestamp: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True

# Helper schema for frontend charts & widget queries
class TimeSeriesPoint(BaseModel):
    timestamp: datetime
    value: float

class QueryResult(BaseModel):
    widget_id: uuid.UUID
    title: str
    type: str
    data: List[Dict[str, Any]]
