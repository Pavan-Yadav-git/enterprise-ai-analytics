import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# Widget schemas
class WidgetCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    type: str = Field("line", pattern="^(line|bar|pie|kpi|table)$")
    query_config: Dict[str, Any] = Field(
        ...,
        description="Configuration for event query: e.g. {event_name: 'api_call', aggregation: 'count', groupby: 'payload.status', time_range: '24h'}"
    )
    layout_config: Dict[str, Any] = Field(
        default_factory=dict,
        description="Positioning coordinates: {x: 0, y: 0, w: 6, h: 4}"
    )

class WidgetUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    query_config: Optional[Dict[str, Any]] = None
    layout_config: Optional[Dict[str, Any]] = None

class WidgetResponse(BaseModel):
    id: uuid.UUID
    dashboard_id: uuid.UUID
    title: str
    type: str
    query_config: Dict[str, Any]
    layout_config: Dict[str, Any]
    
    class Config:
        from_attributes = True

# Dashboard schemas
class DashboardCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    layout: Optional[Dict[str, Any]] = None
    is_public: bool = False

class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    layout: Optional[Dict[str, Any]] = None
    is_public: Optional[bool] = None

class DashboardResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    description: Optional[str] = None
    layout: Dict[str, Any]
    is_public: bool
    created_by: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime
    widgets: List[WidgetResponse] = []
    
    class Config:
        from_attributes = True
