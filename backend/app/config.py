from typing import List
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Real-Time Analytics Platform"
    API_V1_STR: str = "/api/v1"

    # Security
    SECRET_KEY: str = "super-secret-jwt-signing-key-for-development-change-in-prod"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Databases
    # Explicitly bound to the DATABASE_URL environment variable so that
    # Railway's injected value always takes precedence over the local default.
    # The validator below rewrites bare postgresql:// URLs to use the asyncpg
    # driver scheme required by SQLAlchemy's async engine.
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/analytics",
        validation_alias="DATABASE_URL",
    )
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        validation_alias="REDIS_URL",
    )

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def ensure_asyncpg_scheme(cls, v: str) -> str:
        """
        Railway (and most PaaS providers) set DATABASE_URL with the plain
        'postgresql://' or 'postgres://' scheme.  SQLAlchemy's async engine
        requires 'postgresql+asyncpg://'.  Rewrite the scheme here so the
        app works regardless of which format the environment provides.
        """
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+asyncpg://", 1)
        elif v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://vercel.app",
    ]

    # Mail Config (Fallback to stdout logging if not set)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "alerts@analyticsplatform.com"

    # Ingestion rate limit defaults (events per minute per api_key/organization)
    DEFAULT_RATE_LIMIT_LIMIT: int = 1000
    DEFAULT_RATE_LIMIT_WINDOW: int = 60

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        # Keep case-sensitive matching so DATABASE_URL != database_url.
        case_sensitive=True,
        # Allow the validation_alias fields above to be populated from env vars.
        populate_by_name=True,
        extra="ignore",
    )

settings = Settings()
