-- Parent invite onboarding tables.
CREATE TYPE "ParentInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');
CREATE TYPE "ParentInviteAuditAction" AS ENUM ('INVITE_CREATED', 'INVITE_SENT', 'INVITE_RESENT', 'INVITE_REVOKED', 'INVITE_EXPIRED', 'INVITE_ACCEPTED');

CREATE TABLE "ParentInvite" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "surname" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "tokenHash" TEXT NOT NULL,
  "status" "ParentInviteStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "acceptedBy" TEXT,
  "acceptedParentId" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revokedBy" TEXT,
  "lastSentAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ParentInvite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ParentInviteAuditLog" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "inviteId" TEXT NOT NULL,
  "action" "ParentInviteAuditAction" NOT NULL,
  "performedBy" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ParentInviteAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ParentInvite_tokenHash_key" ON "ParentInvite"("tokenHash");
CREATE INDEX "ParentInvite_schoolId_email_idx" ON "ParentInvite"("schoolId", "email");
CREATE INDEX "ParentInvite_schoolId_status_expiresAt_idx" ON "ParentInvite"("schoolId", "status", "expiresAt");
CREATE INDEX "ParentInvite_schoolId_createdAt_idx" ON "ParentInvite"("schoolId", "createdAt");
CREATE INDEX "ParentInvite_expiresAt_idx" ON "ParentInvite"("expiresAt");
CREATE INDEX "ParentInviteAuditLog_schoolId_createdAt_idx" ON "ParentInviteAuditLog"("schoolId", "createdAt");
CREATE INDEX "ParentInviteAuditLog_inviteId_createdAt_idx" ON "ParentInviteAuditLog"("inviteId", "createdAt");
CREATE INDEX "ParentInviteAuditLog_schoolId_action_createdAt_idx" ON "ParentInviteAuditLog"("schoolId", "action", "createdAt");

ALTER TABLE "ParentInvite"
  ADD CONSTRAINT "ParentInvite_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentInvite"
  ADD CONSTRAINT "ParentInvite_acceptedParentId_fkey"
  FOREIGN KEY ("acceptedParentId") REFERENCES "Parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ParentInviteAuditLog"
  ADD CONSTRAINT "ParentInviteAuditLog_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentInviteAuditLog"
  ADD CONSTRAINT "ParentInviteAuditLog_inviteId_fkey"
  FOREIGN KEY ("inviteId") REFERENCES "ParentInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;