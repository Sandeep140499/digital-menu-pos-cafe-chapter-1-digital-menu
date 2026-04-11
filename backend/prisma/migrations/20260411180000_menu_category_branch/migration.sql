-- Menu categories belong to a branch (separate menus per location).

ALTER TABLE "MenuCategory" ADD COLUMN "branchId" INTEGER;

UPDATE "MenuCategory" AS mc
SET "branchId" = (SELECT id FROM "Branch" ORDER BY id ASC LIMIT 1);

ALTER TABLE "MenuCategory" ALTER COLUMN "branchId" SET NOT NULL;

ALTER TABLE "MenuCategory" DROP CONSTRAINT IF EXISTS "MenuCategory_slug_key";

ALTER TABLE "MenuCategory"
  ADD CONSTRAINT "MenuCategory_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "MenuCategory_branchId_slug_key" ON "MenuCategory" ("branchId", "slug");

CREATE INDEX "MenuCategory_branchId_idx" ON "MenuCategory" ("branchId");
