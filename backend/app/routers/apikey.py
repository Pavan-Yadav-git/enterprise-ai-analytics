import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.routers.auth import require_role, OrgContext
from app.schemas.apikey import APIKeyCreate, APIKeyResponse
from app.services.apikey import APIKeyService

router = APIRouter(prefix="/keys", tags=["API Key Management"])

@router.post("", response_model=APIKeyResponse, status_code=status.HTTP_201_CREATED)
async def generate_org_api_key(
    key_in: APIKeyCreate,
    org_ctx: OrgContext = Depends(require_role("Admin")),
    db: AsyncSession = Depends(get_db)
):
    """Generates a secure API key for the organization (Requires Admin/Owner)."""
    service = APIKeyService(db)
    api_key = await service.generate_key(
        organization_id=org_ctx.organization_id,
        name=key_in.name,
        expires_in_days=key_in.expires_in_days
    )
    await db.commit()
    return api_key

@router.get("", response_model=List[APIKeyResponse])
async def list_org_api_keys(
    org_ctx: OrgContext = Depends(require_role("Analyst")),
    db: AsyncSession = Depends(get_db)
):
    """List all API keys belonging to the organization (Requires Analyst/Admin/Owner)."""
    service = APIKeyService(db)
    return await service.repo.list_by_organization(org_ctx.organization_id)

@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_org_api_key(
    key_id: uuid.UUID,
    org_ctx: OrgContext = Depends(require_role("Admin")),
    db: AsyncSession = Depends(get_db)
):
    """Revokes/deactivates an active organization API key (Requires Admin/Owner)."""
    service = APIKeyService(db)
    
    # Verify key belongs to active tenant
    api_key = await service.repo.get_by_id_scoped(key_id, org_ctx.organization_id)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API Key not found under this organization"
        )
        
    api_key.is_active = False
    await service.repo.update(api_key)
    await db.commit()
