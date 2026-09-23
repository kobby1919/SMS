CREATE TABLE "AppNotificationSetting" (
  "id" TEXT NOT NULL,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
  "sendWeeklyFinanceSummaryToAdmins" BOOLEAN NOT NULL DEFAULT true,
  "sendDailyFinanceReportToAdmins" BOOLEAN NOT NULL DEFAULT false,
  "sendParentSummariesByEmail" BOOLEAN NOT NULL DEFAULT true,
  "sendParentSummariesBySms" BOOLEAN NOT NULL DEFAULT false,
  "sendParentSummariesByWhatsapp" BOOLEAN NOT NULL DEFAULT false,
  "quietHoursStart" TEXT NOT NULL DEFAULT '20:00',
  "quietHoursEnd" TEXT NOT NULL DEFAULT '06:00',
  "highPriorityOverridesQuietHours" BOOLEAN NOT NULL DEFAULT true,
  "urgentPriorityOverridesChannels" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL,

  CONSTRAINT "AppNotificationSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppNotificationPreference" (
  "id" TEXT NOT NULL,
  "recipientType" "AppNotificationRecipientType" NOT NULL,
  "recipientId" TEXT NOT NULL,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
  "quietHoursStart" TEXT,
  "quietHoursEnd" TEXT,
  "highPriorityOverridesQuietHours" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL,

  CONSTRAINT "AppNotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppNotificationSetting_schoolId_key" ON "AppNotificationSetting"("schoolId");
CREATE UNIQUE INDEX "AppNotifPref_recipient_key" ON "AppNotificationPreference"("schoolId", "recipientType", "recipientId");
CREATE INDEX "AppNotifPref_recipient_idx" ON "AppNotificationPreference"("schoolId", "recipientType", "recipientId");
CREATE INDEX "AppNotifPref_role_updated_idx" ON "AppNotificationPreference"("schoolId", "recipientType", "updatedAt");

ALTER TABLE "AppNotificationSetting" ADD CONSTRAINT "AppNotificationSetting_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppNotificationPreference" ADD CONSTRAINT "AppNotificationPreference_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AppNotificationSetting" ADD CONSTRAINT "AppNotifSetting_quiet_start_format_chk" CHECK ("quietHoursStart" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "AppNotificationSetting" ADD CONSTRAINT "AppNotifSetting_quiet_end_format_chk" CHECK ("quietHoursEnd" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "AppNotificationPreference" ADD CONSTRAINT "AppNotifPref_quiet_start_format_chk" CHECK ("quietHoursStart" IS NULL OR "quietHoursStart" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "AppNotificationPreference" ADD CONSTRAINT "AppNotifPref_quiet_end_format_chk" CHECK ("quietHoursEnd" IS NULL OR "quietHoursEnd" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');