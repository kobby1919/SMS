ALTER TABLE "AppNotificationSetting" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Africa/Accra';

ALTER TABLE "AppNotificationSetting" ADD CONSTRAINT "AppNotifSetting_timezone_not_blank_chk" CHECK (length(btrim("timezone")) > 0);
ALTER TABLE "AppNotificationPreference" ADD CONSTRAINT "AppNotifPref_recipient_not_blank_chk" CHECK (length(btrim("recipientId")) > 0);