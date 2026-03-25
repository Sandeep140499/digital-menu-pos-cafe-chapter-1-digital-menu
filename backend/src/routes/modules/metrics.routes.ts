import { Router } from "express";
import { promRegistry, getActiveSocketsValue } from "../../services/metrics.js";
import { perfStore } from "../../middleware/performance.js";

export const metricsRouter = Router();

function isAuthorized(req: import("express").Request): boolean {
  const token = process.env.METRICS_TOKEN ? String(process.env.METRICS_TOKEN) : "";
  if (!token) return false;
  const header = String(req.headers.authorization || "");
  if (header.startsWith("Bearer ") && header.slice(7) === token) return true;
  if (req.query.token && String(req.query.token) === token) return true;
  return false;
}

// Prometheus scrape endpoint (recommended: protect with METRICS_TOKEN)
metricsRouter.get("/", async (req, res) => {
  // In dev, allow without token. In production, require token.
  if (process.env.NODE_ENV === "production" && !isAuthorized(req)) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  res.setHeader("Content-Type", promRegistry.contentType);
  return res.send(await promRegistry.metrics());
});

// Lightweight JSON summary for the Admin dashboard (no Prometheus needed)
metricsRouter.get("/summary", async (req, res) => {
  // This endpoint is used by the Admin UI; keep it available without token
  // but don't leak detailed internal labels.
  const windowMinutes = Math.min(Math.max(Number(req.query.windowMinutes) || 60, 1), 24 * 60);
  const data = perfStore.summarize({ windowMs: windowMinutes * 60 * 1000, top: 10 });
  const rpm = data.windowMs > 0 ? (data.totalCount / data.windowMs) * 60_000 : 0;
  return res.json({
    now: Date.now(),
    windowMinutes,
    http: {
      rpm: Math.round(rpm * 10) / 10,
      totalCount: data.totalCount,
      totalErrorCount: data.totalErrorCount,
      totalBytesSent: data.totalBytesSent,
      top: data.rows.map((r) => ({
        key: r.key,
        count: r.count,
        errorCount: r.errorCount,
        avgMs: Math.round(r.avgMs),
        p50Ms: Math.round(r.p50Ms),
        p95Ms: Math.round(r.p95Ms),
        maxMs: Math.round(r.maxMs),
      })),
    },
    socketio: {
      activeConnections: getActiveSocketsValue(),
    },
  });
});

