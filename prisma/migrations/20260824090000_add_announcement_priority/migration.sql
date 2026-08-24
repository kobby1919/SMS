-- CreateEnum
CREATE TYPE "AnnouncementPriority" AS ENUM ('NORMAL', 'IMPORTANT', 'URGENT');

-- AlterTable
ALTER TABLE "Announcement"
ADD COLUMN "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Announcement_schoolId_priority_date_idx" ON "Announcement"("schoolId", "priority", "date");

-- CreateIndex
CREATE INDEX "Announcement_schoolId_expiresAt_idx" ON "Announcement"("schoolId", "expiresAt");
