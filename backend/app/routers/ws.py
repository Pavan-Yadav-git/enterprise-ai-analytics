import uuid
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.models.auth import OrgMember
from app.services.auth import AuthService
from app.services.ws_manager import ws_manager
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/ws", tags=["Real-Time WebSockets"])

@router.websocket("/{organization_id}")
async def websocket_realtime_tail(
    websocket: WebSocket,
    organization_id: uuid.UUID,
    token: Optional[str] = Query(None)
):
    """
    Subscribes client to real-time events feed.
    Token authentication is passed as query parameter for native browser compatibility.
    """
    if not token:
        logger.warn("WebSocket connection attempt missing token parameter")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Create isolated DB session for websocket lifecycle
    async with AsyncSessionLocal() as db:
        auth_service = AuthService(db)
        payload = auth_service.decode_token(token)
        if not payload:
            logger.warn("WebSocket connection rejected: Invalid JWT token")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        user_id_str = payload.get("sub")
        # Validate tenant membership
        result = await db.execute(
            select(OrgMember).filter(
                OrgMember.user_id == uuid.UUID(user_id_str),
                OrgMember.organization_id == organization_id
            )
        )
        if not result.scalars().first():
            logger.warn("WebSocket connection rejected: Membership invalid")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    # Register socket
    await ws_manager.connect(websocket, organization_id)
    
    try:
        while True:
            # Sockets tail only: we listen to keep connections alive and handle pings
            data = await websocket.receive_text()
            # If clients send pings, we can echo them
            await websocket.send_json({"type": "pong", "message": "Connection active"})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, organization_id)
        logger.info("WebSocket disconnected cleanly", organization_id=str(organization_id))
    except Exception as e:
        ws_manager.disconnect(websocket, organization_id)
        logger.error("WebSocket exception encountered", error=str(e))
