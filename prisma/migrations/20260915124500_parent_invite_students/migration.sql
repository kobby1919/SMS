CREATE TABLE "ParentInviteStudent" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "inviteId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ParentInviteStudent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ParentInviteStudent_inviteId_studentId_key" ON "ParentInviteStudent"("inviteId", "studentId");
CREATE INDEX "ParentInviteStudent_schoolId_inviteId_idx" ON "ParentInviteStudent"("schoolId", "inviteId");
CREATE INDEX "ParentInviteStudent_schoolId_studentId_idx" ON "ParentInviteStudent"("schoolId", "studentId");

ALTER TABLE "ParentInviteStudent"
  ADD CONSTRAINT "ParentInviteStudent_inviteId_fkey"
  FOREIGN KEY ("inviteId") REFERENCES "ParentInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentInviteStudent"
  ADD CONSTRAINT "ParentInviteStudent_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;