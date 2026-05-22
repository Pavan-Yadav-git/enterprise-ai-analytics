from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

# Create async engine. SQLAlchemy 2.0 supports asyncpg.
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=False
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    class_=AsyncSession
)

class Base(DeclarativeBase):
    """Base class for all SQLAlchemy database models."""
    pass

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency injection helper for database sessions in FastAPI routes."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
            
async def init_db() -> None:
    """Convenience helper to create database tables (useful for fast-setup without alembic)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
