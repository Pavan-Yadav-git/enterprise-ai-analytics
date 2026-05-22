import uuid
from typing import List, Optional
from datetime import datetime
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.auth import User, Organization, OrgMember, OrgInvite
from app.repositories.base import BaseRepository

class UserRepository(BaseRepository[User]):
    def __init__(self, db: AsyncSession):
        super().__init__(User, db)
        
    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(select(User).filter(User.email == email))
        return result.scalars().first()

class OrganizationRepository(BaseRepository[Organization]):
    def __init__(self, db: AsyncSession):
        super().__init__(Organization, db)

class OrgMemberRepository(BaseRepository[OrgMember]):
    def __init__(self, db: AsyncSession):
        super().__init__(OrgMember, db)
        
    async def get_member(self, user_id: uuid.UUID, organization_id: uuid.UUID) -> Optional[OrgMember]:
        result = await self.db.execute(
            select(OrgMember).filter(
                OrgMember.user_id == user_id,
                OrgMember.organization_id == organization_id
            )
        )
        return result.scalars().first()
        
    async def list_by_organization(self, organization_id: uuid.UUID) -> List[OrgMember]:
        result = await self.db.execute(
            select(OrgMember)
            .filter(OrgMember.organization_id == organization_id)
            .options(selectinload(OrgMember.user))
        )
        return list(result.scalars().all())

class OrgInviteRepository(BaseRepository[OrgInvite]):
    def __init__(self, db: AsyncSession):
        super().__init__(OrgInvite, db)
        
    async def get_by_token(self, token: str) -> Optional[OrgInvite]:
        result = await self.db.execute(select(OrgInvite).filter(OrgInvite.token == token))
        return result.scalars().first()
        
    async def get_by_org_and_email(self, organization_id: uuid.UUID, email: str) -> Optional[OrgInvite]:
        result = await self.db.execute(
            select(OrgInvite).filter(
                OrgInvite.organization_id == organization_id,
                OrgInvite.email == email
            )
        )
        return result.scalars().first()

    async def list_by_organization(self, organization_id: uuid.UUID) -> List[OrgInvite]:
        result = await self.db.execute(
            select(OrgInvite).filter(OrgInvite.organization_id == organization_id)
        )
        return list(result.scalars().all())
