-- Parent notification inbox for app-delivered parent transparency updates.

CREATE TYPE "ParentNotificationType" AS ENUM (
  'ATTENDANCE',
  'ASSESSMENT',
  'ASSIGNMENT',
  'ANNOUNCEMENT',
  'BILL',
  'PAYMENT'
);

CREATE TYPE "ParentNotificationPriority" AS ENUM (
  'LOW',
  'NORMAL',
  'HIGH'
);

CREATE TABLE "ParentNotification" (
  "id" TEXT NOT NULL,
  "type" "ParentNotificationType" NOT NULL,
  "priority" "ParentNotificationPriority" NOT NULL DEFAULT 'NORMAL',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "href" TEXT,
  "sourceModel" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "readAt" TIMESTAMP(3),
  "schoolId" TEXT NOT NULL,
  "parentId" TEXT NOT NULL,
  "studentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ParentNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ParentNotification_schoolId_parentId_sourceKey_key"
  ON "ParentNotification"("schoolId", "parentId", "sourceKey");

CREATE INDEX "ParentNotification_schoolId_parentId_readAt_occurredAt_idx"
  ON "ParentNotification"("schoolId", "parentId", "readAt", "occurredAt");

CREATE INDEX "ParentNotification_schoolId_parentId_type_occurredAt_idx"
  ON "ParentNotification"("schoolId", "parentId", "type", "occurredAt");

CREATE INDEX "ParentNotification_schoolId_studentId_occurredAt_idx"
  ON "ParentNotification"("schoolId", "studentId", "occurredAt");

ALTER TABLE "ParentNotification"
  ADD CONSTRAINT "ParentNotification_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentNotification"
  ADD CONSTRAINT "ParentNotification_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentNotification"
  ADD CONSTRAINT "ParentNotification_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
