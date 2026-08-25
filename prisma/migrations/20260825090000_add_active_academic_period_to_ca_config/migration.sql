ALTER TABLE "CAConfig"
ADD COLUMN "currentTerm" "Term" NOT NULL DEFAULT 'TERM_1',
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "CAConfig_schoolId_isActive_idx" ON "CAConfig"("schoolId", "isActive");

UPDATE "CAConfig" active
SET "isActive" = true
WHERE active.id = (
  SELECT latest.id
  FROM "CAConfig" latest
  WHERE latest."schoolId" = active."schoolId"
  ORDER BY latest."academicYear" DESC, latest.id DESC
  LIMIT 1
);
