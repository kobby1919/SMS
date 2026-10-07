ALTER TABLE "DailyCollectionType"
ADD COLUMN "normalizedName" TEXT;

UPDATE "DailyCollectionType"
SET "normalizedName" = lower(regexp_replace(trim("name"), '\s+', ' ', 'g'));

ALTER TABLE "DailyCollectionType"
ALTER COLUMN "normalizedName" SET NOT NULL;

CREATE UNIQUE INDEX "DailyCollectionType_schoolId_normalizedName_key"
ON "DailyCollectionType"("schoolId", "normalizedName");
