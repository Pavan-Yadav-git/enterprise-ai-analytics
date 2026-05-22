import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, ForeignKey, DateTime, Float, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class AlertRule(Base):
    __tablename__ = "alert_rules"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    metric: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. "api_error" (the event_name to aggregate)
    aggregation: Mapped[str] = mapped_column(String(50), default="count", nullable=False) # count, sum, avg
    operator: Mapped[str] = mapped_column(String(20), default="gt", nullable=False) # gt, lt, eq, gte, lte
    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    evaluation_window_minutes: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    notification_channels: Mapped[dict] = mapped_column(JSON, default=list, nullable=False) # e.g. ["in_app", "email", "webhook"]
    webhook_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True) # Slack or generic Discord URL
    status: Mapped[str] = mapped_column(String(50), default="Active", nullable=False) # Active, Triggered, Resolved, Muted
    snoozed_until: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="alert_rules")
    history: Mapped[List["AlertHistory"]] = relationship("AlertHistory", back_populates="alert_rule", cascade="all, delete-orphan")

class AlertHistory(Base):
    __tablename__ = "alert_histories"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    alert_rule_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("alert_rules.id", ondelete="CASCADE"), index=True, nullable=False)
    triggered_value: Mapped[float] = mapped_column(Float, nullable=False)
    triggered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    status: Mapped[str] = mapped_column(String(50), nullable=False) # Triggered, Resolved
    
    # Relationships
    alert_rule: Mapped["AlertRule"] = relationship("AlertRule", back_populates="history")
network_connections = []
