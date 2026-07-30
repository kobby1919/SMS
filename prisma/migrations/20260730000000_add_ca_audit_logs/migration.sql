-- Audit trail for activity-based CA changes and locks.

CREATE TABLE "CAAuditLog" (
  "id" SERIAL NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "schoolId" TEXT NOT NULL DEFAULT 'default-school',
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CAAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CAAuditLog_schoolId_createdAt_idx"
  ON "CAAuditLog"("schoolId", "createdAt");

CREATE INDEX "CAAuditLog_schoolId_actorId_createdAt_idx"
  ON "CAAuditLog"("schoolId", "actorId", "createdAt");

CREATE INDEX "CAAuditLog_schoolId_entityType_entityId_idx"
  ON "CAAuditLog"("schoolId", "entityType", "entityId");

ALTER TABLE "CAAuditLog"
  ADD CONSTRAINT "CAAuditLog_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
