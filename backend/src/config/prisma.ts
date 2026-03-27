import { PrismaClient } from '@prisma/client';
import { prismaQueryDurationMs } from '../services/metrics.js';

export const prisma = new PrismaClient({
  log: [{ emit: 'event', level: 'query' }],
});

// Observe Prisma query timings for operational monitoring.
// (Using query events instead of middleware for compatibility.)
try {
  (prisma as any).$on('query', (e: any) => {
    const ms = Number(e?.duration) || 0;
    try {
      prismaQueryDurationMs.labels('sql', 'query').observe(ms);
    } catch {
      // metrics should never break queries
    }
  });
} catch {
  // ignore if query events are unavailable
}
