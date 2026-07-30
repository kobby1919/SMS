ALTER TABLE "School"
ADD COLUMN "legalName" TEXT,
ADD COLUMN "displayName" TEXT,
ADD COLUMN "shortName" TEXT,
ADD COLUMN "emailFromName" TEXT,
ADD COLUMN "primaryColor" TEXT NOT NULL DEFAULT '#2563eb';

UPDATE "School"
SET
  "legalName" = COALESCE("legalName", "name"),
  "displayName" = COALESCE("displayName", "name"),
  "shortName" = COALESCE("shortName", LEFT("name", 40)),
  "emailFromName" = COALESCE("emailFromName", "name")
WHERE
  "legalName" IS NULL
  OR "displayName" IS NULL
  OR "shortName" IS NULL
  OR "emailFromName" IS NULL;
