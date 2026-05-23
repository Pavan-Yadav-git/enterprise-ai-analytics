import uuid
import time
from fastapi import FastAPI, Request, Response, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.config import settings
from app.database import engine, init_db
from app.routers import auth, apikey, event, dashboard, alert, ws
import redis.asyncio as aioredis
import structlog

# Initialize structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(),
        structlog.processors.JSONRenderer()
    ]
)
logger = structlog.get_logger()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Middleware Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- OBSERVABILITY: CORRELATION IDS & REQUEST TRACING ---

@app.middleware("http")
async def add_request_tracing_and_logging(request: Request, call_next):
    """
    Middleware appending transaction tracking parameters:
    - X-Correlation-ID trace header
    - Response latencies tracking
    - Dynamic structured logger mapping
    """
    correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
    
    # Store correlation ID in context
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(correlation_id=correlation_id)
    
    start_time = time.time()
    
    # Process request
    response: Response = await call_next(request)
    
    duration = time.time() - start_time
    response.headers["X-Correlation-ID"] = correlation_id
    response.headers["X-Process-Time"] = f"{duration:.4f}s"
    
    logger.info(
        "Request completed",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration=f"{duration:.4f}s"
    )
    
    return response

# --- EXCEPTION HANDLERS ---

@app.exception_handler(ValueError)
async def value_error_exception_handler(request: Request, exc: ValueError):
    logger.warn("Centralized Value Error caught", error=str(exc))
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": str(exc)},
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled Server Exception caught", error=str(exc))
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Transaction trace archived."},
    )

# --- BIND ROUTERS ---

api_prefix = settings.API_V1_STR # /api/v1
app.include_router(auth.router, prefix=api_prefix)
app.include_router(apikey.router, prefix=api_prefix)
app.include_router(event.router, prefix=api_prefix)
app.include_router(dashboard.router, prefix=api_prefix)
app.include_router(alert.router, prefix=api_prefix)
# Bind WebSocket router at root prefix since WS protocols handle paths natively
app.include_router(ws.router, prefix=api_prefix)

# --- HEALTH CHECKS & BOOTSTRAPPING ---

@app.on_event("startup")
async def on_startup():
    logger.info("Service bootstrapping in progress")
    # Auto-seed database tables in standalone mode if Alembic wasn't run
    await init_db()
    logger.info("Database schemas fully synced")

@app.get("/health", tags=["Observability & Diagnostics"])
async def service_health_check():
    """Diagnostic check assessing database connectivity. Redis is checked
    as an optional component and does not affect the overall health status."""
    db_healthy = False
    redis_status = "unchecked"

    # 1. DB check — required for a healthy response
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_healthy = True
    except Exception as e:
        logger.error("Database connection check failed", error=str(e))

    # 2. Redis check — optional; unavailability is a warning, not a failure
    try:
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await r.ping()
        await r.close()
        redis_status = "healthy"
    except Exception as e:
        logger.warning("Redis ping check failed (non-critical)", error=str(e))
        redis_status = "unavailable"

    # Overall health is determined solely by PostgreSQL availability
    status_code = status.HTTP_200_OK if db_healthy else status.HTTP_503_SERVICE_UNAVAILABLE

    return JSONResponse(
        status_code=status_code,
        content={
            "status": "healthy" if db_healthy else "degraded",
            "components": {
                "postgresql": "healthy" if db_healthy else "unhealthy",
                "redis": redis_status
            }
        }
    )
