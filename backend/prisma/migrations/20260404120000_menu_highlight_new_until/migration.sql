-- Highlight "New launch" on customer menu until this timestamp (category and/or items).
-- Idempotent: safe if columns were already added manually or by a partial run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'MenuCategory' AND column_name = 'highlight_new_until'
  ) THEN
    ALTER TABLE "MenuCategory" ADD COLUMN "highlight_new_until" TIMESTAMP(3);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'MenuItem' AND column_name = 'highlight_new_until'
  ) THEN
    ALTER TABLE "MenuItem" ADD COLUMN "highlight_new_until" TIMESTAMP(3);
  END IF;
END $$;
