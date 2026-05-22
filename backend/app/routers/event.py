import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis
from app.config import settings
from app.database import get_db
from app.routers.auth import require_role, OrgContext
from app.schemas.event import EventCreate, EventBatchCreate, EventResponse, QueryResult
from app.services.event import EventService
from app.services.apikey import APIKeyService
from app.services.auth import AuthService
from app.models.auth import OrgMember
from sqlalchemy import select
import structlog


logger = structlog.get_logger()
router = APIRouter(prefix="/events", tags=["Event Ingestion & Analytics"])

security = HTTPBearer(auto_error=False)

# Lazy Redis client initialization
redis_client: Optional[aioredis.Redis] = None

def get_redis_client() -> Optional[aioredis.Redis]:
    global redis_client
    if redis_client is None:
        try:
            redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        except Exception as e:
            logger.warn("Failed to connect to Redis for Rate Limiting", error=str(e))
    return redis_client

# --- SECURITY DEPENDENCY ---

async def get_ingestion_org_id(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_org_id: Optional[str] = Header(None, alias="X-Org-ID"),
    db: AsyncSession = Depends(get_db)
) -> uuid.UUID:
    """
    Authenticates ingestion source.
    Accepts:
    1. Authorization: Bearer pk_live_... (API key)
    2. Authorization: Bearer <JWT> + X-Org-ID Header (User context)
    """
    if not auth:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization bearer token"
        )

    token = auth.credentials

    # Case A: API Key Ingestion
    if token.startswith("pk_live_"):
        key_service = APIKeyService(db)
        key_record = await key_service.verify_key(token)
        if not key_record:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired API Key"
            )
        return key_record.organization_id

    # Case B: JWT Token Ingestion
    auth_service = AuthService(db)
    payload = auth_service.decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid JWT access token"
        )
        
    user_id_str = payload.get("sub")
    if not user_id_str or not x_org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="JWT ingestion requires a valid session and X-Org-ID context header"
        )
        
    # Verify membership
    org_uuid = uuid.UUID(x_org_id)
    result = await db.execute(
        select(OrgMember).filter(
            OrgMember.user_id == uuid.UUID(user_id_str),
            OrgMember.organization_id == org_uuid
        )
    )
    if not result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to specified organization context"
        )
        
    return org_uuid

# --- RATE LIMITING DECORATOR ---

async def enforce_ingest_rate_limiting(org_id: uuid.UUID) -> None:
    """Redis-based rolling rate-limiter, bounding requests to 1000 per minute per tenant."""
    r = get_redis_client()
    if r is None:
        return # Skip if redis is unavailable (fail open safely in standalone environments)

    key = f"rate:{str(org_id)}"
    try:
        # Fixed 1-minute window
        current = await r.get(key)
        if current and int(current) > settings.DEFAULT_RATE_LIMIT_LIMIT:
            logger.warn("Rate limit breached", organization_id=str(org_id))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Ingestion rate limit exceeded. Max 1000 events/minute."
            )
            
        async with r.pipeline(transaction=True) as pipe:
            await pipe.incr(key)
            await pipe.expire(key, settings.DEFAULT_RATE_LIMIT_WINDOW)
            await pipe.execute()
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Rate limiter Redis exception", error=str(e))

# --- ENDPOINTS ---

@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def ingest_single_event(
    event: EventCreate,
    org_id: uuid.UUID = Depends(get_ingestion_org_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Accepts and validates a single event, then queues ingestion asynchronously.
    Supports API Key or User contexts.
    """
    await enforce_ingest_rate_limiting(org_id)
    service = EventService(db)
    await service.ingest_event_async(org_id, event, source_type="api")
    return {"status": "queued", "message": "Event received and queued for ingestion"}

@router.post("/batch", status_code=status.HTTP_202_ACCEPTED)
async def ingest_batch_events(
    batch: EventBatchCreate,
    org_id: uuid.UUID = Depends(get_ingestion_org_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Accepts and validates up to 1000 events, pushing batch tasks to Celery.
    """
    await enforce_ingest_rate_limiting(org_id)
    service = EventService(db)
    await service.ingest_events_batch_async(org_id, batch.events, source_type="api")
    return {"status": "queued", "message": f"Batch of {len(batch.events)} events queued for ingestion"}

@router.post("/upload-csv", status_code=status.HTTP_202_ACCEPTED)
async def upload_csv_events(
    file: UploadFile = File(...),
    org_ctx: OrgContext = Depends(require_role("Analyst")),
    db: AsyncSession = Depends(get_db)
):
    """
    Accepts an uploaded CSV file containing events, parses fields, and inserts asynchronously.
    Columns expected: 'event_name', and other headers packed into dynamic payloads.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File type invalid. Please upload standard CSV."
        )
        
    contents = await file.read()
    csv_string = contents.decode("utf-8")
    
    service = EventService(db)
    count = await service.process_csv_upload(org_ctx.organization_id, csv_string)
    
    return {"status": "queued", "message": f"Successfully parsed and queued {count} events for ingestion"}

@router.post("/webhook/{source}", status_code=status.HTTP_202_ACCEPTED)
async def ingest_webhook_event(
    source: str,
    payload: Dict[str, Any],
    org_id: uuid.UUID = Depends(get_ingestion_org_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Catch-all generic webhook receiver. Translates payload into source standard event.
    """
    await enforce_ingest_rate_limiting(org_id)
    service = EventService(db)
    await service.process_webhook_payload(org_id, source, payload)
    return {"status": "queued", "message": f"Webhook payload for {source} received and queued"}

# --- ANALYTICS/STATS QUERIES ---

@router.get("/stats")
async def get_ingest_stats_overview(
    org_ctx: OrgContext = Depends(require_role("Viewer")),
    db: AsyncSession = Depends(get_db)
):
    """Fetch high-level overview metrics for main dashboard dashboard."""
    service = EventService(db)
    stats = await service.repo.get_overview_stats(org_ctx.organization_id)
    return stats

@router.get("/query", response_model=QueryResult)
async def query_custom_metrics(
    widget_id: uuid.UUID,
    event_name: str,
    aggregation: str,
    field_key: Optional[str] = None,
    groupby: Optional[str] = None,
    time_range: str = "24h",
    org_ctx: OrgContext = Depends(require_role("Viewer")),
    db: AsyncSession = Depends(get_db)
):
    """
    Evaluates a saved query against historical time-series logs.
    Supported time range inputs: '15m', '1h', '24h', '7d', '30d'.
    """
    service = EventService(db)
    
    # Calculate time range bounds
    end_time = datetime.utcnow()
    if time_range == "15m":
        start_time = end_time - timedelta(minutes=15)
    elif time_range == "1h":
        start_time = end_time - timedelta(hours=1)
    elif time_range == "24h":
        start_time = end_time - timedelta(hours=24)
    elif time_range == "7d":
        start_time = end_time - timedelta(days=7)
    elif time_range == "30d":
        start_time = end_time - timedelta(days=30)
    else:
        start_time = end_time - timedelta(hours=24) # fallback default

    data = await service.repo.get_aggregation(
        organization_id=org_ctx.organization_id,
        event_name=event_name,
        aggregation_type=aggregation,
        field_key=field_key,
        groupby_key=groupby,
        start_time=start_time,
        end_time=end_time
    )

    return QueryResult(
        widget_id=widget_id,
        title=f"{aggregation.capitalize()} of {event_name}",
        type="line" if not groupby else "bar",
        data=data
    )
