-- Create CustomerQuery table (missing from migrations)
CREATE TABLE IF NOT EXISTS "CustomerQuery" (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  "orderId" INTEGER,
  "branchId" INTEGER,
  "issueType" TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "CustomerQuery_branchId_fkey" 
    FOREIGN KEY ("branchId") REFERENCES "Branch"(id) 
    ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "CustomerQuery_status_idx" ON "CustomerQuery"(status);
CREATE INDEX IF NOT EXISTS "CustomerQuery_createdAt_idx" ON "CustomerQuery"("createdAt");
CREATE INDEX IF NOT EXISTS "CustomerQuery_branchId_idx" ON "CustomerQuery"("branchId");

-- Verify
SELECT * FROM "CustomerQuery" LIMIT 1;
