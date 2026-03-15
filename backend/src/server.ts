import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { Server as SocketIOServer } from "socket.io";
import "./utils/asyncErrors.js";
import { router } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { isMailConfigured, verifyMailConnection } from "./config/mailer.js";
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

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api", router);

app.use(errorHandler);

const DEFAULT_PORT = Number(process.env.PORT) || 4000;
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
    const port = await findAvailablePort(DEFAULT_PORT);
    
    if (port !== DEFAULT_PORT) {
      console.log(`⚠️  Port ${DEFAULT_PORT} is in use. Using port ${port} instead.`);
    }
    
    server.listen(port, async () => {
      console.log(`✅ Backend server listening on port ${port}`);
      console.log(`📡 API Base URL: http://localhost:${port}/api`);
      if (isMailConfigured()) {
        verifyMailConnection()
          .then(() => console.log("📧 Mail (SMTP) connection verified"))
          .catch((err: unknown) => console.error("📧 Mail (SMTP) verification failed:", (err as Error)?.message || err));
      } else {
        console.log("📧 Mail not configured (EMAIL_SMTP_* / EMAIL_FROM_ADDRESS missing)");
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
      console.log("SIGTERM received. Shutting down gracefully...");
      server.close(() => {
        console.log("Server closed");
        process.exit(0);
      });
    });

    process.on("SIGINT", () => {
      console.log("SIGINT received. Shutting down gracefully...");
      server.close(() => {
        console.log("Server closed");
        process.exit(0);
      });
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

