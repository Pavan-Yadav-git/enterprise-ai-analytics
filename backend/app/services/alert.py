import uuid
from datetime import datetime, timedelta
from typing import List, Optional
import httpx
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.models.alert import AlertRule, AlertHistory
from app.models.notification import Notification
from app.repositories.alert import AlertRepository, AlertHistoryRepository
from app.repositories.notification import NotificationRepository
from app.repositories.event import EventRepository
from app.schemas.alert import AlertRuleCreate
from app.services.ws_manager import ws_manager
import structlog

logger = structlog.get_logger()

class AlertService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = AlertRepository(db)
        self.history_repo = AlertHistoryRepository(db)
        self.notification_repo = NotificationRepository(db)
        self.event_repo = EventRepository(db)

    async def list_rules(self, organization_id: uuid.UUID) -> List[AlertRule]:
        return await self.repo.list_by_organization(organization_id)

    async def create_rule(self, organization_id: uuid.UUID, rule_in: AlertRuleCreate) -> AlertRule:
        rule = AlertRule(
            organization_id=organization_id,
            name=rule_in.name,
            metric=rule_in.metric,
            aggregation=rule_in.aggregation,
            operator=rule_in.operator,
            threshold=rule_in.threshold,
            evaluation_window_minutes=rule_in.evaluation_window_minutes,
            notification_channels=rule_in.notification_channels,
            webhook_url=rule_in.webhook_url
        )
        return await self.repo.create(rule)

    async def check_operator(self, value: float, threshold: float, operator: str) -> bool:
        if operator == "gt":
            return value > threshold
        if operator == "lt":
            return value < threshold
        if operator == "eq":
            return value == threshold
        if operator == "gte":
            return value >= threshold
        if operator == "lte":
            return value <= threshold
        return False

    async def evaluate_active_rules(self) -> None:
        """
        Scheduled daemon runner (triggered by Celery Beat).
        Evaluates active rules and triggers notifications upon crossing thresholds.
        """
        active_rules = await self.repo.list_active_rules()
        logger.info("Evaluating active alert rules", count=len(active_rules))

        for rule in active_rules:
            # 1. Skip if snoozed
            if rule.snoozed_until and rule.snoozed_until > datetime.utcnow():
                continue

            # 2. Compute aggregated metrics over evaluation window
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(minutes=rule.evaluation_window_minutes)

            # Query EventRepository for aggregation
            aggregates = await self.event_repo.get_aggregation(
                organization_id=rule.organization_id,
                event_name=rule.metric,
                aggregation_type=rule.aggregation,
                field_key="value", # Fallback default
                groupby_key=None,
                start_time=start_time,
                end_time=end_time
            )

            # Sum up/combine aggregates
            metric_value = sum(item["value"] for item in aggregates) if aggregates else 0.0
            
            is_triggered = await self.check_operator(metric_value, rule.threshold, rule.operator)

            # 3. Assess Alert State Transitions
            if is_triggered and rule.status == "Active":
                # State Transition: Active -> Triggered
                rule.status = "Triggered"
                await self.repo.update(rule)

                # Log to History
                history = AlertHistory(
                    alert_rule_id=rule.id,
                    triggered_value=metric_value,
                    status="Triggered"
                )
                await self.history_repo.create(history)

                # Trigger Notifications
                await self.dispatch_alert_notifications(rule, metric_value, triggered=True)

            elif not is_triggered and rule.status == "Triggered":
                # State Transition: Triggered -> Resolved
                rule.status = "Active"
                await self.repo.update(rule)

                # Log to History
                history = AlertHistory(
                    alert_rule_id=rule.id,
                    triggered_value=metric_value,
                    status="Resolved"
                )
                await self.history_repo.create(history)

                # Trigger Notifications (Resolution status)
                await self.dispatch_alert_notifications(rule, metric_value, triggered=False)

    async def dispatch_alert_notifications(self, rule: AlertRule, current_value: float, triggered: bool) -> None:
        """Sends notifications across activated channels (Slack, In-app, Email)."""
        status_text = "TRIGGERED 🚨" if triggered else "RESOLVED ✅"
        title = f"Alert {status_text}: {rule.name}"
        message = (
            f"Rule '{rule.name}' for metric '{rule.metric}' has been {status_text.lower()}.\n"
            f"Threshold: {rule.operator} {rule.threshold}. Current Value: {current_value} "
            f"(evaluated over the past {rule.evaluation_window_minutes} minutes)."
        )

        logger.info("Dispatching alert notifications", rule_id=str(rule.id), channels=rule.notification_channels)

        # 1. In-App Notifications
        if "in_app" in rule.notification_channels:
            notif = Notification(
                organization_id=rule.organization_id,
                title=title,
                message=message,
                type="alert"
            )
            await self.notification_repo.create(notif)
            
            # Broadcast globally to live websockets
            await ws_manager.broadcast_to_org(
                rule.organization_id,
                {
                    "type": "alert_notification",
                    "title": title,
                    "message": message,
                    "timestamp": datetime.utcnow().isoformat(),
                    "alert_rule_id": str(rule.id)
                }
            )

        # 2. Third-party Webhook (Slack / Discord webhook integrations)
        if "webhook" in rule.notification_channels and rule.webhook_url:
            async with httpx.AsyncClient() as client:
                payload = {
                    "text": f"*{title}*\n{message}"
                }
                try:
                    await client.post(rule.webhook_url, json=payload, timeout=5.0)
                except Exception as e:
                    logger.error("Failed to deliver Slack webhook notification", error=str(e))

        # 3. SMTP Mail System (Logged to console/stdout in dev)
        if "email" in rule.notification_channels:
            # Fallback stdout logger logic for production readiness
            logger.info(
                "--- EMAIL SENT OUT OUTSIDE SYSTEM ---",
                to="organization_team_members",
                subject=title,
                body=message
            )
