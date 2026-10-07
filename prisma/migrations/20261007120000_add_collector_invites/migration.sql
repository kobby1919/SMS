CREATE TYPE "CollectorInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

CREATE TYPE "CollectorInviteAuditAction" AS ENUM ('INVITE_CREATED', 'INVITE_SENT', 'INVITE_RESENT', 'INVITE_REVOKED', 'INVITE_EXPIRED', 'INVITE_ACCEPTED');

CREATE TABLE "CollectorInvite" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "sex" "UserSex" NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "staffId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" "CollectorInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedBy" TEXT,
    "acceptedCollectorId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "lastSentAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectorInvite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CollectorInviteAuditLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "action" "CollectorInviteAuditAction" NOT NULL,
    "performedBy" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectorInviteAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CollectorInvite_tokenHash_key" ON "CollectorInvite"("tokenHash");
CREATE INDEX "CollectorInvite_schoolId_email_idx" ON "CollectorInvite"("schoolId", "email");
CREATE INDEX "CollectorInvite_schoolId_status_expiresAt_idx" ON "CollectorInvite"("schoolId", "status", "expiresAt");
CREATE INDEX "CollectorInvite_schoolId_createdAt_idx" ON "CollectorInvite"("schoolId", "createdAt");
CREATE INDEX "CollectorInvite_expiresAt_idx" ON "CollectorInvite"("expiresAt");
CREATE INDEX "CollectorInviteAuditLog_schoolId_createdAt_idx" ON "CollectorInviteAuditLog"("schoolId", "createdAt");
CREATE INDEX "CollectorInviteAuditLog_inviteId_createdAt_idx" ON "CollectorInviteAuditLog"("inviteId", "createdAt");
CREATE INDEX "CollectorInviteAuditLog_schoolId_action_createdAt_idx" ON "CollectorInviteAuditLog"("schoolId", "action", "createdAt");

ALTER TABLE "CollectorInvite" ADD CONSTRAINT "CollectorInvite_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectorInvite" ADD CONSTRAINT "CollectorInvite_acceptedCollectorId_fkey" FOREIGN KEY ("acceptedCollectorId") REFERENCES "Collector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CollectorInviteAuditLog" ADD CONSTRAINT "CollectorInviteAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectorInviteAuditLog" ADD CONSTRAINT "CollectorInviteAuditLog_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "CollectorInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
