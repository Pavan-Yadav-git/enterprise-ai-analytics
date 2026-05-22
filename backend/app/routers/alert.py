import uuid
from typing import List
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.routers.auth import require_role, OrgContext
from app.schemas.alert import (
    AlertRuleCreate, AlertRuleUpdate, AlertRuleResponse, AlertHistoryResponse
)
from app.services.alert import AlertService

router = APIRouter(prefix="/alerts", tags=["Real-Time Alert Rules"])

@router.get("", response_model=List[AlertRuleResponse])
async def list_org_alert_rules(
    org_ctx: OrgContext = Depends(require_role("Viewer")),
    db: AsyncSession = Depends(get_db)
):
    """Lists configured metric alert conditions (Requires Viewer)."""
    service = AlertService(db)
    return await service.list_rules(org_ctx.organization_id)

@router.post("", response_model=AlertRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_org_alert_rule(
    rule_in: AlertRuleCreate,
    org_ctx: OrgContext = Depends(require_role("Analyst")),
    db: AsyncSession = Depends(get_db)
):
    """Creates a new threshold alert rule on a custom metric (Requires Analyst)."""
    service = AlertService(db)
    rule = await service.create_rule(org_ctx.organization_id, rule_in)
    await db.commit()
    return rule

@router.put("/{rule_id}", response_model=AlertRuleResponse)
async def update_org_alert_rule(
    rule_id: uuid.UUID,
    rule_update: AlertRuleUpdate,
    org_ctx: OrgContext = Depends(require_role("Analyst")),
    db: AsyncSession = Depends(get_db)
):
    """Edits target aggregations, thresholds, Slack channels, or toggle status (Requires Analyst)."""
    service = AlertService(db)
    rule = await service.repo.get_by_id_scoped(rule_id, org_ctx.organization_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert rule not found under this organization"
        )

    update_data = rule_update.model_dump(exclude_unset=True)
    
    # Process snooze if hours provided
    snooze_hours = update_data.pop("snooze_for_hours", None)
    if snooze_hours:
        rule.snoozed_until = datetime.utcnow() + timedelta(hours=snooze_hours)

    for field, val in update_data.items():
        setattr(rule, field, val)

    await service.repo.update(rule)
    await db.commit()
    return rule

@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_org_alert_rule(
    rule_id: uuid.UUID,
    org_ctx: OrgContext = Depends(require_role("Analyst")),
    db: AsyncSession = Depends(get_db)
):
    """Removes threshold alert condition (Requires Analyst)."""
    service = AlertService(db)
    success = await service.repo.delete_scoped(rule_id, org_ctx.organization_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert rule not found"
        )
    await db.commit()

@router.get("/history", response_model=List[AlertHistoryResponse])
async def view_alert_trigger_history(
    org_ctx: OrgContext = Depends(require_role("Viewer")),
    db: AsyncSession = Depends(get_db)
):
    """Fetch logs of historical metric alerts crossed (Requires Viewer)."""
    service = AlertService(db)
    return await service.history_repo.list_by_organization(org_ctx.organization_id)

@router.post("/{rule_id}/mute", response_model=AlertRuleResponse)
async def toggle_mute_alert_rule(
    rule_id: uuid.UUID,
    mute: bool,
    org_ctx: OrgContext = Depends(require_role("Analyst")),
    db: AsyncSession = Depends(get_db)
):
    """Mutes/Unmutes notifications for the alert condition (Requires Analyst)."""
    service = AlertService(db)
    rule = await service.repo.get_by_id_scoped(rule_id, org_ctx.organization_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert rule not found"
        )

    rule.status = "Muted" if mute else "Active"
    if not mute:
        rule.snoozed_until = None
        
    await service.repo.update(rule)
    await db.commit()
    return rule
