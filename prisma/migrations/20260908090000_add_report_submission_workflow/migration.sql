ALTER TYPE "ReportPublicationStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
ALTER TYPE "ReportPublicationStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TABLE "ReportCardPublication"
  ALTER COLUMN "status" SET DEFAULT 'UNPUBLISHED',
  ALTER COLUMN "publishedAt" DROP DEFAULT,
  ALTER COLUMN "publishedAt" DROP NOT NULL,
  ALTER COLUMN "publishedBy" DROP NOT NULL,
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "submittedBy" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedBy" TEXT,
  ADD COLUMN "reviewNote" TEXT;

CREATE INDEX "ReportCardPublication_schoolId_status_submittedAt_idx"
  ON "ReportCardPublication"("schoolId", "status", "submittedAt");

CREATE INDEX "ReportCardPublication_schoolId_submittedBy_status_idx"
  ON "ReportCardPublication"("schoolId", "submittedBy", "status");
