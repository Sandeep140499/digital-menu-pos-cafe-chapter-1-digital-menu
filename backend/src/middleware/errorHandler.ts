import type { ErrorRequestHandler, Request } from 'express';
import { logger, logBusinessError } from '../utils/logger.js';
import { logError, getSuggestedFix } from '../services/errorLog.js';

function getBranchIdFromRequest(req: Request): number | undefined {
  const branchId = (req as any).branchId ?? req.body?.branchId ?? req.query?.branchId;
  if (typeof branchId === 'number' && Number.isInteger(branchId)) return branchId;
  if (typeof branchId === 'string') {
    const n = Number(branchId);
    if (Number.isInteger(n)) return n;
  }
  return undefined;
}

export const errorHandler: ErrorRequestHandler = async (err, req, res, _next) => {
  const status = (err as any).status || 500;
  const message = (err as any).message || 'Internal server error';
  const errorType = (err as any).errorType || (status >= 500 ? 'API_FAILURE' : 'VALIDATION');
  const endpoint = req.method && req.path ? `${req.method} ${req.path}` : req.path || undefined;
  const requestId = req.headers['x-request-id'] || 'unknown';
  const userId = (req as any).user?.id;
  const branchId = getBranchIdFromRequest(req);

  // Enhanced error context
  const errorContext = {
    requestId,
    userId,
    branchId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    method: req.method,
    path: req.path,
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query,
    timestamp: new Date().toISOString(),
  };

  // Log with structured logger
  logger.error('API Error', {
    errorType,
    status,
    message: err.message,
    stack: err.stack,
    ...errorContext,
  });

  // Log business error for tracking
  await logBusinessError(errorType, message, {
    branchId,
    userId,
    action: endpoint,
    metadata: {
      statusCode: status,
      suggestedFix: getSuggestedFix(errorType, message),
      ...errorContext,
    },
  });

  // Don't expose internal errors in production
  const responseMessage =
    process.env.NODE_ENV === 'production' && status >= 500 ? 'Internal server error' : message;

  res.status(status).json({
    success: false,
    message: responseMessage,
    ...(process.env.NODE_ENV !== 'production' && {
      errorType,
      requestId,
    }),
  });
};
