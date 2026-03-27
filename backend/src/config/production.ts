import { logger } from '../utils/logger.js';

export interface ProductionConfig {
  // Database
  database: {
    maxConnections: number;
    connectionTimeout: number;
    idleTimeout: number;
  };

  // Caching
  cache: {
    defaultTtl: number;
    maxSize: number;
    cleanupInterval: number;
  };

  // Queue
  queue: {
    concurrency: number;
    maxRetries: number;
    retryDelay: number;
  };

  // Rate limiting
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    authMaxAttempts: number;
    authLockoutMs: number;
  };

  // Performance
  performance: {
    slowQueryThreshold: number;
    slowRequestThreshold: number;
    maxResponseSize: number;
  };

  // Security
  security: {
    jwtExpiration: string;
    refreshTokenExpiration: string;
    bcryptRounds: number;
    sessionTimeout: number;
  };

  // Monitoring
  monitoring: {
    metricsEnabled: boolean;
    healthCheckInterval: number;
    alertThresholds: {
      errorRate: number;
      responseTime: number;
      memoryUsage: number;
    };
  };
}

export const productionConfig: ProductionConfig = {
  database: {
    maxConnections: Number(process.env.DB_MAX_CONNECTIONS) || 20,
    connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT) || 30000,
    idleTimeout: Number(process.env.DB_IDLE_TIMEOUT) || 10000,
  },

  cache: {
    defaultTtl: Number(process.env.CACHE_DEFAULT_TTL) || 300, // 5 minutes
    maxSize: Number(process.env.CACHE_MAX_SIZE) || 10000,
    cleanupInterval: Number(process.env.CACHE_CLEANUP_INTERVAL) || 300000, // 5 minutes
  },

  queue: {
    concurrency: Number(process.env.QUEUE_CONCURRENCY) || 3,
    maxRetries: Number(process.env.QUEUE_MAX_RETRIES) || 3,
    retryDelay: Number(process.env.QUEUE_RETRY_DELAY) || 1000,
  },

  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
    maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 300,
    authMaxAttempts: Number(process.env.AUTH_MAX_ATTEMPTS) || 5,
    authLockoutMs: Number(process.env.AUTH_LOCKOUT_MS) || 900000, // 15 minutes
  },

  performance: {
    slowQueryThreshold: Number(process.env.SLOW_QUERY_THRESHOLD) || 1000, // 1 second
    slowRequestThreshold: Number(process.env.SLOW_REQUEST_THRESHOLD) || 3000, // 3 seconds
    maxResponseSize: Number(process.env.MAX_RESPONSE_SIZE) || 10485760, // 10MB
  },

  security: {
    jwtExpiration: process.env.JWT_EXPIRES_IN || '15m',
    refreshTokenExpiration: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
    sessionTimeout: Number(process.env.SESSION_TIMEOUT) || 1800000, // 30 minutes
  },

  monitoring: {
    metricsEnabled: process.env.METRICS_ENABLED !== 'false',
    healthCheckInterval: Number(process.env.HEALTH_CHECK_INTERVAL) || 30000, // 30 seconds
    alertThresholds: {
      errorRate: Number(process.env.ALERT_ERROR_RATE) || 0.05, // 5%
      responseTime: Number(process.env.ALERT_RESPONSE_TIME) || 5000, // 5 seconds
      memoryUsage: Number(process.env.ALERT_MEMORY_USAGE) || 0.8, // 80%
    },
  },
};

// Validate production configuration
export function validateConfig(config: ProductionConfig): void {
  const errors: string[] = [];

  if (config.database.maxConnections < 1 || config.database.maxConnections > 100) {
    errors.push('Database max connections must be between 1 and 100');
  }

  if (config.cache.defaultTtl < 1 || config.cache.defaultTtl > 3600) {
    errors.push('Cache default TTL must be between 1 and 3600 seconds');
  }

  if (config.queue.concurrency < 1 || config.queue.concurrency > 10) {
    errors.push('Queue concurrency must be between 1 and 10');
  }

  if (config.rateLimit.maxRequests < 1 || config.rateLimit.maxRequests > 10000) {
    errors.push('Rate limit max requests must be between 1 and 10000');
  }

  if (config.security.bcryptRounds < 10 || config.security.bcryptRounds > 15) {
    errors.push('Bcrypt rounds must be between 10 and 15');
  }

  if (errors.length > 0) {
    const errorMessage = `Configuration validation failed:\n${errors.join('\n')}`;
    logger.error('Invalid production configuration', { errors });
    throw new Error(errorMessage);
  }

  logger.info('Production configuration validated successfully');
}

// Apply production optimizations
export function applyProductionOptimizations(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  // Validate configuration first
  validateConfig(productionConfig);

  // Set Node.js optimizations
  if (process.env.UV_THREADPOOL_SIZE) {
    process.env.UV_THREADPOOL_SIZE = String(Math.min(Number(process.env.UV_THREADPOOL_SIZE), 128));
  }

  // Enable garbage collection optimizations
  if (global.gc) {
    logger.info('Manual garbage collection available');
  }

  // Set heap size limits if specified
  if (process.env.NODE_HEAP_SIZE_LIMIT) {
    const limit = Number(process.env.NODE_HEAP_SIZE_LIMIT);
    if (limit > 0) {
      // Note: This would require additional Node.js flags to be effective
      logger.info('Heap size limit configured', { limit });
    }
  }

  logger.info('Production optimizations applied', {
    databaseConnections: productionConfig.database.maxConnections,
    queueConcurrency: productionConfig.queue.concurrency,
    cacheSize: productionConfig.cache.maxSize,
    rateLimit: productionConfig.rateLimit.maxRequests,
  });
}

export default productionConfig;
