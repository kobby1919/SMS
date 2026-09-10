CREATE TABLE "SchoolCommunicationPolicy" (
  "id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "allowParentTeacherMessaging" BOOLEAN NOT NULL DEFAULT false,
  "allowInAppMessages" BOOLEAN NOT NULL DEFAULT true,
  "allowEmailMessages" BOOLEAN NOT NULL DEFAULT true,
  "allowSmsMessages" BOOLEAN NOT NULL DEFAULT false,
  "allowWhatsappMessages" BOOLEAN NOT NULL DEFAULT false,
  "exposeTeacherPhone" BOOLEAN NOT NULL DEFAULT false,
  "exposeTeacherEmail" BOOLEAN NOT NULL DEFAULT false,
  "requireParentReason" BOOLEAN NOT NULL DEFAULT true,
  "requireTeacherResponse" BOOLEAN NOT NULL DEFAULT true,
  "contactStartTime" TEXT NOT NULL DEFAULT '07:00',
  "contactEndTime" TEXT NOT NULL DEFAULT '17:00',
  "quietHoursStart" TEXT NOT NULL DEFAULT '20:00',
  "quietHoursEnd" TEXT NOT NULL DEFAULT '06:00',
  "responseSlaHours" INTEGER NOT NULL DEFAULT 24,
  "escalationEnabled" BOOLEAN NOT NULL DEFAULT true,
  "escalateAfterHours" INTEGER NOT NULL DEFAULT 48,
  "urgentBypassesQuietHours" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL,

  CONSTRAINT "SchoolCommunicationPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolCommunicationPolicy_schoolId_key"
  ON "SchoolCommunicationPolicy"("schoolId");

ALTER TABLE "SchoolCommunicationPolicy"
  ADD CONSTRAINT "SchoolCommunicationPolicy_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
