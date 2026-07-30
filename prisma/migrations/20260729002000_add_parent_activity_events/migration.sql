-- Raw parent activity events plus structured daily summary notifications.

ALTER TYPE "ParentNotificationType" ADD VALUE IF NOT EXISTS 'DAILY_SUMMARY';

ALTER TABLE "ParentNotification"
  ADD COLUMN "payload" JSONB;

CREATE TABLE "ParentActivityEvent" (
  "id" TEXT NOT NULL,
  "type" "ParentNotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "href" TEXT,
  "payload" JSONB,
  "sourceModel" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL,
  "parentId" TEXT NOT NULL,
  "studentId" TEXT,
  "teacherId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ParentActivityEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ParentActivityEvent_schoolId_parentId_sourceKey_key"
  ON "ParentActivityEvent"("schoolId", "parentId", "sourceKey");

CREATE INDEX "ParentActivityEvent_schoolId_parentId_occurredAt_idx"
  ON "ParentActivityEvent"("schoolId", "parentId", "occurredAt");

CREATE INDEX "ParentActivityEvent_schoolId_studentId_occurredAt_idx"
  ON "ParentActivityEvent"("schoolId", "studentId", "occurredAt");

CREATE INDEX "ParentActivityEvent_schoolId_teacherId_occurredAt_idx"
  ON "ParentActivityEvent"("schoolId", "teacherId", "occurredAt");

ALTER TABLE "ParentActivityEvent"
  ADD CONSTRAINT "ParentActivityEvent_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentActivityEvent"
  ADD CONSTRAINT "ParentActivityEvent_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentActivityEvent"
  ADD CONSTRAINT "ParentActivityEvent_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ParentActivityEvent"
  ADD CONSTRAINT "ParentActivityEvent_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
