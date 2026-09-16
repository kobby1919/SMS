CREATE TYPE "BursarStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'LEFT_SCHOOL');
CREATE TYPE "BursarInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');
CREATE TYPE "BursarInviteAuditAction" AS ENUM ('INVITE_CREATED', 'INVITE_SENT', 'INVITE_RESENT', 'INVITE_REVOKED', 'INVITE_EXPIRED', 'INVITE_ACCEPTED');

CREATE TABLE "Bursar" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "surname" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "status" "BursarStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL DEFAULT 'default-school',
  CONSTRAINT "Bursar_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BursarInvite" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "surname" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "staffId" TEXT,
  "tokenHash" TEXT NOT NULL,
  "status" "BursarInviteStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "acceptedBy" TEXT,
  "acceptedBursarId" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revokedBy" TEXT,
  "lastSentAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BursarInvite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BursarInviteAuditLog" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "inviteId" TEXT NOT NULL,
  "action" "BursarInviteAuditAction" NOT NULL,
  "performedBy" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BursarInviteAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Bursar_username_key" ON "Bursar"("username");
CREATE UNIQUE INDEX "Bursar_schoolId_email_key" ON "Bursar"("schoolId", "email");
CREATE INDEX "Bursar_schoolId_idx" ON "Bursar"("schoolId");
CREATE INDEX "Bursar_schoolId_status_idx" ON "Bursar"("schoolId", "status");
CREATE INDEX "Bursar_schoolId_createdAt_idx" ON "Bursar"("schoolId", "createdAt");

CREATE UNIQUE INDEX "BursarInvite_tokenHash_key" ON "BursarInvite"("tokenHash");
CREATE INDEX "BursarInvite_schoolId_email_idx" ON "BursarInvite"("schoolId", "email");
CREATE INDEX "BursarInvite_schoolId_status_expiresAt_idx" ON "BursarInvite"("schoolId", "status", "expiresAt");
CREATE INDEX "BursarInvite_schoolId_createdAt_idx" ON "BursarInvite"("schoolId", "createdAt");
CREATE INDEX "BursarInvite_expiresAt_idx" ON "BursarInvite"("expiresAt");

CREATE INDEX "BursarInviteAuditLog_schoolId_createdAt_idx" ON "BursarInviteAuditLog"("schoolId", "createdAt");
CREATE INDEX "BursarInviteAuditLog_inviteId_createdAt_idx" ON "BursarInviteAuditLog"("inviteId", "createdAt");
CREATE INDEX "BursarInviteAuditLog_schoolId_action_createdAt_idx" ON "BursarInviteAuditLog"("schoolId", "action", "createdAt");

ALTER TABLE "Bursar"
ADD CONSTRAINT "Bursar_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BursarInvite"
ADD CONSTRAINT "BursarInvite_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BursarInvite"
ADD CONSTRAINT "BursarInvite_acceptedBursarId_fkey"
FOREIGN KEY ("acceptedBursarId") REFERENCES "Bursar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BursarInviteAuditLog"
ADD CONSTRAINT "BursarInviteAuditLog_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BursarInviteAuditLog"
ADD CONSTRAINT "BursarInviteAuditLog_inviteId_fkey"
FOREIGN KEY ("inviteId") REFERENCES "BursarInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
