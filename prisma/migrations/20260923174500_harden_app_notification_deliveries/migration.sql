ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotif_id_school_key" UNIQUE ("id", "schoolId");

ALTER TABLE "AppNotificationDelivery" DROP CONSTRAINT "AppNotificationDelivery_notificationId_fkey";

ALTER TABLE "AppNotificationDelivery" ADD CONSTRAINT "AppNotificationDelivery_notification_school_fkey" FOREIGN KEY ("notificationId", "schoolId") REFERENCES "AppNotification"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AppNotificationDelivery" ADD CONSTRAINT "AppNotifDelivery_attempts_nonnegative_chk" CHECK ("attempts" >= 0);

ALTER TABLE "AppNotificationDelivery" ADD CONSTRAINT "AppNotifDelivery_destination_not_blank_chk" CHECK (length(btrim("destination")) > 0);

ALTER TABLE "AppNotificationDelivery" ADD CONSTRAINT "AppNotifDelivery_provider_msg_not_blank_chk" CHECK ("providerMessageId" IS NULL OR length(btrim("providerMessageId")) > 0);

ALTER TABLE "AppNotificationDelivery" ADD CONSTRAINT "AppNotifDelivery_terminal_timestamp_chk" CHECK (
  ("status" <> 'DELIVERED' OR "deliveredAt" IS NOT NULL)
  AND ("status" <> 'FAILED' OR "failedAt" IS NOT NULL)
  AND ("status" <> 'SENT' OR "sentAt" IS NOT NULL)
);