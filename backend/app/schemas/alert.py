import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, HttpUrl

class AlertRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    metric: str = Field(..., min_length=1, description="Event name to trigger off")
    aggregation: str = Field("count", pattern="^(count|sum|avg)$")
    operator: str = Field("gt", pattern="^(gt|lt|eq|gte|lte)$")
    threshold: float
    evaluation_window_minutes: int = Field(5, ge=1, le=1440)
    notification_channels: List[str] = Field(default_factory=lambda: ["in_app"])
    webhook_url: Optional[str] = None

class AlertRuleUpdate(BaseModel):
    name: Optional[str] = None
    metric: Optional[str] = None
    aggregation: Optional[str] = None
    operator: Optional[str] = None
    threshold: Optional[float] = None
    evaluation_window_minutes: Optional[int] = None
    notification_channels: Optional[List[str]] = None
    webhook_url: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(Active|Triggered|Resolved|Muted)$")
    snooze_for_hours: Optional[int] = Field(None, ge=1, le=168)

class AlertRuleResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    metric: str
    aggregation: str
    operator: str
    threshold: float
    evaluation_window_minutes: int
    notification_channels: List[str]
    webhook_url: Optional[str] = None
    status: str
    snoozed_until: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class AlertHistoryResponse(BaseModel):
    id: uuid.UUID
    alert_rule_id: uuid.UUID
    triggered_value: float
    triggered_at: datetime
    status: str
    
    class Config:
        from_attributes = True
