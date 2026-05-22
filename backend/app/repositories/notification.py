import uuid
from typing import List
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.notification import Notification
from app.repositories.base import BaseRepository

class NotificationRepository(BaseRepository[Notification]):
    def __init__(self, db: AsyncSession):
        super().__init__(Notification, db)
        
    async def list_by_organization(self, organization_id: uuid.UUID, only_unread: bool = False) -> List[Notification]:
        """Fetch notifications, with optional filters for unread/read items."""
        query = select(Notification).filter(Notification.organization_id == organization_id)
        if only_unread:
            query = query.filter(Notification.is_read == False)
        query = query.order_by(Notification.created_at.desc())
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
        
    async def mark_all_as_read(self, organization_id: uuid.UUID) -> int:
        """Mark all notifications inside the organization boundaries as read."""
        query = (
            update(Notification)
            .filter(
                Notification.organization_id == organization_id,
                Notification.is_read == False
            )
            .values(is_read=True)
        )
        result = await self.db.execute(query)
        return result.rowcount
