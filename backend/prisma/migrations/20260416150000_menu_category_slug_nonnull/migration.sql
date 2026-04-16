-- Make MenuCategory.slug non-null and safely backfill/normalize existing rows.
-- Slug is unique per branch (existing @@unique([branchId, slug])).

-- 1) Treat blank/whitespace slug as NULL
UPDATE "MenuCategory"
SET "slug" = NULL
WHERE "slug" IS NOT NULL AND btrim("slug") = '';

-- 2) Normalize existing non-null slugs (lowercase, dash-separated, no leading/trailing dashes)
UPDATE "MenuCategory"
SET "slug" = COALESCE(
  NULLIF(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(btrim("slug")), '\s+', '-', 'g'),
        '-+',
        '-',
        'g'
      ),
      '(^-+|-+$)',
      '',
      'g'
    ),
    ''
  ),
  'category-' || "id"::text
)
WHERE "slug" IS NOT NULL;

-- 3) Backfill missing slugs from name (stable slugify), fallback to category-<id>
UPDATE "MenuCategory"
SET "slug" = COALESCE(
  NULLIF(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(btrim(COALESCE("name", ''))), '[^a-z0-9]+', '-', 'g'),
        '-+',
        '-',
        'g'
      ),
      '(^-+|-+$)',
      '',
      'g'
    ),
    ''
  ),
  'category-' || "id"::text
)
WHERE "slug" IS NULL;

-- 4) If normalization/backfill created duplicates within a branch, disambiguate by appending -<id>
WITH ranked AS (
  SELECT
    "id",
    "branchId",
    "slug",
    row_number() OVER (PARTITION BY "branchId", "slug" ORDER BY "id") AS rn
  FROM "MenuCategory"
)
UPDATE "MenuCategory" mc
SET "slug" = mc."slug" || '-' || mc."id"::text
FROM ranked r
WHERE mc."id" = r."id" AND r.rn > 1;

-- 5) Enforce NOT NULL
ALTER TABLE "MenuCategory"
ALTER COLUMN "slug" SET NOT NULL;

