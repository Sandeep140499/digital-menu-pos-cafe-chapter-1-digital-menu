-- Employee role field (string label)

ALTER TABLE "Employee"
ADD COLUMN IF NOT EXISTS "role" TEXT;

-- Employee role field (optional).
-- Added as a safe repair migration for older databases where this column is missing.

ALTER TABLE "Employee"
  ADD COLUMN IF NOT EXISTS "role" TEXT;

