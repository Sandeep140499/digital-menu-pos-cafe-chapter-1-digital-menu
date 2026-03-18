import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/constants";

export type OrderStatusStreamPayload = {
  id: number;
  status: string;
  acceptedAt?: string | null;
  completedAt?: string | null;
  updatedAt?: string | null;
};

export function useOrderStatusStream(orderId: number | null, enabled = true) {
  const [payload, setPayload] = useState<OrderStatusStreamPayload | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const streamUrl = useMemo(() => {
    if (!orderId) return null;
    return `${API_BASE_URL}/orders/${orderId}/stream`;
  }, [orderId]);

  useEffect(() => {
    if (!enabled || !streamUrl) return;
    if (typeof window === "undefined") return;
    if (typeof EventSource === "undefined") return;

    let es: EventSource | null = null;
    let reconnectTimer: number | null = null;

    const connect = () => {
      es = new EventSource(streamUrl, { withCredentials: true });
      setIsConnected(true);

      es.addEventListener("snapshot", (e) => {
        try {
          setPayload(JSON.parse((e as MessageEvent).data));
        } catch {
          // ignore bad payload
        }
      });

      es.addEventListener("status", (e) => {
        try {
          setPayload(JSON.parse((e as MessageEvent).data));
        } catch {
          // ignore bad payload
        }
      });

      es.addEventListener("error", () => {
        setIsConnected(false);
        try {
          es?.close();
        } catch {
          // ignore
        }
        es = null;
        // Basic backoff reconnect (SSE reconnect is also built-in, but proxies can kill connections).
        if (reconnectTimer == null) {
          reconnectTimer = window.setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, 1500);
        }
      });
    };

    connect();

    return () => {
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      try {
        es?.close();
      } catch {
        // ignore
      }
      setIsConnected(false);
    };
  }, [enabled, streamUrl]);

  return { payload, isConnected, streamUrl };
}

