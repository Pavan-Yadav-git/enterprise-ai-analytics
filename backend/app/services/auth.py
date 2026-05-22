import uuid
import bcrypt
from datetime import datetime, timedelta
from typing import Optional, Tuple
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.models.auth import User, Organization, OrgMember, OrgInvite
from app.repositories.auth import UserRepository, OrganizationRepository, OrgMemberRepository, OrgInviteRepository
from app.schemas.auth import UserCreate

# Secure password hashing utilizing pure bcrypt library
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)
        self.org_repo = OrganizationRepository(db)
        self.member_repo = OrgMemberRepository(db)
        self.invite_repo = OrgInviteRepository(db)

    # JWT Utilities
    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        to_encode = data.copy()
        expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    def create_refresh_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        to_encode = data.copy()
        expire = datetime.utcnow() + (expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    def decode_token(self, token: str) -> Optional[dict]:
        try:
            return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        except JWTError:
            return None

    # Authentication Services
    async def register_user(self, user_in: UserCreate) -> Tuple[User, Optional[Organization]]:
        # 1. Verify uniqueness
        existing_user = await self.user_repo.get_by_email(user_in.email)
        if existing_user:
            raise ValueError("Email already registered")

        # 2. Create User
        user = User(
            email=user_in.email,
            hashed_password=hash_password(user_in.password)
        )
        await self.user_repo.create(user)

        # 3. Create Org if provided
        org = None
        if user_in.org_name:
            org = Organization(name=user_in.org_name)
            await self.org_repo.create(org)
            
            # Associate as Owner
            member = OrgMember(
                organization_id=org.id,
                user_id=user.id,
                role="Owner"
            )
            await self.member_repo.create(member)

        return user, org

    async def create_organization(self, name: str, user_id: uuid.UUID) -> Organization:
        org = Organization(name=name)
        await self.org_repo.create(org)
        
        # Associate user as Owner
        member = OrgMember(
            organization_id=org.id,
            user_id=user_id,
            role="Owner"
        )
        await self.member_repo.create(member)
        return org

    async def authenticate_user(self, email: str, password: str) -> Optional[User]:
        user = await self.user_repo.get_by_email(email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    # Invitation System
    async def create_invite(self, organization_id: uuid.UUID, email: str, role: str, sender_id: uuid.UUID) -> OrgInvite:
        # Check if already invited
        existing_invite = await self.invite_repo.get_by_org_and_email(organization_id, email)
        if existing_invite:
            # Renew/extend
            existing_invite.expires_at = datetime.utcnow() + timedelta(days=7)
            existing_invite.token = str(uuid.uuid4())
            await self.invite_repo.update(existing_invite)
            return existing_invite

        invite = OrgInvite(
            organization_id=organization_id,
            email=email,
            role=role,
            token=str(uuid.uuid4()),
            expires_at=datetime.utcnow() + timedelta(days=7),
            created_by=sender_id
        )
        await self.invite_repo.create(invite)
        # In a real SaaS, we would trigger an email celery task here
        return invite

    async def accept_invite(self, token: str, user_id: uuid.UUID) -> OrgMember:
        invite = await self.invite_repo.get_by_token(token)
        if not invite:
            raise ValueError("Invalid invitation token")
            
        if invite.expires_at < datetime.utcnow():
            raise ValueError("Invitation token has expired")

        # Verify if user email matches the invite
        user = await self.user_repo.get_by_id(user_id)
        if not user or user.email != invite.email:
            raise ValueError("Authenticated user email does not match invitation recipient email")

        # Check if already a member
        existing_member = await self.member_repo.get_member(user_id, invite.organization_id)
        if existing_member:
            raise ValueError("Already a member of this organization")

        # Add member
        member = OrgMember(
            organization_id=invite.organization_id,
            user_id=user_id,
            role=invite.role
        )
        await self.member_repo.create(member)
        
        # Cleanup token
        await self.db.delete(invite)
        return member
