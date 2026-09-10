CREATE TYPE "ParentTeacherContactChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'WHATSAPP');

CREATE TYPE "ParentTeacherContactCategory" AS ENUM ('ATTENDANCE', 'ACADEMIC_SUPPORT', 'HOMEWORK', 'WELLBEING', 'GENERAL');

CREATE TYPE "ParentTeacherContactStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'RESPONDED', 'ESCALATED', 'CLOSED', 'CANCELLED');

CREATE TABLE "ParentTeacherContactRequest" (
  "id" TEXT NOT NULL,
  "category" "ParentTeacherContactCategory" NOT NULL,
  "preferredChannel" "ParentTeacherContactChannel" NOT NULL DEFAULT 'IN_APP',
  "priority" "ParentNotificationPriority" NOT NULL DEFAULT 'NORMAL',
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "ParentTeacherContactStatus" NOT NULL DEFAULT 'PENDING',
  "responseDueAt" TIMESTAMP(3),
  "acknowledgedAt" TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "lastParentMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastTeacherResponseAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL,
  "parentId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,

  CONSTRAINT "ParentTeacherContactRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ParentTeacherContactRequest_schoolId_parentId_status_createdAt_idx"
  ON "ParentTeacherContactRequest"("schoolId", "parentId", "status", "createdAt");

CREATE INDEX "ParentTeacherContactRequest_schoolId_teacherId_status_responseDueAt_idx"
  ON "ParentTeacherContactRequest"("schoolId", "teacherId", "status", "responseDueAt");

CREATE INDEX "ParentTeacherContactRequest_schoolId_studentId_createdAt_idx"
  ON "ParentTeacherContactRequest"("schoolId", "studentId", "createdAt");

CREATE INDEX "ParentTeacherContactRequest_schoolId_status_responseDueAt_idx"
  ON "ParentTeacherContactRequest"("schoolId", "status", "responseDueAt");

ALTER TABLE "ParentTeacherContactRequest"
  ADD CONSTRAINT "ParentTeacherContactRequest_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentTeacherContactRequest"
  ADD CONSTRAINT "ParentTeacherContactRequest_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Parent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentTeacherContactRequest"
  ADD CONSTRAINT "ParentTeacherContactRequest_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentTeacherContactRequest"
  ADD CONSTRAINT "ParentTeacherContactRequest_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
