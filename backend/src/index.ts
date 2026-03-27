import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import cluster from 'node:cluster';
import os from 'node:os';

// Load env vars from file for local/dev. On Railway/Render/etc, platform env vars are injected
// and this will simply merge (without overriding existing env by default).
const envMode = (process.env.NODE_ENV || 'development').trim();
const envFile = envMode === 'production' ? '.env.production' : '.env';
const envPath = path.resolve(process.cwd(), envFile);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // Fallback: keep prior behavior (.env) when running locally without .env.production
  dotenv.config();
}

// Log the real error so we can fix backend crash (was showing [Object: null prototype])
process.on('uncaughtException', err => {
  console.error('Uncaught exception:', err);
  // In development, keep process alive so hot-reload/dev server doesn't die on one request.
  // In production, crash fast so the platform restarts the process.
  if (process.env.NODE_ENV !== 'development') {
    process.exit(1);
  }
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection. Reason:', reason);
  if (process.env.NODE_ENV !== 'development') {
    process.exit(1);
  }
});

function getWebConcurrency(): number {
  const raw = (process.env.WEB_CONCURRENCY || '').trim();
  if (!raw) return 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.floor(n);
}

const WEB_CONCURRENCY = getWebConcurrency();
const ENABLE_CLUSTER = (process.env.ENABLE_CLUSTER || '').trim().toLowerCase() === 'true';

async function startSingleProcess() {
  try {
    process.env.RUN_BACKGROUND_JOBS = process.env.RUN_BACKGROUND_JOBS || 'true';
    const mod = await import('./server.js');
    await mod.startServer();
  } catch (err) {
    console.error('Failed to load or start server:', err);
    process.exit(1);
  }
}

if (ENABLE_CLUSTER && WEB_CONCURRENCY > 1 && cluster.isPrimary) {
  const cpuCount = os.cpus().length || 1;
  const workerCount = Math.min(WEB_CONCURRENCY, cpuCount);

  console.log(
    `🧩 Cluster mode enabled: starting ${workerCount} worker(s) (WEB_CONCURRENCY=${WEB_CONCURRENCY}, CPUs=${cpuCount}).`
  );
  console.log(
    'ℹ️  Note: Socket.IO scaling across workers may require sticky sessions at the load balancer (or Redis adapter for multi-instance).'
  );

  for (let i = 0; i < workerCount; i++) {
    cluster.fork({
      ...process.env,
      // Run crons/background jobs only once to avoid duplicates (emails, reports, etc.)
      RUN_BACKGROUND_JOBS: i === 0 ? 'true' : 'false',
    });
  }

  cluster.on('exit', (worker, code, signal) => {
    console.error(
      `❌ Worker ${worker.process.pid} exited (code=${code}, signal=${signal}). Restarting...`
    );
    cluster.fork({
      ...process.env,
      RUN_BACKGROUND_JOBS: 'false',
    });
  });

  const shutdown = () => {
    console.log('🛑 Primary received shutdown signal. Stopping workers...');
    for (const id in cluster.workers) {
      cluster.workers[id]?.process.kill('SIGTERM');
    }
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} else {
  await startSingleProcess();
}
