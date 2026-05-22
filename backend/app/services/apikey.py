import uuid
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.apikey import APIKey
from app.repositories.apikey import APIKeyRepository

class APIKeyService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = APIKeyRepository(db)

    def _hash_key(self, raw_key: str) -> str:
        """Hashed values are stored using SHA-256 for secure verification."""
        return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    async def generate_key(
        self,
        organization_id: uuid.UUID,
        name: str,
        expires_in_days: Optional[int] = None
    ) -> APIKey:
        """
        Generates a secure API key with structure: pk_live_<32 hex chars>.
        Only returns the raw key ONCE upon creation.
        """
        random_part = secrets.token_hex(16) # 32 characters
        raw_key = f"pk_live_{random_part}"
        key_prefix = raw_key[:16] # "pk_live_..." first 16 chars
        key_hash = self._hash_key(raw_key)

        expires_at = None
        if expires_in_days:
            expires_at = datetime.utcnow() + timedelta(days=expires_in_days)

        api_key = APIKey(
            organization_id=organization_id,
            name=name,
            key_prefix=key_prefix,
            key_hash=key_hash,
            expires_at=expires_at
        )

        await self.repo.create(api_key)
        
        # Inject raw key dynamically for single reveal
        api_key.raw_key = raw_key
        return api_key

    async def verify_key(self, api_key_str: str) -> Optional[APIKey]:
        """
        Decodes and verifies an API key from requests.
        Ensures active state and checks expiration boundaries.
        """
        if not api_key_str.startswith("pk_live_"):
            return None

        # Hash and check DB match
        key_hash = self._hash_key(api_key_str)
        key = await self.repo.get_by_hash(key_hash)
        
        if not key:
            return None
            
        # Verify expiration
        if key.expires_at and key.expires_at < datetime.utcnow():
            return None

        return key
