import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

// Load env vars from file for local/dev. On Railway/Render/etc, platform env vars are injected
// and this will simply merge (without overriding existing env by default).
const envMode = (process.env.NODE_ENV || "development").trim();
const envFile =
  envMode === "production" ? ".env.production" : ".env";
const envPath = path.resolve(process.cwd(), envFile);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // Fallback: keep prior behavior (.env) when running locally without .env.production
  dotenv.config();
}

// Log the real error so we can fix backend crash (was showing [Object: null prototype])
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  // In development, keep process alive so hot-reload/dev server doesn't die on one request.
  // In production, crash fast so the platform restarts the process.
  if (process.env.NODE_ENV !== "development") {
    process.exit(1);
  }
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection. Reason:", reason);
  if (process.env.NODE_ENV !== "development") {
    process.exit(1);
  }
});

try {
  const mod = await import("./server.js");
  await mod.startServer();
} catch (err) {
  console.error("Failed to load or start server:", err);
  process.exit(1);
}
