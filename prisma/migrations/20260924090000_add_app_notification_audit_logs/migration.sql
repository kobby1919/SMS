-- CreateEnum
CREATE TYPE "AppNotificationAuditEvent" AS ENUM ('NOTIFICATION_CREATED', 'DELIVERY_QUEUED', 'DELIVERY_SENT', 'DELIVERY_DELIVERED', 'DELIVERY_FAILED', 'DELIVERY_RETRY_SCHEDULED', 'DELIVERY_RETRY_REQUESTED', 'DELIVERY_CANCELLED', 'DELIVERY_DEFERRED', 'NOTIFICATION_READ');

-- CreateTable
CREATE TABLE "AppNotificationAuditLog" (
    "id" TEXT NOT NULL,
    "event" "AppNotificationAuditEvent" NOT NULL,
    "channel" "AppNotificationDeliveryChannel",
    "fromStatus" "AppNotificationDeliveryStatus",
    "toStatus" "AppNotificationDeliveryStatus",
    "provider" TEXT,
    "destination" TEXT,
    "providerMessageId" TEXT,
    "message" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schoolId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "deliveryId" TEXT,

    CONSTRAINT "AppNotificationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppNotifAudit_notification_idx" ON "AppNotificationAuditLog"("schoolId", "notificationId", "createdAt");

-- CreateIndex
CREATE INDEX "AppNotifAudit_delivery_idx" ON "AppNotificationAuditLog"("schoolId", "deliveryId", "createdAt");

-- CreateIndex
CREATE INDEX "AppNotifAudit_event_idx" ON "AppNotificationAuditLog"("schoolId", "event", "createdAt");

-- CreateIndex
CREATE INDEX "AppNotifAudit_channel_idx" ON "AppNotificationAuditLog"("schoolId", "channel", "createdAt");

-- CreateIndex
CREATE INDEX "AppNotifAudit_provider_msg_idx" ON "AppNotificationAuditLog"("schoolId", "provider", "providerMessageId");

-- AddForeignKey
ALTER TABLE "AppNotificationAuditLog" ADD CONSTRAINT "AppNotificationAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppNotificationAuditLog" ADD CONSTRAINT "AppNotificationAuditLog_notificationId_schoolId_fkey" FOREIGN KEY ("notificationId", "schoolId") REFERENCES "AppNotification"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppNotificationAuditLog" ADD CONSTRAINT "AppNotificationAuditLog_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "AppNotificationDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;
