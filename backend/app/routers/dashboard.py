import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.routers.auth import require_role, OrgContext, get_current_active_user
from app.models.auth import User
from app.schemas.dashboard import (
    DashboardCreate, DashboardUpdate, DashboardResponse,
    WidgetCreate, WidgetUpdate, WidgetResponse
)
from app.services.dashboard import DashboardService

router = APIRouter(prefix="/dashboards", tags=["Custom Dashboards Builder"])

@router.get("", response_model=List[DashboardResponse])
async def list_org_dashboards(
    org_ctx: OrgContext = Depends(require_role("Viewer")),
    db: AsyncSession = Depends(get_db)
):
    """Lists all custom dashboards configured inside organization boundaries (Requires Viewer)."""
    service = DashboardService(db)
    return await service.list_dashboards(org_ctx.organization_id)

@router.get("/{dashboard_id}", response_model=DashboardResponse)
async def get_org_dashboard_details(
    dashboard_id: uuid.UUID,
    org_ctx: OrgContext = Depends(require_role("Viewer")),
    db: AsyncSession = Depends(get_db)
):
    """Fetch specific dashboard preloading all configured child widgets (Requires Viewer)."""
    service = DashboardService(db)
    dashboard = await service.get_dashboard(dashboard_id, org_ctx.organization_id)
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found under this organization"
        )
    return dashboard

@router.post("", response_model=DashboardResponse, status_code=status.HTTP_201_CREATED)
async def create_new_org_dashboard(
    dashboard_in: DashboardCreate,
    org_ctx: OrgContext = Depends(require_role("Analyst")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Spins up a new custom dashboard panel (Requires Analyst)."""
    service = DashboardService(db)
    dashboard = await service.create_dashboard(org_ctx.organization_id, dashboard_in, current_user.id)
    await db.commit()
    return dashboard

@router.post("/template", response_model=DashboardResponse, status_code=status.HTTP_201_CREATED)
async def seed_dashboard_from_template(
    template_name: str, # "Web Analytics", "Sales Funnel", "DevOps Monitoring"
    org_ctx: OrgContext = Depends(require_role("Analyst")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Seeds predefined widgets matching generic industry layouts with single click (Requires Analyst)."""
    service = DashboardService(db)
    try:
        dashboard = await service.create_from_template(org_ctx.organization_id, template_name, current_user.id)
        await db.commit()
        
        # Reload with pre-seeded widgets eager loaded
        full_dashboard = await service.get_dashboard(dashboard.id, org_ctx.organization_id)
        return full_dashboard
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.put("/{dashboard_id}", response_model=DashboardResponse)
async def update_org_dashboard(
    dashboard_id: uuid.UUID,
    dashboard_update: DashboardUpdate,
    org_ctx: OrgContext = Depends(require_role("Analyst")),
    db: AsyncSession = Depends(get_db)
):
    """Updates dashboard title, descriptions, or drag layouts (Requires Analyst)."""
    service = DashboardService(db)
    dashboard = await service.repo.get_by_id_scoped(dashboard_id, org_ctx.organization_id)
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )

    for field, val in dashboard_update.model_dump(exclude_unset=True).items():
        setattr(dashboard, field, val)

    await service.repo.update(dashboard)
    await db.commit()
    
    # Reload widgets
    return await service.get_dashboard(dashboard_id, org_ctx.organization_id)

@router.delete("/{dashboard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_org_dashboard(
    dashboard_id: uuid.UUID,
    org_ctx: OrgContext = Depends(require_role("Analyst")),
    db: AsyncSession = Depends(get_db)
):
    """Deletes custom dashboard and cascaded widgets (Requires Analyst)."""
    service = DashboardService(db)
    success = await service.repo.delete_scoped(dashboard_id, org_ctx.organization_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    await db.commit()

# --- WIDGET ENPOINTS ---

@router.post("/{dashboard_id}/widgets", response_model=WidgetResponse, status_code=status.HTTP_201_CREATED)
async def add_widget_to_dashboard(
    dashboard_id: uuid.UUID,
    widget_in: WidgetCreate,
    org_ctx: OrgContext = Depends(require_role("Analyst")),
    db: AsyncSession = Depends(get_db)
):
    """Adds a new analytics chart panel to dashboard (Requires Analyst)."""
    service = DashboardService(db)
    try:
        widget = await service.create_widget(org_ctx.organization_id, dashboard_id, widget_in)
        await db.commit()
        return widget
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.put("/{dashboard_id}/widgets/{widget_id}", response_model=WidgetResponse)
async def update_dashboard_widget(
    dashboard_id: uuid.UUID,
    widget_id: uuid.UUID,
    widget_update: WidgetUpdate,
    org_ctx: OrgContext = Depends(require_role("Analyst")),
    db: AsyncSession = Depends(get_db)
):
    """Updates chart queries, rendering titles, or sizes (Requires Analyst)."""
    service = DashboardService(db)
    
    # Assert dashboard belongs to organization
    dashboard = await service.repo.get_by_id_scoped(dashboard_id, org_ctx.organization_id)
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
        
    # Get widget
    widget = await service.widget_repo.get_by_id(widget_id)
    if not widget or widget.dashboard_id != dashboard_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found under this dashboard"
        )

    for field, val in widget_update.model_dump(exclude_unset=True).items():
        setattr(widget, field, val)

    await service.widget_repo.update(widget)
    await db.commit()
    return widget

@router.delete("/{dashboard_id}/widgets/{widget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_dashboard_widget(
    dashboard_id: uuid.UUID,
    widget_id: uuid.UUID,
    org_ctx: OrgContext = Depends(require_role("Analyst")),
    db: AsyncSession = Depends(get_db)
):
    """Deletes specific chart widget panel from dashboard layout (Requires Analyst)."""
    service = DashboardService(db)
    
    dashboard = await service.repo.get_by_id_scoped(dashboard_id, org_ctx.organization_id)
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
        
    widget = await service.widget_repo.get_by_id(widget_id)
    if not widget or widget.dashboard_id != dashboard_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found under this dashboard"
        )
        
    await db.delete(widget)
    await db.commit()
