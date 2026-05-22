import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    user_id: Optional[str] = None

# User Schemas
class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    org_name: Optional[str] = Field(None, description="If provided, creates a new organization during signup")

class UserLogin(UserBase):
    password: str

class UserResponse(UserBase):
    id: uuid.UUID
    is_active: bool
    is_google_user: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Organization Schemas
class OrganizationBase(BaseModel):
    name: str = Field(..., min_length=1)

class OrganizationCreate(OrganizationBase):
    pass

class OrganizationResponse(OrganizationBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# OrgMember Schemas
class OrgMemberResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    user: UserResponse
    role: str
    joined_at: datetime
    
    class Config:
        from_attributes = True

class MemberUpdateRole(BaseModel):
    role: str = Field(..., pattern="^(Owner|Admin|Analyst|Viewer)$")

# OrgInvite Schemas
class OrgInviteCreate(BaseModel):
    email: EmailStr
    role: str = Field("Viewer", pattern="^(Owner|Admin|Analyst|Viewer)$")

class OrgInviteResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    email: EmailStr
    role: str
    token: str
    expires_at: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True

class OrgInviteAccept(BaseModel):
    token: str
