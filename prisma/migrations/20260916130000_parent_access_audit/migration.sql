CREATE TYPE "ParentAccessAuditAction" AS ENUM (
  'PARENT_INVITED',
  'PARENT_ACCOUNT_ACTIVATED',
  'CHILD_LINKED',
  'CHILD_REMOVED',
  'ACCESS_REVOKED',
  'ACCESS_RESTORED',
  'CHILD_TRANSFERRED',
  'CHILD_GRADUATED',
  'EMAIL_CHANGED'
);

CREATE TABLE "ParentAccessAuditLog" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "parentId" TEXT,
  "studentId" TEXT,
  "inviteId" TEXT,
  "relationshipId" TEXT,
  "action" "ParentAccessAuditAction" NOT NULL,
  "performedBy" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ParentAccessAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ParentAccessAuditLog_schoolId_createdAt_idx" ON "ParentAccessAuditLog"("schoolId", "createdAt");
CREATE INDEX "ParentAccessAuditLog_schoolId_parentId_createdAt_idx" ON "ParentAccessAuditLog"("schoolId", "parentId", "createdAt");
CREATE INDEX "ParentAccessAuditLog_schoolId_studentId_createdAt_idx" ON "ParentAccessAuditLog"("schoolId", "studentId", "createdAt");
CREATE INDEX "ParentAccessAuditLog_schoolId_action_createdAt_idx" ON "ParentAccessAuditLog"("schoolId", "action", "createdAt");
CREATE INDEX "ParentAccessAuditLog_relationshipId_createdAt_idx" ON "ParentAccessAuditLog"("relationshipId", "createdAt");
CREATE INDEX "ParentAccessAuditLog_inviteId_createdAt_idx" ON "ParentAccessAuditLog"("inviteId", "createdAt");

ALTER TABLE "ParentAccessAuditLog" ADD CONSTRAINT "ParentAccessAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParentAccessAuditLog" ADD CONSTRAINT "ParentAccessAuditLog_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ParentAccessAuditLog" ADD CONSTRAINT "ParentAccessAuditLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ParentAccessAuditLog" ADD CONSTRAINT "ParentAccessAuditLog_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "ParentInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ParentAccessAuditLog" ADD CONSTRAINT "ParentAccessAuditLog_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "ParentStudentRelationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;
