import type { ErrorRequestHandler, Request } from "express";
import { logError, getSuggestedFix } from "../services/errorLog.js";

function getBranchIdFromRequest(req: Request): number | undefined {
  const branchId = (req as any).branchId ?? req.body?.branchId ?? req.query?.branchId;
  if (typeof branchId === "number" && Number.isInteger(branchId)) return branchId;
  if (typeof branchId === "string") {
    const n = Number(branchId);
    if (Number.isInteger(n)) return n;
  }
  return undefined;
}

export const errorHandler: ErrorRequestHandler = async (err, req, res, _next) => {
  const status = (err as any).status || 500;
  const message = (err as any).message || "Internal server error";
  const errorType = (err as any).errorType || (status >= 500 ? "API_FAILURE" : "VALIDATION");
  const endpoint = req.method && req.path ? `${req.method} ${req.path}` : req.path || undefined;

  console.error(err);

  try {
    await logError({
      errorType,
      apiEndpoint: endpoint,
      errorMessage: message,
      stackTrace: (err as Error).stack ?? undefined,
      branchId: getBranchIdFromRequest(req),
      metadata: {
        statusCode: status,
        method: req.method,
        path: req.path,
        suggestedFix: getSuggestedFix(errorType, message),
      },
    });
  } catch (_) {
    // ignore logging failure
  }

  res.status(status).json({
    success: false,
    message,
  });
};

