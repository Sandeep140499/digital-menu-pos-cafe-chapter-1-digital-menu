import { logger } from '../utils/logger.js';

// Simple in-memory cache for production-ready use
// In production, consider Redis for distributed caching
class MemoryCache {
  private cache = new Map<string, { data: any; expiresAt: number; tags: Set<string> }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, value] of this.cache.entries()) {
      if (value.expiresAt <= now) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cache cleanup completed', { expiredEntries: cleanedCount });
    }
  }

  set(key: string, data: any, ttlSeconds: number = 300, tags: string[] = []): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, {
      data: JSON.parse(JSON.stringify(data)), // Deep clone to prevent mutations
      expiresAt,
      tags: new Set(tags),
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clearByTag(tag: string): number {
    let deletedCount = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.has(tag)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  clear(): number {
    const size = this.cache.size;
    this.cache.clear();
    return size;
  }

  // Get cache statistics
  getStats() {
    const now = Date.now();
    let expiredCount = 0;
    let activeCount = 0;

    for (const entry of this.cache.values()) {
      if (entry.expiresAt <= now) {
        expiredCount++;
      } else {
        activeCount++;
      }
    }

    return {
      totalEntries: this.cache.size,
      activeEntries: activeCount,
      expiredEntries: expiredCount,
    };
  }

  // Destroy cleanup interval
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

export const cache = new MemoryCache();

// Cache middleware for Express routes
export function cacheMiddleware(ttlSeconds: number = 300, tags: string[] = []) {
  return (req: any, res: any, next: any) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `route:${req.originalUrl}:${req.user?.id || 'anonymous'}:${(req as any).branchId || 'default'}`;
    const cachedData = cache.get(key);

    if (cachedData) {
      logger.debug('Cache hit', { key, route: req.originalUrl });
      return res.json(cachedData);
    }

    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function (data: any) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, data, ttlSeconds, tags);
        logger.debug('Cache set', { key, route: req.originalUrl, ttl: ttlSeconds });
      }
      return originalJson.call(this, data);
    };

    next();
  };
}

// Cache service for specific business logic
export class CacheService {
  // Cache menu items by branch
  static cacheMenuByBranch(branchId: number, menuData: any, ttlSeconds: number = 600) {
    const key = `menu:branch:${branchId}`;
    cache.set(key, menuData, ttlSeconds, ['menu', `branch:${branchId}`]);
    logger.debug('Menu cached', { branchId, itemCount: menuData.items?.length || 0 });
  }

  static getMenuByBranch(branchId: number): any | null {
    const key = `menu:branch:${branchId}`;
    return cache.get(key);
  }

  static clearMenuCache(branchId: number): number {
    return cache.clearByTag(`branch:${branchId}`);
  }

  // Cache employee performance metrics
  static cacheEmployeeMetrics(employeeId: number, metrics: any, ttlSeconds: number = 300) {
    const key = `metrics:employee:${employeeId}`;
    cache.set(key, metrics, ttlSeconds, ['metrics', `employee:${employeeId}`]);
  }

  static getEmployeeMetrics(employeeId: number): any | null {
    const key = `metrics:employee:${employeeId}`;
    return cache.get(key);
  }

  static clearEmployeeMetrics(employeeId: number): number {
    return cache.clearByTag(`employee:${employeeId}`);
  }

  // Cache branch performance data
  static cacheBranchPerformance(branchId: number, performanceData: any, ttlSeconds: number = 180) {
    const key = `performance:branch:${branchId}`;
    cache.set(key, performanceData, ttlSeconds, ['performance', `branch:${branchId}`]);
  }

  static getBranchPerformance(branchId: number): any | null {
    const key = `performance:branch:${branchId}`;
    return cache.get(key);
  }

  static clearBranchPerformance(branchId: number): number {
    return cache.clearByTag(`branch:${branchId}`);
  }

  // Cache order statistics
  static cacheOrderStats(branchId: number, stats: any, ttlSeconds: number = 120) {
    const key = `stats:orders:${branchId}`;
    cache.set(key, stats, ttlSeconds, ['stats', `branch:${branchId}`]);
  }

  static getOrderStats(branchId: number): any | null {
    const key = `stats:orders:${branchId}`;
    return cache.get(key);
  }

  static clearOrderStats(branchId: number): number {
    return cache.clearByTag(`branch:${branchId}`);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  cache.destroy();
});

process.on('SIGINT', () => {
  cache.destroy();
});

export default cache;
