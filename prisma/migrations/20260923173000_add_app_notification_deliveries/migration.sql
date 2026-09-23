CREATE TYPE "AppNotificationDeliveryChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'WHATSAPP');

CREATE TYPE "AppNotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING', 'CANCELLED');

CREATE TABLE "AppNotificationDelivery" (
  "id" TEXT NOT NULL,
  "channel" "AppNotificationDeliveryChannel" NOT NULL,
  "status" "AppNotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "provider" TEXT,
  "destination" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "providerMessageId" TEXT,
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "nextAttemptAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,

  CONSTRAINT "AppNotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppNotifDelivery_once_per_destination" ON "AppNotificationDelivery"("notificationId", "channel", "destination");
CREATE INDEX "AppNotifDelivery_worker_idx" ON "AppNotificationDelivery"("schoolId", "status", "nextAttemptAt", "createdAt");
CREATE INDEX "AppNotifDelivery_history_idx" ON "AppNotificationDelivery"("notificationId", "createdAt");
CREATE INDEX "AppNotifDelivery_provider_msg_idx" ON "AppNotificationDelivery"("schoolId", "provider", "providerMessageId");
CREATE INDEX "AppNotifDelivery_failure_idx" ON "AppNotificationDelivery"("schoolId", "status", "failedAt");
CREATE INDEX "AppNotifDelivery_channel_status_idx" ON "AppNotificationDelivery"("schoolId", "channel", "status", "createdAt");

ALTER TABLE "AppNotificationDelivery" ADD CONSTRAINT "AppNotificationDelivery_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppNotificationDelivery" ADD CONSTRAINT "AppNotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "AppNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;