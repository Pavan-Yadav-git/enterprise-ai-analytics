import uuid
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.dashboard import Dashboard, Widget
from app.repositories.base import BaseRepository

class DashboardRepository(BaseRepository[Dashboard]):
    def __init__(self, db: AsyncSession):
        super().__init__(Dashboard, db)
        
    async def get_with_widgets(self, id: uuid.UUID, organization_id: uuid.UUID) -> Optional[Dashboard]:
        """Fetch dashboard and eagerly load all configured child widgets."""
        result = await self.db.execute(
            select(Dashboard)
            .filter(
                Dashboard.id == id,
                Dashboard.organization_id == organization_id
            )
            .options(selectinload(Dashboard.widgets))
        )
        return result.scalars().first()

    async def list_by_organization(self, organization_id: uuid.UUID) -> List[Dashboard]:
        """List dashboards, including their widget associations."""
        result = await self.db.execute(
            select(Dashboard)
            .filter(Dashboard.organization_id == organization_id)
            .options(selectinload(Dashboard.widgets))
            .order_by(Dashboard.created_at.desc())
        )
        return list(result.scalars().all())

class WidgetRepository(BaseRepository[Widget]):
    def __init__(self, db: AsyncSession):
        super().__init__(Widget, db)
        
    async def get_by_dashboard(self, dashboard_id: uuid.UUID) -> List[Widget]:
        """List all widgets associated with a specific dashboard ID."""
        result = await self.db.execute(
            select(Widget).filter(Widget.dashboard_id == dashboard_id)
        )
        return list(result.scalars().all())
