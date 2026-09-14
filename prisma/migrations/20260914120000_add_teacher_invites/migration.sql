-- CreateEnum
CREATE TYPE "TeacherInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "TeacherInviteType" AS ENUM ('SUBJECT_TEACHER', 'CLASS_TEACHER', 'BOTH');

-- CreateTable
CREATE TABLE "TeacherInvite" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "teacherType" "TeacherInviteType" NOT NULL,
    "staffId" TEXT,
    "employmentType" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" "TeacherInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedBy" TEXT,
    "acceptedTeacherId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "lastSentAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherInvite_tokenHash_key" ON "TeacherInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "TeacherInvite_schoolId_email_idx" ON "TeacherInvite"("schoolId", "email");

-- CreateIndex
CREATE INDEX "TeacherInvite_schoolId_status_expiresAt_idx" ON "TeacherInvite"("schoolId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "TeacherInvite_schoolId_teacherType_idx" ON "TeacherInvite"("schoolId", "teacherType");

-- CreateIndex
CREATE INDEX "TeacherInvite_schoolId_createdAt_idx" ON "TeacherInvite"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherInvite_expiresAt_idx" ON "TeacherInvite"("expiresAt");

-- AddForeignKey
ALTER TABLE "TeacherInvite" ADD CONSTRAINT "TeacherInvite_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherInvite" ADD CONSTRAINT "TeacherInvite_acceptedTeacherId_fkey" FOREIGN KEY ("acceptedTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
