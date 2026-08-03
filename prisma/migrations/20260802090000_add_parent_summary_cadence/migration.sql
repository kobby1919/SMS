CREATE TYPE "ParentSummaryCadence" AS ENUM ('DAILY', 'WEEKLY', 'BOTH', 'OFF');

ALTER TABLE "SchoolNotificationSetting"
  ADD COLUMN "summaryCadence" "ParentSummaryCadence" NOT NULL DEFAULT 'WEEKLY',
  ADD COLUMN "weeklySummarySendDay" TEXT NOT NULL DEFAULT 'FRIDAY',
  ADD COLUMN "weeklySummarySendTime" TEXT NOT NULL DEFAULT '15:15',
  ADD COLUMN "lastWeeklySummaryRunAt" TIMESTAMP(3);

ALTER TABLE "ParentNotificationPreference"
  ADD COLUMN "weeklySummaryEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "ParentNotificationPreference_schoolId_weeklySummaryEnabled_idx"
  ON "ParentNotificationPreference"("schoolId", "weeklySummaryEnabled");
