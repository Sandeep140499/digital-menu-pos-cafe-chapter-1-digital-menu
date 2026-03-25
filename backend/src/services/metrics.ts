import client from "prom-client";

// Centralized Prometheus metrics registry.
export const promRegistry = new client.Registry();

// Default node/process metrics (event loop, memory, GC, etc.)
client.collectDefaultMetrics({ register: promRegistry });

export const httpRequestDurationMs = new client.Histogram({
  name: "http_request_duration_ms",
  help: "HTTP request duration in ms",
  labelNames: ["method", "path", "status", "actor"] as const,
  buckets: [5, 10, 25, 50, 100, 200, 400, 800, 1500, 3000, 6000, 12000, 25000],
  registers: [promRegistry],
});

export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "HTTP requests total",
  labelNames: ["method", "path", "status", "actor"] as const,
  registers: [promRegistry],
});

export const activeSocketConnections = new client.Gauge({
  name: "socketio_active_connections",
  help: "Active Socket.IO connections",
  registers: [promRegistry],
});

export const prismaQueryDurationMs = new client.Histogram({
  name: "prisma_query_duration_ms",
  help: "Prisma query duration in ms",
  labelNames: ["model", "action"] as const,
  buckets: [1, 2.5, 5, 10, 25, 50, 100, 200, 400, 800, 1500, 3000],
  registers: [promRegistry],
});

let activeSocketsValue = 0;
export function setActiveSockets(n: number) {
  activeSocketsValue = Math.max(0, Math.floor(n));
  activeSocketConnections.set(activeSocketsValue);
}
export function getActiveSocketsValue() {
  return activeSocketsValue;
}

