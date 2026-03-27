import winston from 'winston';
import { ErrorLog } from '@prisma/client';

// Custom log format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta,
      service: 'pos-backend',
    });
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'pos-backend',
    version: process.env.npm_package_version || '1.0.0',
  },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined log file
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    })
  );
}

// Structured error logging for business operations
export const logBusinessError = async (
  errorType: string,
  message: string,
  context: {
    branchId?: number;
    userId?: number;
    orderId?: number;
    action?: string;
    metadata?: Record<string, any>;
  }
) => {
  const errorData = {
    errorType,
    message,
    ...context,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  };

  logger.error('Business Error', errorData);

  // Also log to database for tracking
  try {
    // This would be implemented with your Prisma client
    // await prisma.errorLog.create({
    //   data: {
    //     errorType,
    //     errorMessage: message,
    //     branchId: context.branchId,
    //     metadata: context.metadata
    //   }
    // });
  } catch (dbError) {
    logger.error('Failed to log error to database', { error: dbError });
  }
};

// Performance logging
export const logPerformance = (
  operation: string,
  duration: number,
  context?: Record<string, any>
) => {
  if (duration > 1000) {
    // Log slow operations (> 1s)
    logger.warn('Slow Operation Detected', {
      operation,
      duration: `${duration}ms`,
      ...context,
    });
  } else {
    logger.debug('Performance Metric', {
      operation,
      duration: `${duration}ms`,
      ...context,
    });
  }
};

// Security event logging
export const logSecurityEvent = (
  event: string,
  context: {
    userId?: number;
    ip?: string;
    userAgent?: string;
    action?: string;
    success: boolean;
    metadata?: Record<string, any>;
  }
) => {
  logger.warn('Security Event', {
    event,
    ...context,
    timestamp: new Date().toISOString(),
  });
};

export default logger;
