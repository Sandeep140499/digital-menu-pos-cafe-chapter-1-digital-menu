import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import './utils/asyncErrors.js';
import { router } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { performanceMiddleware } from './middleware/performance.js';
import { authRateLimit } from './middleware/auth.js';
import { isMailConfigured, verifyMailConnection } from './config/mailer.js';
import { openApiSpec } from './openapi.js';
import net from 'net';
import jwt from 'jsonwebtoken';
import { jwtConfig } from './config/auth.js';
import { prisma } from './config/prisma.js';
import { setActiveSockets } from './services/metrics.js';
import { logger } from './utils/logger.js';
import { applyProductionOptimizations } from './config/production.js';

/**
 * Comma-separated origins from env (Railway + Vercel: set at least one full frontend URL).
 * If none are set, CORS allows any origin (dev-friendly). If any are set, only those match.
 */
function buildAllowedOriginsFromEnv(): string[] | undefined {
  const chunks = [
    process.env.CORS_ORIGIN,
    process.env.FRONTEND_URL,
    process.env.FRONTEND_CUSTOMER_URL,
    process.env.FRONTEND_DASHBOARD_URL,
  ].filter(Boolean);
  if (chunks.length === 0) return undefined;
  const list = chunks
    .join(',')
    .split(',')
    .map(o =>
      // Railway/Vercel env values are sometimes stored with wrapping quotes.
      // Normalize so `"https://example.com"` and `'https://example.com'` match the real Origin header.
      o
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .replace(/\/$/, '')
    )
    .filter(Boolean);
  return [...new Set(list)];
}

const allowedOrigins = buildAllowedOriginsFromEnv();

function isLocalDevOrigin(origin: string): boolean {
  // Allow common local dev origins regardless of env allowlist.
  // This prevents "CORS: origin not allowed" when production env vars are present locally.
  try {
    const u = new URL(origin);
    const host = u.hostname;
    const isLocalHost =
      host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1';
    return isLocalHost;
  } catch {
    return false;
  }
}

const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

const app = express();
const server = http.createServer(app);

// When behind a reverse proxy / load balancer (Render, Railway, Nginx, etc.)
// trust proxy is needed for correct client IPs (rate limiting) and secure cookies.
// Use TRUST_PROXY=1 (or "true") to override; default enabled in production.
const trustProxyRaw = (process.env.TRUST_PROXY || '').trim().toLowerCase();
const trustProxy =
  trustProxyRaw === '1' || trustProxyRaw === 'true' || (trustProxyRaw === '' && isProd);
if (trustProxy) app.set('trust proxy', 1);

// Server-level timeouts: mitigate slowloris / stuck connections.
// Values are intentionally conservative for mobile networks.
server.requestTimeout = Number(process.env.REQUEST_TIMEOUT_MS || 30_000) || 30_000;
server.headersTimeout = Number(process.env.HEADERS_TIMEOUT_MS || 35_000) || 35_000;
server.keepAliveTimeout = Number(process.env.KEEP_ALIVE_TIMEOUT_MS || 65_000) || 65_000;

const io = new SocketIOServer(server, {
  // Realtime scaling notes:
  // - Without a shared adapter (Redis), multi-instance deployments require sticky sessions at the load balancer.
  // - Keep payload sizes small and timeouts sane for mobile networks.
  cors: {
    origin: allowedOrigins?.length ? allowedOrigins : '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  },
  pingInterval: 25_000,
  pingTimeout: 20_000,
  maxHttpBufferSize: 1e6, // 1MB: prevents accidental huge payloads
});

// Attach io to app locals so services/controllers can emit events
app.locals.io = io;

// Socket.IO auth + room join (optional; connection works without token, but won't receive scoped events)
io.use(async (socket, next) => {
  try {
    const authToken = (socket.handshake.auth as any)?.token as string | undefined;
    const headerAuth = socket.handshake.headers?.authorization as string | undefined;
    const token =
      authToken ||
      (headerAuth && headerAuth.startsWith('Bearer ') ? headerAuth.slice(7) : undefined);
    if (!token) return next();
    const decoded = jwt.verify(token, jwtConfig.secret) as {
      id: number;
      role: 'ADMIN' | 'EMPLOYEE';
    };
    (socket.data as any).user = decoded;
    return next();
  } catch {
    // Don't fail socket connection for bad tokens; just treat as unauthenticated.
    return next();
  }
});

io.on('connection', async socket => {
  try {
    setActiveSockets(io.engine.clientsCount);
  } catch {
    // ignore
  }
  socket.on('disconnect', () => {
    try {
      setActiveSockets(io.engine.clientsCount);
    } catch {
      // ignore
    }
  });
  const user = (socket.data as any)?.user as { id: number; role: 'ADMIN' | 'EMPLOYEE' } | undefined;
  if (!user) return;
  try {
    if (user.role === 'EMPLOYEE') {
      const emp = await prisma.employee.findUnique({
        where: { id: user.id },
        select: { branchId: true },
      });
      if (emp?.branchId) socket.join(`branch:${emp.branchId}`);
      socket.join(`employee:${user.id}`);
    } else {
      socket.join('admins');
    }
  } catch {
    // ignore room join failures
  }
});

// CORS: same origins as Socket.IO (merged from CORS_ORIGIN + FRONTEND_* env vars).
app.use(
  cors({
    origin: (origin, cb) => {
      // Non-browser requests (no Origin) should pass.
      if (!origin) return cb(null, true);
      // In development, always allow localhost origins (even if an env allowlist is set).
      if (!isProd && isLocalDevOrigin(origin)) return cb(null, true);
      if (!allowedOrigins || allowedOrigins.length === 0) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('CORS: origin not allowed'));
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    credentials: true,
  })
);
// Helmet with relaxed CSP so Swagger UI docs can load external JS/CSS bundles.
// This keeps defaults but allows the Swagger CDN domains.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // Allow Swagger UI assets and inline bootstrap script on /api/docs
        'script-src': [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net',
          'https://unpkg.com',
        ],
        'style-src': [
          "'self'",
          'https://cdn.jsdelivr.net',
          'https://unpkg.com',
          'https://fonts.googleapis.com',
        ],
        'img-src': ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
      },
    },
  })
);
app.use(cookieParser());
// Compression significantly reduces payload size for menu + dashboards (mobile networks).
app.use(compression());

// Body parsing limits: prevents huge payloads from exhausting memory/CPU.
const JSON_BODY_LIMIT = (process.env.JSON_BODY_LIMIT || '1mb').trim();
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(morgan('dev'));

app.get('/', (_req, res) => res.status(200).send('OK'));

// OpenAPI / Swagger docs
app.get('/api/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});

// Explicit OPTIONS (preflight) for all /api routes so POST /api/employees/:id/verify-and-send-invite works from frontend on Render etc.
app.use('/api', (req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin =
      allowedOrigins?.length && req.headers.origin && allowedOrigins.includes(req.headers.origin)
        ? req.headers.origin
        : allowedOrigins?.length
          ? allowedOrigins[0]
          : req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', String(origin));
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.sendStatus(204);
  }
  next();
});

app.get('/api/docs', (_req, res) => {
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
  res.type('html').send(html);
});

// Record API performance (latency + traffic) for dashboard
// Rate limiting: protect CPU/DB during traffic spikes and basic abuse.
// If you run multiple instances, prefer putting the rate limit at the load balancer or
// switch to a shared store (Redis). In-memory is still useful for single instance or per-worker protection.
const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000) || 60_000,
  limit: Number(process.env.RATE_LIMIT_MAX || 300) || 300, // requests per window per IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', apiLimiter);
app.use('/api', performanceMiddleware);
app.use('/api', router);

app.use(errorHandler);

// On Railway (and most platforms), PORT is injected and must be used as-is.
// Only use the fallback/port-scanning behavior when PORT is not provided (local dev).
const HAS_PLATFORM_PORT = typeof process.env.PORT === 'string' && process.env.PORT.length > 0;
const DEFAULT_PORT = (HAS_PLATFORM_PORT ? Number(process.env.PORT) : 4000) || 4000;
const MAX_PORT_ATTEMPTS = 10;

// Function to check if a port is available
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const tester = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
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
    // Apply production optimizations
    applyProductionOptimizations();

    const port = HAS_PLATFORM_PORT ? DEFAULT_PORT : await findAvailablePort(DEFAULT_PORT);

    if (!HAS_PLATFORM_PORT && port !== DEFAULT_PORT) {
      logger.warn(`Port ${DEFAULT_PORT} is in use. Using port ${port} instead.`);
    }

    // Ensure DB connection is established early. This reduces first-request latency
    // and makes failures visible at boot time (better for autoscaling platforms).
    await prisma.$connect();
    logger.info('Database connected successfully');

    server.listen(port, '0.0.0.0', async () => {
      logger.info(`Server started successfully`, {
        port,
        nodeEnv: process.env.NODE_ENV || 'development',
        pid: process.pid,
        platform: HAS_PLATFORM_PORT ? 'platform' : 'local',
      });

      if (allowedOrigins?.length) {
        logger.info(`CORS: allowing ${allowedOrigins.length} origin(s)`, {
          origins: allowedOrigins,
        });
      }
      // For local development, skip failing on SMTP verification errors.
      if (isMailConfigured()) {
        verifyMailConnection().catch((err: unknown) => {
          logger.warn(
            'Mail (SMTP) verification failed. Email features may not work until SMTP env vars are correct.',
            { error: (err as Error)?.message || err }
          );
        });
      } else {
        logger.info('Mail service not configured');
      }
      const shouldRunJobs =
        String(process.env.RUN_BACKGROUND_JOBS || 'true').toLowerCase() === 'true';
      if (shouldRunJobs) {
        logger.info('Starting background jobs');
        const { startAutoCloseCron } = await import('./services/shiftAutoClose.js');
        startAutoCloseCron();
        const { startPendingPaymentCron } = await import('./cron/pendingPaymentAlert.js');
        startPendingPaymentCron();
        const { startDailyDirectorReportCron } = await import('./cron/dailyDirectorReport.js');
        startDailyDirectorReportCron();
        const { startMonthlyDirectorReportCron } = await import('./cron/monthlyDirectorReport.js');
        startMonthlyDirectorReportCron();
      } else {
        logger.info('Background jobs disabled for this worker (RUN_BACKGROUND_JOBS=false).');
      }
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown`);

      server.close(async () => {
        try {
          logger.info('HTTP server closed');
          await prisma.$disconnect();
          logger.info('Database disconnected');

          // Cleanup other resources
          const { jobQueue } = await import('./services/queue.js');
          jobQueue.stop();

          const { cache } = await import('./services/cache.js');
          cache.destroy();

          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Handle server errors
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(
      `Port ${DEFAULT_PORT} is already in use. Please kill the process using the port or change the PORT in .env`
    );
  } else {
    logger.error('Server error', { error: error.message, code: error.code });
  }
  process.exit(1);
});

export { app, startServer };
