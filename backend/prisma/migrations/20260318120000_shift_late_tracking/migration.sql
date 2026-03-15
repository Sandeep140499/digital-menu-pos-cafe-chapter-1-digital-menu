-- AlterTable: add shift timing and joining date to Employee
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "shiftStartTime" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "shiftEndTime" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "joiningDate" DATE;

-- CreateTable: late_entries
CREATE TABLE IF NOT EXISTS "LateEntry" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "shiftStartTime" TEXT NOT NULL,
    "actualLoginTime" TIMESTAMP(3) NOT NULL,
    "lateDurationMinutes" INTEGER NOT NULL,
    "shiftId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LateEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LateEntry_employeeId_idx" ON "LateEntry"("employeeId");
CREATE INDEX IF NOT EXISTS "LateEntry_date_idx" ON "LateEntry"("date");
CREATE INDEX IF NOT EXISTS "LateEntry_createdAt_idx" ON "LateEntry"("createdAt");

ALTER TABLE "LateEntry" ADD CONSTRAINT "LateEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
