-- AlterTable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Employee'
      AND column_name = 'updatedAt'
  ) THEN
    ALTER TABLE "Employee" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- AlterTable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'MenuCategory'
      AND column_name = 'updatedAt'
  ) THEN
    ALTER TABLE "MenuCategory" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;
