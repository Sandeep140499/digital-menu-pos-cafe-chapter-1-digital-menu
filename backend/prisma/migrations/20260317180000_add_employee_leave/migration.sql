-- Add EmployeeLeave for leave management (apply/approve/reject)
DO $$ BEGIN
  CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "EmployeeLeave" (
  "id" SERIAL PRIMARY KEY,
  "employeeId" INTEGER NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "reason" TEXT,
  "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "EmployeeLeave"
    ADD CONSTRAINT "EmployeeLeave_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "EmployeeLeave_employeeId_idx" ON "EmployeeLeave"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeLeave_startDate_idx" ON "EmployeeLeave"("startDate");
CREATE INDEX IF NOT EXISTS "EmployeeLeave_endDate_idx" ON "EmployeeLeave"("endDate");
CREATE INDEX IF NOT EXISTS "EmployeeLeave_status_idx" ON "EmployeeLeave"("status");
CREATE INDEX IF NOT EXISTS "EmployeeLeave_createdAt_idx" ON "EmployeeLeave"("createdAt");

