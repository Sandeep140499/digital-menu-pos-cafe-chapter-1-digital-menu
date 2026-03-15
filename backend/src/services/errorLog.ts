import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";

export type ErrorLogInput = {
  errorType: string;
  apiEndpoint?: string | null;
  errorMessage: string;
  stackTrace?: string | null;
  branchId?: number | null;
  metadata?: Record<string, unknown> | null;
};

export async function logError(input: ErrorLogInput): Promise<void> {
  try {
    const metadataJson: Prisma.InputJsonValue | undefined =
      input.metadata == null
        ? undefined
        : JSON.parse(JSON.stringify(input.metadata));
    await prisma.errorLog.create({
      data: {
        errorType: input.errorType,
        apiEndpoint: input.apiEndpoint ?? undefined,
        errorMessage: input.errorMessage,
        stackTrace: input.stackTrace ?? undefined,
        branchId: input.branchId ?? undefined,
        metadata: metadataJson,
      },
    });
  } catch (e) {
    console.error("Failed to write error log:", e);
  }
}

export function getSuggestedFix(errorType: string, errorMessage: string): string {
  const lower = (errorMessage || "").toLowerCase();
  if (lower.includes("timeout") || lower.includes("connection")) {
    return "Check DB connection pool limit and network. Consider increasing pool size.";
  }
  if (lower.includes("econnrefused") || lower.includes("connection refused")) {
    return "Database or external service is down. Verify DATABASE_URL and service availability.";
  }
  if (errorType === "MENU_LOAD") {
    return "Check menu API and database. Ensure categories and items exist.";
  }
  if (lower.includes("unique") || lower.includes("duplicate")) {
    return "Duplicate key violation. Check unique constraints (email, employeeCode, etc.).";
  }
  return "Review error details and application logs.";
}
