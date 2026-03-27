-- Add leave type and admin remarks to leave requests.
DO $$ BEGIN
  CREATE TYPE "LeaveType" AS ENUM ('SICK', 'CASUAL', 'PAID');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "EmployeeLeave"
  ADD COLUMN IF NOT EXISTS "leaveType" "LeaveType" NOT NULL DEFAULT 'CASUAL';

ALTER TABLE "EmployeeLeave"
  ADD COLUMN IF NOT EXISTS "adminRemarks" TEXT;
