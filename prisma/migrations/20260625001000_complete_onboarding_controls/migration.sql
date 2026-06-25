-- Complete onboarding controls: school branding, invite lifecycle, and audit visibility.

CREATE TYPE "OnboardingAuditAction" AS ENUM (
  'WAITLIST_APPROVED',
  'WAITLIST_REJECTED',
  'SCHOOL_CREATED',
  'INVITE_CREATED',
  'INVITE_SENT',
  'INVITE_RESENT',
  'INVITE_REVOKED',
  'INVITE_ACCEPTED',
  'PROFILE_UPDATED',
  'DEFAULT_ACADEMICS_CREATED',
  'IMPORT_RECORDED',
  'ONBOARDING_COMPLETED'
);

ALTER TABLE "School"
ADD COLUMN "logoUrl" TEXT;

ALTER TABLE "SchoolInvite"
ADD COLUMN "revokedAt" TIMESTAMP(3),
ADD COLUMN "revokedBy" TEXT,
ADD COLUMN "lastSentAt" TIMESTAMP(3);

CREATE TABLE "OnboardingAuditLog" (
  "id" SERIAL NOT NULL,
  "schoolId" TEXT,
  "waitlistId" TEXT,
  "inviteId" TEXT,
  "action" "OnboardingAuditAction" NOT NULL,
  "performedBy" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OnboardingAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SchoolInvite_schoolId_revokedAt_idx" ON "SchoolInvite"("schoolId", "revokedAt");
CREATE INDEX "OnboardingAuditLog_schoolId_createdAt_idx" ON "OnboardingAuditLog"("schoolId", "createdAt");
CREATE INDEX "OnboardingAuditLog_action_createdAt_idx" ON "OnboardingAuditLog"("action", "createdAt");

ALTER TABLE "OnboardingAuditLog"
ADD CONSTRAINT "OnboardingAuditLog_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
