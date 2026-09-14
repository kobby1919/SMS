-- CreateEnum
CREATE TYPE "TeacherInviteAuditAction" AS ENUM (
  'INVITE_CREATED',
  'INVITE_SENT',
  'INVITE_RESENT',
  'INVITE_REVOKED',
  'INVITE_EXPIRED',
  'INVITE_ACCEPTED'
);

-- CreateTable
CREATE TABLE "TeacherInviteAuditLog" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "inviteId" TEXT NOT NULL,
  "action" "TeacherInviteAuditAction" NOT NULL,
  "performedBy" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TeacherInviteAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherInviteAuditLog_schoolId_createdAt_idx"
  ON "TeacherInviteAuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherInviteAuditLog_inviteId_createdAt_idx"
  ON "TeacherInviteAuditLog"("inviteId", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherInviteAuditLog_schoolId_action_createdAt_idx"
  ON "TeacherInviteAuditLog"("schoolId", "action", "createdAt");

-- AddForeignKey
ALTER TABLE "TeacherInviteAuditLog"
  ADD CONSTRAINT "TeacherInviteAuditLog_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherInviteAuditLog"
  ADD CONSTRAINT "TeacherInviteAuditLog_inviteId_fkey"
  FOREIGN KEY ("inviteId") REFERENCES "TeacherInvite"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
