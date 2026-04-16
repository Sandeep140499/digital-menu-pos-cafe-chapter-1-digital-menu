-- Branch contact fields (phone, Google review URL)

ALTER TABLE "Branch"
ADD COLUMN IF NOT EXISTS "phone" TEXT,
ADD COLUMN IF NOT EXISTS "googleReviewUrl" TEXT;

-- Branch contact fields (added after initial production launch).
-- Keep idempotent for databases created from older migration chains.

ALTER TABLE "Branch"
  ADD COLUMN IF NOT EXISTS "phone" TEXT;

ALTER TABLE "Branch"
  ADD COLUMN IF NOT EXISTS "googleReviewUrl" TEXT;

