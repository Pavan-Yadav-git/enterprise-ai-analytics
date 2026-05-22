import uuid
from typing import Dict, Set, Any
from fastapi import WebSocket
import structlog

logger = structlog.get_logger()

class WebSocketManager:
    """Manages active WebSockets connections, segregated by organization channels."""
    
    def __init__(self):
        # Maps organization_id to a set of active WebSockets
        self.active_connections: Dict[uuid.UUID, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, organization_id: uuid.UUID) -> None:
        """Register a new WebSocket connection."""
        await websocket.accept()
        if organization_id not in self.active_connections:
            self.active_connections[organization_id] = set()
        self.active_connections[organization_id].add(websocket)
        logger.info("WebSocket connected", organization_id=str(organization_id), connection_count=len(self.active_connections[organization_id]))

    def disconnect(self, websocket: WebSocket, organization_id: uuid.UUID) -> None:
        """Deregister an active WebSocket connection."""
        if organization_id in self.active_connections:
            self.active_connections[organization_id].discard(websocket)
            if not self.active_connections[organization_id]:
                del self.active_connections[organization_id]
        logger.info("WebSocket disconnected", organization_id=str(organization_id))

    async def broadcast_to_org(self, organization_id: uuid.UUID, message: Dict[str, Any]) -> None:
        """Send JSON payload to all active clients registered under the organization."""
        if organization_id not in self.active_connections:
            return

        dead_connections = set()
        for websocket in self.active_connections[organization_id]:
            try:
                await websocket.send_json(message)
            except Exception as e:
                # Connection might have dropped without clean closure
                logger.warn("WebSocket send failed, marking for cleanup", error=str(e))
                dead_connections.add(websocket)

        # Clean up dead sockets
        for websocket in dead_connections:
            self.disconnect(websocket, organization_id)

ws_manager = WebSocketManager()
