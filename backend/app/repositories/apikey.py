import uuid
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.apikey import APIKey
from app.repositories.base import BaseRepository

class APIKeyRepository(BaseRepository[APIKey]):
    def __init__(self, db: AsyncSession):
        super().__init__(APIKey, db)
        
    async def get_by_hash(self, key_hash: str) -> Optional[APIKey]:
        """Fetch active API key details by hash."""
        result = await self.db.execute(
            select(APIKey)
            .filter(
                APIKey.key_hash == key_hash,
                APIKey.is_active == True
            )
            .options(selectinload(APIKey.organization))
        )
        return result.scalars().first()

    async def list_by_organization(self, organization_id: uuid.UUID) -> List[APIKey]:
        """List all active/inactive keys for an organization."""
        result = await self.db.execute(
            select(APIKey)
            .filter(APIKey.organization_id == organization_id)
            .order_by(APIKey.created_at.desc())
        )
        return list(result.scalars().all())
