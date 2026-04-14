-- Add shift pause tracking fields.
-- These are used by shift pause/resume routes and auto-close cron.

ALTER TABLE "EmployeeShift"
  ADD COLUMN IF NOT EXISTS "pauseCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "EmployeeShift"
  ADD COLUMN IF NOT EXISTS "lastPauseAt" TIMESTAMP(3);

