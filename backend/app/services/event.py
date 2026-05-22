import uuid
import csv
import json
from io import StringIO
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.event import Event
from app.repositories.event import EventRepository
from app.schemas.event import EventCreate
from app.services.ws_manager import ws_manager
from celery import Celery
import structlog

logger = structlog.get_logger()

# Connection to Celery broker (matching redis config)
celery_app = Celery("tasks", broker="redis://localhost:6379/0")

class EventService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = EventRepository(db)

    async def ingest_event_async(self, organization_id: uuid.UUID, event_in: EventCreate, source_type: str = "api") -> None:
        """
        Asynchronously ingest a single event by forwarding the payload to the Celery Redis queue.
        """
        timestamp_str = event_in.timestamp.isoformat() if event_in.timestamp else datetime.utcnow().isoformat()
        task_payload = {
            "organization_id": str(organization_id),
            "event_name": event_in.event_name,
            "source_type": source_type,
            "payload": event_in.payload,
            "timestamp": timestamp_str
        }
        
        # Offload parsing and DB insertion completely from the request loop
        try:
            # Send using exact celery task name string to prevent package dependency loops
            celery_app.send_task("tasks.process_event", args=[task_payload])
        except Exception as e:
            logger.error("Failed to push task to Celery. Falling back to synchronous insert", error=str(e))
            # Fallback for testing/standalone runs without redis/celery running
            db_event = Event(
                organization_id=organization_id,
                event_name=event_in.event_name,
                source_type=source_type,
                payload=event_in.payload,
                timestamp=event_in.timestamp or datetime.utcnow()
            )
            await self.repo.create(db_event)

    async def ingest_events_batch_async(self, organization_id: uuid.UUID, events_in: List[EventCreate], source_type: str = "api") -> None:
        """
        Asynchronously ingest a batch of events by forwarding payloads to Celery.
        """
        task_payloads = []
        for ev in events_in:
            timestamp_str = ev.timestamp.isoformat() if ev.timestamp else datetime.utcnow().isoformat()
            task_payloads.append({
                "organization_id": str(organization_id),
                "event_name": ev.event_name,
                "source_type": source_type,
                "payload": ev.payload,
                "timestamp": timestamp_str
            })

        try:
            celery_app.send_task("tasks.process_events_batch", args=[task_payloads])
        except Exception as e:
            logger.error("Failed to push batch task to Celery. Falling back to synchronous insert", error=str(e))
            # Fallback
            db_events = [
                Event(
                    organization_id=organization_id,
                    event_name=ev.event_name,
                    source_type=source_type,
                    payload=ev.payload,
                    timestamp=ev.timestamp or datetime.utcnow()
                )
                for ev in events_in
            ]
            await self.repo.bulk_insert(db_events)

    async def process_csv_upload(self, organization_id: uuid.UUID, csv_content: str) -> int:
        """
        Parses raw CSV content.
        CSV Columns expected: event_name, timestamp (optional), and dynamic columns mapped into payload.
        """
        f = StringIO(csv_content)
        reader = csv.DictReader(f)
        
        events_to_ingest = []
        
        for row in reader:
            event_name = row.pop("event_name", None) or row.pop("Event Name", None) or "csv_import"
            
            # Clean event name to match validation regex
            clean_name = "".join(c for c in event_name if c.isalnum() or c in "_.-")
            if not clean_name:
                clean_name = "csv_import"
                
            timestamp_val = row.pop("timestamp", None) or row.pop("Timestamp", None)
            parsed_timestamp = None
            if timestamp_val:
                try:
                    parsed_timestamp = datetime.fromisoformat(timestamp_val)
                except ValueError:
                    pass
            
            # Pack all remaining headers into dynamic payload dict
            payload = {}
            for k, v in row.items():
                if k is not None:
                    # Attempt type conversion
                    try:
                        if v.lower() in ("true", "false"):
                            payload[k] = v.lower() == "true"
                        elif "." in v:
                            payload[k] = float(v)
                        else:
                            payload[k] = int(v)
                    except ValueError:
                        payload[k] = v # fallback to string

            events_to_ingest.append(
                EventCreate(
                    event_name=clean_name,
                    payload=payload,
                    timestamp=parsed_timestamp
                )
            )

        # Offload ingestion asynchronously to Celery
        if events_to_ingest:
            await self.ingest_events_batch_async(organization_id, events_to_ingest, source_type="csv")
            
        return len(events_to_ingest)

    async def process_webhook_payload(self, organization_id: uuid.UUID, source: str, raw_payload: Dict[str, Any]) -> None:
        """
        Transforms custom webhook structures into standard events.
        Useful for Stripe, Github, or Slack events.
        """
        # Standard format translation
        event_name = f"webhook_{source}"
        
        # If payload specifies its own type (e.g. Stripe has "type": "payment_intent.succeeded")
        if "type" in raw_payload:
            event_name = f"{source}_{raw_payload['type']}"
        elif "event" in raw_payload:
            event_name = f"{source}_{raw_payload['event']}"

        event_create = EventCreate(
            event_name=event_name,
            payload=raw_payload,
            timestamp=datetime.utcnow()
        )
        
        await self.ingest_event_async(organization_id, event_create, source_type="webhook")
