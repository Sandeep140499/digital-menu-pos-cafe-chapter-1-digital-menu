-- Add Branch.enableNewOrderRinging for employee new-order sound control
ALTER TABLE "Branch"
  ADD COLUMN IF NOT EXISTS "enableNewOrderRinging" BOOLEAN NOT NULL DEFAULT true;

