CREATE TYPE "ParentTeacherContactMessageSender" AS ENUM (
  'PARENT',
  'TEACHER',
  'ADMIN',
  'SYSTEM'
);

CREATE TABLE "ParentTeacherContactMessage" (
  "id" TEXT NOT NULL,
  "senderRole" "ParentTeacherContactMessageSender" NOT NULL,
  "senderId" TEXT,
  "body" TEXT NOT NULL,
  "internalOnly" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "schoolId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "parentId" TEXT,
  "teacherId" TEXT,

  CONSTRAINT "ParentTeacherContactMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ParentTeacherContactMessage_schoolId_requestId_createdAt_idx"
  ON "ParentTeacherContactMessage"("schoolId", "requestId", "createdAt");

CREATE INDEX "ParentTeacherContactMessage_schoolId_teacherId_createdAt_idx"
  ON "ParentTeacherContactMessage"("schoolId", "teacherId", "createdAt");

CREATE INDEX "ParentTeacherContactMessage_schoolId_parentId_createdAt_idx"
  ON "ParentTeacherContactMessage"("schoolId", "parentId", "createdAt");

ALTER TABLE "ParentTeacherContactMessage"
  ADD CONSTRAINT "ParentTeacherContactMessage_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentTeacherContactMessage"
  ADD CONSTRAINT "ParentTeacherContactMessage_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "ParentTeacherContactRequest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentTeacherContactMessage"
  ADD CONSTRAINT "ParentTeacherContactMessage_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Parent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ParentTeacherContactMessage"
  ADD CONSTRAINT "ParentTeacherContactMessage_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
