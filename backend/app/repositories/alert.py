import uuid
from typing import List, Optional
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.alert import AlertRule, AlertHistory
from app.repositories.base import BaseRepository

class AlertRepository(BaseRepository[AlertRule]):
    def __init__(self, db: AsyncSession):
        super().__init__(AlertRule, db)
        
    async def list_active_rules(self) -> List[AlertRule]:
        """Fetch all active/triggered rules across the cluster for periodic scheduler evaluation."""
        result = await self.db.execute(
            select(AlertRule)
            .filter(AlertRule.status.in_(["Active", "Triggered"]))
        )
        return list(result.scalars().all())

    async def list_by_organization(self, organization_id: uuid.UUID) -> List[AlertRule]:
        """List alert rules with historical trigger records preloaded."""
        result = await self.db.execute(
            select(AlertRule)
            .filter(AlertRule.organization_id == organization_id)
            .options(selectinload(AlertRule.history))
            .order_by(AlertRule.created_at.desc())
        )
        return list(result.scalars().all())

class AlertHistoryRepository(BaseRepository[AlertHistory]):
    def __init__(self, db: AsyncSession):
        super().__init__(AlertHistory, db)
        
    async def list_by_organization(self, organization_id: uuid.UUID, limit: int = 100) -> List[AlertHistory]:
        """Fetch historical alert triggers for any rule belonging to the active organization."""
        result = await self.db.execute(
            select(AlertHistory)
            .join(AlertRule)
            .filter(AlertRule.organization_id == organization_id)
            .options(selectinload(AlertHistory.alert_rule))
            .order_by(AlertHistory.triggered_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
