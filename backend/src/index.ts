import "dotenv/config";

// Log the real error so we can fix backend crash (was showing [Object: null prototype])
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection. Reason:", reason);
  process.exit(1);
});

try {
  const mod = await import("./server.js");
  await mod.startServer();
} catch (err) {
  console.error("Failed to load or start server:", err);
  process.exit(1);
}
