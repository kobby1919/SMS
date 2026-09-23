CREATE TYPE "AppNotificationRecipientType" AS ENUM ('ADMIN', 'TEACHER', 'PARENT', 'BURSAR', 'OWNER');

CREATE TYPE "AppNotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TYPE "AppNotificationCategory" AS ENUM ('FINANCE', 'ACADEMIC', 'ATTENDANCE', 'ACCOUNTABILITY', 'GENERAL');

CREATE TYPE "AppNotificationType" AS ENUM (
  'WEEKLY_FINANCE_SUMMARY',
  'DAILY_FINANCE_REPORT',
  'PARENT_DAILY_SUMMARY',
  'PAYMENT_CORRECTION',
  'FINANCE_QUERY',
  'ATTENDANCE_ALERT',
  'ACCOUNTABILITY_ALERT',
  'REPORT_CARD',
  'ANNOUNCEMENT',
  'SYSTEM'
);

CREATE TABLE "AppNotification" (
  "id" TEXT NOT NULL,
  "recipientType" "AppNotificationRecipientType" NOT NULL,
  "recipientId" TEXT NOT NULL,
  "type" "AppNotificationType" NOT NULL,
  "category" "AppNotificationCategory" NOT NULL,
  "priority" "AppNotificationPriority" NOT NULL DEFAULT 'NORMAL',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "href" TEXT,
  "payload" JSONB,
  "sourceModel" TEXT,
  "sourceId" TEXT,
  "idempotencyKey" TEXT,
  "readAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL,

  CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppNotif_school_idempotency_key" ON "AppNotification"("schoolId", "idempotencyKey");
CREATE INDEX "AppNotif_recipient_read_created_idx" ON "AppNotification"("schoolId", "recipientType", "recipientId", "readAt", "createdAt");
CREATE INDEX "AppNotif_recipient_created_idx" ON "AppNotification"("schoolId", "recipientType", "recipientId", "createdAt");
CREATE INDEX "AppNotif_category_created_idx" ON "AppNotification"("schoolId", "category", "createdAt");
CREATE INDEX "AppNotif_type_created_idx" ON "AppNotification"("schoolId", "type", "createdAt");
CREATE INDEX "AppNotif_source_idx" ON "AppNotification"("schoolId", "sourceModel", "sourceId");
CREATE INDEX "AppNotif_expires_idx" ON "AppNotification"("expiresAt");

ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;