-- Add the tenant onboarding lifecycle and secure first-admin invitations.

CREATE TYPE "WaitlistStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SCHOOL_CREATED');
CREATE TYPE "SchoolOnboardingStatus" AS ENUM ('PENDING_SETUP', 'PROFILE_DONE', 'ACADEMIC_DONE', 'USERS_DONE', 'COMPLETED');
CREATE TYPE "SchoolInviteRole" AS ENUM ('ADMIN');

ALTER TABLE "School"
ADD COLUMN "contactEmail" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "onboardingStatus" "SchoolOnboardingStatus" NOT NULL DEFAULT 'PENDING_SETUP',
ADD COLUMN "setupStep" TEXT,
ADD COLUMN "setupCompletedAt" TIMESTAMP(3);

ALTER TABLE "WaitlistEntry"
ADD COLUMN "status" "WaitlistStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "reviewedBy" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "schoolId" TEXT;

CREATE TABLE "SchoolInvite" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "SchoolInviteRole" NOT NULL DEFAULT 'ADMIN',
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SchoolInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolInvite_tokenHash_key" ON "SchoolInvite"("tokenHash");
CREATE INDEX "SchoolInvite_schoolId_email_idx" ON "SchoolInvite"("schoolId", "email");
CREATE INDEX "SchoolInvite_expiresAt_idx" ON "SchoolInvite"("expiresAt");
CREATE INDEX "WaitlistEntry_status_createdAt_idx" ON "WaitlistEntry"("status", "createdAt");

ALTER TABLE "WaitlistEntry"
ADD CONSTRAINT "WaitlistEntry_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SchoolInvite"
ADD CONSTRAINT "SchoolInvite_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
