import { useEffect, useRef, useState, useCallback } from "react";
import { useStore } from "@/store/useStore";

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export function useWebSocket(onMessageReceived?: (msg: WebSocketMessage) => void) {
  const { token, organization } = useStore();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef(1000); // Start at 1s delay

  const connect = useCallback(() => {
    if (!token || !organization) return;
    
    // Close existing socket if any
    if (socketRef.current) {
      socketRef.current.close();
    }

    const wsUrl = `ws://localhost:8000/api/v1/ws/${organization.id}?token=${token}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectDelayRef.current = 1000; // Reset delay
      console.log("WebSocket connection established");
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        if (onMessageReceived) {
          onMessageReceived(message);
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message", e);
      }
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      socketRef.current = null;
      
      // Don't reconnect if closed cleanly by client
      if (event.code !== 1000) {
        console.log(`WebSocket closed: reconnecting in ${reconnectDelayRef.current}ms...`);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30000); // exponential backoff cap 30s
          connect();
        }, reconnectDelayRef.current);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error", error);
      ws.close();
    };
  }, [token, organization, onMessageReceived]);

  useEffect(() => {
    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close(1000, "Component unmounted");
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  const sendMessage = useCallback((msg: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { isConnected, sendMessage };
}
