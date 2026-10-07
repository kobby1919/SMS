ALTER TYPE "DailyCollectionAuditAction" ADD VALUE IF NOT EXISTS 'SESSION_OPENED';
ALTER TYPE "DailyCollectionAuditAction" ADD VALUE IF NOT EXISTS 'ENTRY_MARKED';
ALTER TYPE "DailyCollectionAuditAction" ADD VALUE IF NOT EXISTS 'SESSION_SUBMITTED';
ALTER TYPE "DailyCollectionAuditAction" ADD VALUE IF NOT EXISTS 'SESSION_CONFIRMED';
ALTER TYPE "DailyCollectionAuditAction" ADD VALUE IF NOT EXISTS 'SESSION_FLAGGED';

CREATE TYPE "DailyCollectionSessionStatus" AS ENUM (
  'OPEN',
  'SUBMITTED',
  'CONFIRMED',
  'FLAGGED',
  'CANCELLED'
);

CREATE TYPE "DailyCollectionEntryStatus" AS ENUM (
  'UNPAID',
  'PAID',
  'EXCUSED'
);

CREATE TABLE "DailyCollectionSession" (
  "id" TEXT NOT NULL,
  "collectionDate" TIMESTAMP(3) NOT NULL,
  "status" "DailyCollectionSessionStatus" NOT NULL DEFAULT 'OPEN',
  "expectedAmount" DECIMAL(10,2) NOT NULL,
  "reportedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "confirmedAmount" DECIMAL(10,2),
  "submittedAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "confirmedBy" TEXT,
  "mismatchReason" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL DEFAULT 'default-school',
  "collectorId" TEXT NOT NULL,
  "collectionTypeId" TEXT NOT NULL,

  CONSTRAINT "DailyCollectionSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyCollectionEntry" (
  "id" TEXT NOT NULL,
  "status" "DailyCollectionEntryStatus" NOT NULL DEFAULT 'UNPAID',
  "amountExpected" DECIMAL(10,2) NOT NULL,
  "amountCollected" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "note" TEXT,
  "markedAt" TIMESTAMP(3),
  "markedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL DEFAULT 'default-school',
  "sessionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "collectorId" TEXT NOT NULL,

  CONSTRAINT "DailyCollectionEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyCollectionSession_schoolId_collectionTypeId_collectorId_collectionDate_key"
ON "DailyCollectionSession"("schoolId", "collectionTypeId", "collectorId", "collectionDate");
CREATE INDEX "DailyCollectionSession_schoolId_status_collectionDate_idx"
ON "DailyCollectionSession"("schoolId", "status", "collectionDate");
CREATE INDEX "DailyCollectionSession_schoolId_collectorId_collectionDate_idx"
ON "DailyCollectionSession"("schoolId", "collectorId", "collectionDate");
CREATE INDEX "DailyCollectionSession_schoolId_collectionTypeId_collectionDate_idx"
ON "DailyCollectionSession"("schoolId", "collectionTypeId", "collectionDate");
CREATE INDEX "DailyCollectionSession_schoolId_createdAt_idx"
ON "DailyCollectionSession"("schoolId", "createdAt");

CREATE UNIQUE INDEX "DailyCollectionEntry_sessionId_studentId_key"
ON "DailyCollectionEntry"("sessionId", "studentId");
CREATE INDEX "DailyCollectionEntry_schoolId_sessionId_idx"
ON "DailyCollectionEntry"("schoolId", "sessionId");
CREATE INDEX "DailyCollectionEntry_schoolId_studentId_idx"
ON "DailyCollectionEntry"("schoolId", "studentId");
CREATE INDEX "DailyCollectionEntry_schoolId_collectorId_createdAt_idx"
ON "DailyCollectionEntry"("schoolId", "collectorId", "createdAt");
CREATE INDEX "DailyCollectionEntry_schoolId_status_createdAt_idx"
ON "DailyCollectionEntry"("schoolId", "status", "createdAt");

ALTER TABLE "DailyCollectionSession"
ADD CONSTRAINT "DailyCollectionSession_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DailyCollectionSession"
ADD CONSTRAINT "DailyCollectionSession_collectorId_fkey"
FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DailyCollectionSession"
ADD CONSTRAINT "DailyCollectionSession_collectionTypeId_fkey"
FOREIGN KEY ("collectionTypeId") REFERENCES "DailyCollectionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DailyCollectionEntry"
ADD CONSTRAINT "DailyCollectionEntry_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DailyCollectionEntry"
ADD CONSTRAINT "DailyCollectionEntry_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "DailyCollectionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyCollectionEntry"
ADD CONSTRAINT "DailyCollectionEntry_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DailyCollectionEntry"
ADD CONSTRAINT "DailyCollectionEntry_collectorId_fkey"
FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
