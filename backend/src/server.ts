import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import compression from "compression";
import { Server as SocketIOServer } from "socket.io";
import "./utils/asyncErrors.js";
import { router } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { performanceMiddleware } from "./middleware/performance.js";
import { isMailConfigured, verifyMailConnection } from "./config/mailer.js";
import { openApiSpec } from "./openapi.js";
import net from "net";

const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_CUSTOMER_URL?.split(",") ?? "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  },
});

// Attach io to app locals so services/controllers can emit events
app.locals.io = io;

// CORS: allow frontend origin and Authorization header so verify-invite and other API calls work from deployed frontend
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
  : undefined;
app.use(
  cors({
    origin: (origin, cb) => {
      // Non-browser requests (no Origin) should pass.
      if (!origin) return cb(null, true);
      if (!allowedOrigins || allowedOrigins.length === 0) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS: origin not allowed"));
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    credentials: true,
  }),
);
// Helmet with relaxed CSP so Swagger UI docs can load external JS/CSS bundles.
// This keeps defaults but allows the Swagger CDN domains.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // Allow Swagger UI assets and inline bootstrap script on /api/docs
        "script-src": [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://unpkg.com",
        ],
        "style-src": [
          "'self'",
          "https://cdn.jsdelivr.net",
          "https://unpkg.com",
          "https://fonts.googleapis.com",
        ],
        "img-src": ["'self'", "data:", "https://cdn.jsdelivr.net"],
      },
    },
  }),
);
app.use(cookieParser());
// Compression significantly reduces payload size for menu + dashboards (mobile networks).
app.use(compression());
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (_req, res) => res.status(200).send("OK"));

// OpenAPI / Swagger docs
app.get("/api/openapi.json", (_req, res) => {
  res.json(openApiSpec);
});

// Explicit OPTIONS (preflight) for all /api routes so POST /api/employees/:id/verify-and-send-invite works from frontend on Render etc.
app.use("/api", (req, res, next) => {
  if (req.method === "OPTIONS") {
    const origin =
      allowedOrigins?.length &&
      req.headers.origin &&
      allowedOrigins.includes(req.headers.origin)
        ? req.headers.origin
        : allowedOrigins?.length
          ? allowedOrigins[0]
          : req.headers.origin || "*";
    res.setHeader("Access-Control-Allow-Origin", String(origin));
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-CSRF-Token",
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Max-Age", "86400");
    return res.sendStatus(204);
  }
  next();
});

app.get("/api/docs", (_req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Gautam Nagar POS API Docs</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: "/api/openapi.json",
        dom_id: "#swagger-ui",
      });
    };
  </script>
</body>
</html>`;
  res.type("html").send(html);
});

// Record API performance (latency + traffic) for dashboard
app.use("/api", performanceMiddleware);
app.use("/api", router);

app.use(errorHandler);

// On Railway (and most platforms), PORT is injected and must be used as-is.
// Only use the fallback/port-scanning behavior when PORT is not provided (local dev).
const HAS_PLATFORM_PORT = typeof process.env.PORT === "string" && process.env.PORT.length > 0;
const DEFAULT_PORT = (HAS_PLATFORM_PORT ? Number(process.env.PORT) : 4000) || 4000;
const MAX_PORT_ATTEMPTS = 10;

// Function to check if a port is available
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once("error", () => resolve(false))
      .once("listening", () => {
        tester.close();
        resolve(true);
      })
      .listen(port);
  });
}

// Function to find an available port
async function findAvailablePort(startPort: number): Promise<number> {
  for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
    const port = startPort + i;
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`Could not find an available port after ${MAX_PORT_ATTEMPTS} attempts`);
}

// Start server with port fallback
async function startServer() {
  try {
    const port = HAS_PLATFORM_PORT ? DEFAULT_PORT : await findAvailablePort(DEFAULT_PORT);

    if (!HAS_PLATFORM_PORT && port !== DEFAULT_PORT) {
      console.log(`⚠️  Port ${DEFAULT_PORT} is in use. Using port ${port} instead.`);
    }

    // Keep logs minimal; use errors/warnings for operational issues.
    
    server.listen(port, "0.0.0.0", async () => {
      // For local development, skip failing on SMTP verification errors.
      if (isMailConfigured()) {
        verifyMailConnection()
          .catch((err: unknown) => {
            console.warn(
              "📧 Mail (SMTP) verification failed. Email features may not work until SMTP env vars are correct.",
              (err as Error)?.message || err,
            );
          });
      } else {
        // mail not configured
      }
      const { startAutoCloseCron } = await import("./services/shiftAutoClose.js");
      startAutoCloseCron();
      const { startPendingPaymentCron } = await import("./cron/pendingPaymentAlert.js");
      startPendingPaymentCron();
      const { startDailyDirectorReportCron } = await import("./cron/dailyDirectorReport.js");
      startDailyDirectorReportCron();
    });

    // Graceful shutdown
    process.on("SIGTERM", () => {
      server.close(() => process.exit(0));
    });

    process.on("SIGINT", () => {
      server.close(() => process.exit(0));
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Handle server errors
server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`❌ Port is already in use. Please kill the process using the port or change the PORT in .env`);
  } else {
    console.error("❌ Server error:", error);
  }
  process.exit(1);
});

export { app, startServer };

