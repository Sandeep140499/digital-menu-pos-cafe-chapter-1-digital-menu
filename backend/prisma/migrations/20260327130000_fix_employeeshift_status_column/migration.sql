-- Backfill missing EmployeeShift.status migration history.
-- This is safe on databases where the column/enum already exist.

DO $$ BEGIN
  CREATE TYPE "ShiftStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "EmployeeShift"
  ADD COLUMN IF NOT EXISTS "status" "ShiftStatus" NOT NULL DEFAULT 'ACTIVE';
