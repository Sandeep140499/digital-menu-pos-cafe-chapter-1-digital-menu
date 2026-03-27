import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/auth.js';
import { logger, logSecurityEvent } from '../utils/logger.js';
import { prisma } from '../config/prisma.js';

export type AuthRole = 'ADMIN' | 'EMPLOYEE';

export interface AuthUserPayload {
  id: number;
  role: AuthRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const requestId = req.headers['x-request-id'] || 'unknown';

  if (!authHeader?.startsWith('Bearer ')) {
    logSecurityEvent('missing_token', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      action: `${req.method} ${req.path}`,
      success: false,
      metadata: { requestId },
    });
    return res.status(401).json({
      success: false,
      message: 'Authorization token required',
    });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, jwtConfig.secret) as AuthUserPayload;

    // Add additional security checks
    if (!decoded.id || !decoded.role) {
      throw new Error('Invalid token payload');
    }

    req.user = decoded;

    // Log successful authentication for auditing
    logger.debug('Authentication successful', {
      userId: decoded.id,
      role: decoded.role,
      ip: req.ip,
      path: req.path,
      requestId,
    });

    return next();
  } catch (error) {
    const errorMessage = error instanceof jwt.TokenExpiredError ? 'Token expired' : 'Invalid token';

    logSecurityEvent('invalid_token', {
      userId: (error as any)?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      action: `${req.method} ${req.path}`,
      success: false,
      metadata: {
        error: errorMessage,
        requestId,
        tokenPreview: token.substring(0, 10) + '...',
      },
    });

    return res.status(401).json({
      success: false,
      message: errorMessage,
    });
  }
}

export function requireRole(role: AuthRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (req.user.role !== role) {
      logSecurityEvent('insufficient_permissions', {
        userId: req.user.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        action: `${req.method} ${req.path}`,
        success: false,
        metadata: { userRole: req.user.role, requiredRole: role },
      });

      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
    }

    return next();
  };
}

// Enhanced role-based access with branch validation
export function requireBranchAccess(branchIdParam: string = 'branchId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const requestedBranchId = Number(
      req.params[branchIdParam] || req.body[branchIdParam] || req.query[branchIdParam]
    );

    if (!Number.isInteger(requestedBranchId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid branch ID',
      });
    }

    try {
      // Verify user has access to this branch
      if (req.user.role === 'ADMIN') {
        // Admins have access to all branches (could be restricted based on business logic)
        (req as any).branchId = requestedBranchId;
        return next();
      }

      if (req.user.role === 'EMPLOYEE') {
        const employee = await prisma.employee.findUnique({
          where: { id: req.user.id },
          select: { branchId: true, status: true },
        });

        if (!employee || employee.status !== 'ACTIVE') {
          logSecurityEvent('inactive_employee_access', {
            userId: req.user.id,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            action: `${req.method} ${req.path}`,
            success: false,
            metadata: { requestedBranchId },
          });

          return res.status(403).json({
            success: false,
            message: 'Employee account not active',
          });
        }

        if (employee.branchId !== requestedBranchId) {
          logSecurityEvent('cross_branch_access_attempt', {
            userId: req.user.id,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            action: `${req.method} ${req.path}`,
            success: false,
            metadata: { employeeBranchId: employee.branchId, requestedBranchId },
          });

          return res.status(403).json({
            success: false,
            message: 'Access denied to this branch',
          });
        }

        (req as any).branchId = requestedBranchId;
        return next();
      }

      return res.status(403).json({
        success: false,
        message: 'Invalid user role',
      });
    } catch (error) {
      logger.error('Error in branch access validation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user.id,
        requestedBranchId,
        path: req.path,
      });

      return res.status(500).json({
        success: false,
        message: 'Error validating branch access',
      });
    }
  };
}

// Rate limiting for authentication attempts
const authAttempts = new Map<string, { count: number; lastAttempt: number; lockUntil?: number }>();

export function authRateLimit(
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000,
  lockoutMs: number = 30 * 60 * 1000
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientKey = req.ip || 'unknown';
    const now = Date.now();
    const record = authAttempts.get(clientKey);

    // Check if client is locked out
    if (record?.lockUntil && now < record.lockUntil) {
      const remainingTime = Math.ceil((record.lockUntil - now) / 1000);

      logSecurityEvent('auth_locked_out', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        action: `${req.method} ${req.path}`,
        success: false,
        metadata: { lockoutRemaining: remainingTime },
      });

      return res.status(429).json({
        success: false,
        message: 'Too many failed authentication attempts. Please try again later.',
        retryAfter: remainingTime,
      });
    }

    // Check rate limit
    if (record && now - record.lastAttempt < windowMs && record.count >= maxAttempts) {
      const lockUntil = now + lockoutMs;
      authAttempts.set(clientKey!, { ...record, lockUntil });

      logSecurityEvent('auth_rate_limit_exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        action: `${req.method} ${req.path}`,
        success: false,
        metadata: { attempts: record.count },
      });

      return res.status(429).json({
        success: false,
        message: 'Too many authentication attempts. Account temporarily locked.',
        retryAfter: Math.ceil(lockoutMs / 1000),
      });
    }

    // Continue with request
    const originalNext = next;
    next = (error?: any) => {
      // If authentication failed, increment counter
      if (error && (error.status === 401 || error.message?.includes('token'))) {
        if (record) {
          authAttempts.set(clientKey!, {
            count: record.count + 1,
            lastAttempt: now,
          });
        } else {
          authAttempts.set(clientKey!, { count: 1, lastAttempt: now });
        }
      }

      originalNext(error);
    };

    originalNext();
  };
}
