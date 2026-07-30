CREATE TYPE "ParentDeliveryChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP');
CREATE TYPE "ParentDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "SchoolNotificationSetting" (
  "id" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Africa/Accra',
  "openingTime" TEXT NOT NULL DEFAULT '07:30',
  "closingTime" TEXT NOT NULL DEFAULT '15:00',
  "dailySummarySendTime" TEXT NOT NULL DEFAULT '15:15',
  "activeDays" TEXT[] NOT NULL DEFAULT ARRAY['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']::TEXT[],
  "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
  "urgentAlertsImmediate" BOOLEAN NOT NULL DEFAULT true,
  "quietHoursStart" TEXT NOT NULL DEFAULT '20:00',
  "quietHoursEnd" TEXT NOT NULL DEFAULT '06:00',
  "lastDailySummaryRunAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL,
  CONSTRAINT "SchoolNotificationSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ParentNotificationPreference" (
  "id" TEXT NOT NULL,
  "dailySummaryEnabled" BOOLEAN NOT NULL DEFAULT true,
  "urgentAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "preferredChannel" "ParentDeliveryChannel" NOT NULL DEFAULT 'WHATSAPP',
  "fallbackChannel" "ParentDeliveryChannel" NOT NULL DEFAULT 'SMS',
  "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "whatsappEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL,
  "parentId" TEXT NOT NULL,
  CONSTRAINT "ParentNotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ParentNotificationDeliveryLog" (
  "id" TEXT NOT NULL,
  "channel" "ParentDeliveryChannel" NOT NULL,
  "status" "ParentDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "recipient" TEXT,
  "provider" TEXT,
  "messagePreview" TEXT NOT NULL,
  "errorMessage" TEXT,
  "sentAt" TIMESTAMP(3),
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "schoolId" TEXT NOT NULL,
  "parentId" TEXT NOT NULL,
  "notificationId" TEXT,
  CONSTRAINT "ParentNotificationDeliveryLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolNotificationSetting_schoolId_key"
  ON "SchoolNotificationSetting"("schoolId");

CREATE UNIQUE INDEX "ParentNotificationPreference_parentId_key"
  ON "ParentNotificationPreference"("parentId");

CREATE INDEX "ParentNotificationPreference_schoolId_preferredChannel_idx"
  ON "ParentNotificationPreference"("schoolId", "preferredChannel");

CREATE INDEX "ParentNotificationPreference_schoolId_dailySummaryEnabled_idx"
  ON "ParentNotificationPreference"("schoolId", "dailySummaryEnabled");

CREATE INDEX "ParentNotificationDeliveryLog_schoolId_status_attemptedAt_idx"
  ON "ParentNotificationDeliveryLog"("schoolId", "status", "attemptedAt");

CREATE INDEX "ParentNotificationDeliveryLog_schoolId_parentId_attemptedAt_idx"
  ON "ParentNotificationDeliveryLog"("schoolId", "parentId", "attemptedAt");

CREATE INDEX "ParentNotificationDeliveryLog_schoolId_channel_attemptedAt_idx"
  ON "ParentNotificationDeliveryLog"("schoolId", "channel", "attemptedAt");

CREATE INDEX "ParentNotificationDeliveryLog_notificationId_idx"
  ON "ParentNotificationDeliveryLog"("notificationId");

ALTER TABLE "SchoolNotificationSetting"
  ADD CONSTRAINT "SchoolNotificationSetting_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentNotificationPreference"
  ADD CONSTRAINT "ParentNotificationPreference_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentNotificationPreference"
  ADD CONSTRAINT "ParentNotificationPreference_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentNotificationDeliveryLog"
  ADD CONSTRAINT "ParentNotificationDeliveryLog_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentNotificationDeliveryLog"
  ADD CONSTRAINT "ParentNotificationDeliveryLog_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentNotificationDeliveryLog"
  ADD CONSTRAINT "ParentNotificationDeliveryLog_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "ParentNotification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
