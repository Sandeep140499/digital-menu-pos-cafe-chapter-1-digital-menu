import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { logger, logSecurityEvent } from '../utils/logger.js';

// Common validation schemas
export const commonSchemas = {
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),

  // Date range
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),

  // ID parameter
  idParam: z.object({
    id: z.coerce.number().int().positive(),
  }),

  // Branch ID (for multi-tenant operations)
  branchId: z.object({
    branchId: z.coerce.number().int().positive(),
  }),

  // Mobile number validation
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),

  // Email validation
  email: z.string().email('Invalid email format'),

  // Password validation
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
};

// Sanitization functions
export const sanitizeInput = {
  // Remove HTML tags and encode special characters
  string: (input: string): string => {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/<[^>]*>/g, '') // Remove all HTML tags
      .trim();
  },

  // Sanitize mobile number
  mobile: (input: string): string => {
    const digits = input.replace(/\D/g, '').slice(-10);
    return /^[6-9]\d{9}$/.test(digits) ? digits : '';
  },

  // Sanitize email (lowercase and trim)
  email: (input: string): string => {
    return input.toLowerCase().trim();
  },

  // Sanitize numeric input
  number: (input: any): number | null => {
    const num = Number(input);
    return Number.isFinite(num) ? num : null;
  },

  // Sanitize array of strings
  stringArray: (input: any[]): string[] => {
    return Array.isArray(input) ? input.map(item => String(item).trim()).filter(Boolean) : [];
  },
};

// Validation middleware factory
export const validate = (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[source];

      // Sanitize inputs before validation
      if (source === 'body' && typeof data === 'object') {
        sanitizeRequestBody(data);
      }

      const validatedData = await schema.parseAsync(data);

      // Replace request data with validated data
      req[source] = validatedData;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        // Log validation attempts for security monitoring
        logSecurityEvent('validation_failed', {
          userId: (req as any).user?.id,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          action: `${req.method} ${req.path}`,
          success: false,
          metadata: {
            validationErrors,
            requestBody: req.method !== 'GET' ? req.body : undefined,
          },
        });

        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
          requestId: req.headers['x-request-id'],
        });
      }

      next(error);
    }
  };
};

// Recursive sanitization for request bodies
function sanitizeRequestBody(obj: any): void {
  if (typeof obj !== 'object' || obj === null) return;

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];

      if (typeof value === 'string') {
        // Basic string sanitization
        obj[key] = sanitizeInput.string(value);
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        sanitizeRequestBody(value);
      }
    }
  }
}

// Rate limiting for validation failures (prevent brute force)
const validationFailureCache = new Map<string, { count: number; lastAttempt: number }>();

export const validateWithRateLimit = (
  schema: ZodSchema,
  source: 'body' | 'query' | 'params' = 'body',
  maxAttempts: number = 10,
  windowMs: number = 15 * 60 * 1000
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const clientKey = `${req.ip}:${req.path}`;
    const now = Date.now();
    const record = validationFailureCache.get(clientKey);

    // Check rate limit
    if (record && now - record.lastAttempt < windowMs && record.count >= maxAttempts) {
      logSecurityEvent('rate_limit_exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        action: `${req.method} ${req.path}`,
        success: false,
        metadata: { endpoint: req.path, attempts: record.count },
      });

      return res.status(429).json({
        success: false,
        message: 'Too many validation attempts. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000),
      });
    }

    try {
      await validate(schema, source)(req, res, error => {
        if (error) {
          // Update failure count
          if (record) {
            record.count++;
            record.lastAttempt = now;
          } else {
            validationFailureCache.set(clientKey, { count: 1, lastAttempt: now });
          }
        }
        next(error);
      });
    } catch (error) {
      next(error);
    }
  };
};

// Cleanup old rate limit records periodically
setInterval(
  () => {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes

    for (const [key, record] of validationFailureCache.entries()) {
      if (now - record.lastAttempt > windowMs) {
        validationFailureCache.delete(key);
      }
    }
  },
  5 * 60 * 1000
); // Clean up every 5 minutes

export default { validate, validateWithRateLimit, commonSchemas, sanitizeInput };
