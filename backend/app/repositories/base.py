from typing import Generic, TypeVar, Type, List, Optional, Any
import uuid
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import Base

ModelType = TypeVar("ModelType", bound=Base)

class BaseRepository(Generic[ModelType]):
    """Generic repository providing basic CRUD operations with optional organization scoping."""
    
    def __init__(self, model: Type[ModelType], db: AsyncSession):
        self.model = model
        self.db = db

    async def get_by_id(self, id: uuid.UUID) -> Optional[ModelType]:
        """Fetch a record by its unique ID (unscoped)."""
        result = await self.db.execute(select(self.model).filter(self.model.id == id))
        return result.scalars().first()

    async def get_by_id_scoped(self, id: uuid.UUID, organization_id: uuid.UUID) -> Optional[ModelType]:
        """Fetch a record by its unique ID, strictly verified under a specific organization ID."""
        # Note: assumes the model possesses an 'organization_id' column.
        query = select(self.model).filter(
            self.model.id == id,
            self.model.organization_id == organization_id
        )
        result = await self.db.execute(query)
        return result.scalars().first()

    async def list_scoped(self, organization_id: uuid.UUID, skip: int = 0, limit: int = 100) -> List[ModelType]:
        """List records strictly bounded by the organization ID, with support for pagination."""
        query = (
            select(self.model)
            .filter(self.model.organization_id == organization_id)
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create(self, db_obj: ModelType) -> ModelType:
        """Add a new record to the session and flush to generate ID and defaults."""
        self.db.add(db_obj)
        await self.db.flush()
        return db_obj

    async def update(self, db_obj: ModelType) -> ModelType:
        """Mark record modified and flush."""
        self.db.add(db_obj)
        await self.db.flush()
        return db_obj

    async def delete_scoped(self, id: uuid.UUID, organization_id: uuid.UUID) -> bool:
        """Find and remove a record strictly bounded by organization ID."""
        db_obj = await self.get_by_id_scoped(id, organization_id)
        if not db_obj:
            return False
        await self.db.delete(db_obj)
        await self.db.flush()
        return True
