import { useEffect, useRef, useState, useCallback } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost/ws";

type WsStatus = "connecting" | "open" | "closed" | "error";

export function useWebSocket(path: string, onMessage: (data: string) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WsStatus>("connecting");

  const connect = useCallback(() => {
    const url = `${WS_URL}${path}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setStatus("open");
    ws.onclose = () => setStatus("closed");
    ws.onerror = () => setStatus("error");
    ws.onmessage = (e) => onMessage(e.data as string);
  }, [path, onMessage]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return { status };
}
