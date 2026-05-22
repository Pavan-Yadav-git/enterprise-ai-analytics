import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Cookie, Response, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db
from app.models.auth import User, Organization, OrgMember, OrgInvite
from app.schemas.auth import (
    UserCreate, UserLogin, UserResponse, Token, OrganizationResponse, OrganizationCreate,
    OrgMemberResponse, MemberUpdateRole, OrgInviteCreate, OrgInviteResponse, OrgInviteAccept
)
from app.services.auth import AuthService
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login-form", auto_error=False)

# Role ranking dictionary for easy permission checking
ROLE_RANKS = {
    "Viewer": 1,
    "Analyst": 2,
    "Admin": 3,
    "Owner": 4
}

# --- DEPENDENCIES ---

async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Decodes JWT access token and returns user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        raise credentials_exception
        
    auth_service = AuthService(db)
    payload = auth_service.decode_token(token)
    if not payload:
        raise credentials_exception
        
    user_id_str: str = payload.get("sub")
    if not user_id_str:
        raise credentials_exception
        
    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise credentials_exception
        
    result = await db.execute(select(User).filter(User.id == user_uuid))
    user = result.scalars().first()
    if not user:
        raise credentials_exception
        
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

# Context manager to fetch and assert active Org + Role
class OrgContext:
    def __init__(self, organization_id: uuid.UUID, member: OrgMember, role: str):
        self.organization_id = organization_id
        self.member = member
        self.role = role

def require_role(minimum_role: str):
    """
    Dependency checking organization membership and role permissions.
    Expects 'X-Org-ID' header.
    """
    async def _dependency(
        x_org_id: Optional[str] = Header(None, alias="X-Org-ID"),
        current_user: User = Depends(get_current_active_user),
        db: AsyncSession = Depends(get_db)
    ) -> OrgContext:
        if not x_org_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="X-Org-ID header is missing"
            )
            
        try:
            org_uuid = uuid.UUID(x_org_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid X-Org-ID header UUID format"
            )

        # Check membership
        result = await db.execute(
            select(OrgMember)
            .filter(OrgMember.user_id == current_user.id, OrgMember.organization_id == org_uuid)
        )
        membership = result.scalars().first()
        
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not belong to this organization"
            )

        # Validate role rank
        user_rank = ROLE_RANKS.get(membership.role, 0)
        required_rank = ROLE_RANKS.get(minimum_role, 5) # Default high boundary if role is typo'd
        
        if user_rank < required_rank:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation requires minimum role of '{minimum_role}'. Your role: '{membership.role}'"
            )

        return OrgContext(
            organization_id=org_uuid,
            member=membership,
            role=membership.role
        )

    return _dependency

# --- ENDPOINTS ---

@router.post("/signup", response_model=UserResponse)
async def signup(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    """Sign up a new user and optionally spin up their first organization."""
    auth_service = AuthService(db)
    try:
        user, _ = await auth_service.register_user(user_in)
        await db.commit()
        return user
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/login")
async def login(
    response: Response,
    user_in: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """Logs in user, issues short JWT access token and cookie-based refresh token."""
    auth_service = AuthService(db)
    user = await auth_service.authenticate_user(user_in.email, user_in.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
        
    # Generate tokens
    access_token = auth_service.create_access_token({"sub": str(user.id)})
    refresh_token = auth_service.create_refresh_token({"sub": str(user.id)})
    
    # Store refresh token in secure HTTP-only cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True, # In prod, set to True
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email
        }
    }

@router.post("/refresh")
async def refresh(
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db)
):
    """Regenerates a new short-lived JWT access token using HTTP-only cookies."""
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token cookie"
        )
        
    auth_service = AuthService(db)
    payload = auth_service.decode_token(refresh_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
        
    user_id_str = payload.get("sub")
    # Verify user exists
    result = await db.execute(select(User).filter(User.id == uuid.UUID(user_id_str)))
    user = result.scalars().first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
        
    # Generate new access token
    new_access = auth_service.create_access_token({"sub": str(user.id)})
    return {"access_token": new_access, "token_type": "bearer"}

@router.post("/logout")
async def logout(response: Response):
    """Clears refresh token cookie."""
    response.delete_cookie(key="refresh_token")
    return {"detail": "Logged out successfully"}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_active_user)):
    """Fetch active logged in user profile."""
    return current_user

@router.get("/organizations", response_model=List[OrganizationResponse])
async def list_my_organizations(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Lists organizations active user belongs to."""
    result = await db.execute(
        select(Organization)
        .join(OrgMember)
        .filter(OrgMember.user_id == current_user.id)
    )
    return list(result.scalars().all())

@router.post("/organizations", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_new_organization(
    org_in: OrganizationCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Creates a new organization and adds current user as Owner."""
    auth_service = AuthService(db)
    org = await auth_service.create_organization(org_in.name, current_user.id)
    await db.commit()
    return org

# --- ORG MEMBERS & INVITES ---

@router.get("/members", response_model=List[OrgMemberResponse])
async def list_org_members(
    org_ctx: OrgContext = Depends(require_role("Viewer")),
    db: AsyncSession = Depends(get_db)
):
    """List members belonging to current organization context."""
    auth_service = AuthService(db)
    return await auth_service.member_repo.list_by_organization(org_ctx.organization_id)

@router.post("/invite", response_model=OrgInviteResponse)
async def invite_team_member(
    invite_in: OrgInviteCreate,
    org_ctx: OrgContext = Depends(require_role("Admin")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Invite a user to the organization (Requires Admin/Owner permissions)."""
    auth_service = AuthService(db)
    
    # Enforce role hierarchy (Admins cannot invite higher roles than themselves)
    if ROLE_RANKS.get(invite_in.role, 0) > ROLE_RANKS.get(org_ctx.role, 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot invite users with roles superior to your own."
        )
        
    invite = await auth_service.create_invite(
        organization_id=org_ctx.organization_id,
        email=invite_in.email,
        role=invite_in.role,
        sender_id=current_user.id
    )
    await db.commit()
    return invite

@router.post("/invite/accept")
async def accept_team_invite(
    accept_in: OrgInviteAccept,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Accept team invite, joining organization membership."""
    auth_service = AuthService(db)
    try:
        member = await auth_service.accept_invite(accept_in.token, current_user.id)
        await db.commit()
        return {"detail": "Joined organization successfully", "organization_id": member.organization_id}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
