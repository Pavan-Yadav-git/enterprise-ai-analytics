import uuid
import asyncio
from datetime import datetime
from typing import List, Dict, Any
from celery import Celery
from app.worker.celery_app import celery_app
from app.database import AsyncSessionLocal
from app.models.event import Event
from app.repositories.event import EventRepository
from app.services.alert import AlertService
from app.services.ws_manager import ws_manager
import structlog

logger = structlog.get_logger()

def run_async(coro):
    """Safely executes an async coroutine inside a synchronous Celery task thread."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)

@celery_app.task(name="tasks.process_event")
def process_event(event_data: Dict[str, Any]) -> str:
    """Ingest a single event asynchronously and notify connected WebSocket subscribers."""
    async def _task():
        async with AsyncSessionLocal() as db:
            repo = EventRepository(db)
            db_event = Event(
                organization_id=uuid.UUID(event_data["organization_id"]),
                event_name=event_data["event_name"],
                source_type=event_data["source_type"],
                payload=event_data["payload"],
                timestamp=datetime.fromisoformat(event_data["timestamp"])
            )
            await repo.create(db_event)
            await db.commit()
            
            # Broadcast the raw event immediately to WebSocket live consoles
            await ws_manager.broadcast_to_org(
                db_event.organization_id,
                {
                    "type": "new_event",
                    "id": str(db_event.id),
                    "event_name": db_event.event_name,
                    "source_type": db_event.source_type,
                    "payload": db_event.payload,
                    "timestamp": db_event.timestamp.isoformat()
                }
            )
            logger.info("Asynchronously ingested single event", event_name=db_event.event_name)

    run_async(_task())
    return "SUCCESS"

@celery_app.task(name="tasks.process_events_batch")
def process_events_batch(events_data: List[Dict[str, Any]]) -> str:
    """Ingest multiple events concurrently in bulk and broadcast updates."""
    async def _task():
        if not events_data:
            return
            
        async with AsyncSessionLocal() as db:
            repo = EventRepository(db)
            db_events = []
            
            for ed in events_data:
                db_event = Event(
                    organization_id=uuid.UUID(ed["organization_id"]),
                    event_name=ed["event_name"],
                    source_type=ed["source_type"],
                    payload=ed["payload"],
                    timestamp=datetime.fromisoformat(ed["timestamp"])
                )
                db_events.append(db_event)

            await repo.bulk_insert(db_events)
            await db.commit()
            
            # Broadcast batch updates or notifications
            # For brevity, we broadcast standard websocket counts
            for ev in db_events:
                await ws_manager.broadcast_to_org(
                    ev.organization_id,
                    {
                        "type": "new_event",
                        "id": str(ev.id),
                        "event_name": ev.event_name,
                        "source_type": ev.source_type,
                        "payload": ev.payload,
                        "timestamp": ev.timestamp.isoformat()
                    }
                )
            logger.info("Asynchronously ingested batch of events", count=len(db_events))

    run_async(_task())
    return f"SUCCESS_BATCH_{len(events_data)}"

@celery_app.task(name="tasks.evaluate_alerts")
def evaluate_alerts() -> str:
    """Scheduled cron task executing metrics check and firing alerts."""
    async def _task():
        async with AsyncSessionLocal() as db:
            alert_service = AlertService(db)
            await alert_service.evaluate_active_rules()
            await db.commit()
            logger.info("Alerts evaluation cron completed successfully")

    run_async(_task())
    return "SUCCESS_ALERTS_EVAL"
