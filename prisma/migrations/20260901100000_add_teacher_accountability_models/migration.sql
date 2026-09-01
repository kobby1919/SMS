CREATE TYPE "TeacherObligationType" AS ENUM (
  'ATTENDANCE',
  'CA_SCORE_PUBLISHING',
  'HOMEWORK_CHECKING',
  'SYLLABUS_PROGRESS',
  'EXAM_ENTRY',
  'CORRECTION_REVIEW'
);

CREATE TYPE "TeacherObligationStatus" AS ENUM (
  'PENDING',
  'COMPLETED',
  'COMPLETED_LATE',
  'MISSED',
  'ESCALATED',
  'CANCELLED'
);

CREATE TYPE "TeacherObligationPriority" AS ENUM (
  'LOW',
  'NORMAL',
  'HIGH',
  'CRITICAL'
);

CREATE TYPE "TeacherReminderStatus" AS ENUM (
  'PENDING',
  'SENT',
  'SKIPPED',
  'FAILED'
);

CREATE TYPE "TeacherEscalationStatus" AS ENUM (
  'OPEN',
  'ACKNOWLEDGED',
  'RESOLVED',
  'DISMISSED'
);

CREATE TYPE "TeacherCorrectionRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'NEEDS_MORE_INFO',
  'CANCELLED'
);

CREATE TYPE "TeacherAccountabilityAuditAction" AS ENUM (
  'OBLIGATION_CREATED',
  'OBLIGATION_COMPLETED',
  'OBLIGATION_COMPLETED_LATE',
  'OBLIGATION_MISSED',
  'OBLIGATION_ESCALATED',
  'OBLIGATION_CANCELLED',
  'REMINDER_QUEUED',
  'REMINDER_SENT',
  'REMINDER_FAILED',
  'ESCALATION_CREATED',
  'ESCALATION_ACKNOWLEDGED',
  'ESCALATION_RESOLVED',
  'ESCALATION_DISMISSED',
  'CORRECTION_REQUESTED',
  'CORRECTION_APPROVED',
  'CORRECTION_REJECTED',
  'CORRECTION_NEEDS_MORE_INFO',
  'CORRECTION_CANCELLED',
  'SETTINGS_UPDATED'
);

CREATE TABLE "TeacherObligation" (
  "id" TEXT NOT NULL,
  "type" "TeacherObligationType" NOT NULL,
  "status" "TeacherObligationStatus" NOT NULL DEFAULT 'PENDING',
  "priority" "TeacherObligationPriority" NOT NULL DEFAULT 'NORMAL',
  "sourceModel" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "expectedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,

  CONSTRAINT "TeacherObligation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherReminder" (
  "id" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'IN_APP',
  "message" TEXT NOT NULL,
  "status" "TeacherReminderStatus" NOT NULL DEFAULT 'PENDING',
  "scheduledAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "obligationId" TEXT NOT NULL,

  CONSTRAINT "TeacherReminder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherEscalation" (
  "id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "TeacherEscalationStatus" NOT NULL DEFAULT 'OPEN',
  "escalatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "obligationId" TEXT NOT NULL,

  CONSTRAINT "TeacherEscalation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherCorrectionRequest" (
  "id" TEXT NOT NULL,
  "sourceModel" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "fieldName" TEXT NOT NULL,
  "oldValue" JSONB,
  "newValue" JSONB,
  "reason" TEXT NOT NULL,
  "evidenceUrl" TEXT,
  "status" "TeacherCorrectionRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,

  CONSTRAINT "TeacherCorrectionRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherAccountabilityAuditLog" (
  "id" TEXT NOT NULL,
  "action" "TeacherAccountabilityAuditAction" NOT NULL,
  "actorId" TEXT,
  "actorRole" TEXT,
  "sourceModel" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "schoolId" TEXT NOT NULL,
  "teacherId" TEXT,

  CONSTRAINT "TeacherAccountabilityAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherObligation_schoolId_teacherId_sourceKey_key"
  ON "TeacherObligation"("schoolId", "teacherId", "sourceKey");

CREATE INDEX "TeacherObligation_schoolId_teacherId_status_expectedAt_idx"
  ON "TeacherObligation"("schoolId", "teacherId", "status", "expectedAt");

CREATE INDEX "TeacherObligation_schoolId_type_status_expectedAt_idx"
  ON "TeacherObligation"("schoolId", "type", "status", "expectedAt");

CREATE INDEX "TeacherObligation_schoolId_status_expectedAt_idx"
  ON "TeacherObligation"("schoolId", "status", "expectedAt");

CREATE INDEX "TeacherObligation_schoolId_sourceModel_sourceId_idx"
  ON "TeacherObligation"("schoolId", "sourceModel", "sourceId");

CREATE INDEX "TeacherReminder_schoolId_obligationId_status_idx"
  ON "TeacherReminder"("schoolId", "obligationId", "status");

CREATE INDEX "TeacherReminder_schoolId_teacherId_status_scheduledAt_idx"
  ON "TeacherReminder"("schoolId", "teacherId", "status", "scheduledAt");

CREATE INDEX "TeacherReminder_schoolId_status_scheduledAt_idx"
  ON "TeacherReminder"("schoolId", "status", "scheduledAt");

CREATE UNIQUE INDEX "TeacherEscalation_schoolId_obligationId_key"
  ON "TeacherEscalation"("schoolId", "obligationId");

CREATE INDEX "TeacherEscalation_schoolId_teacherId_status_escalatedAt_idx"
  ON "TeacherEscalation"("schoolId", "teacherId", "status", "escalatedAt");

CREATE INDEX "TeacherEscalation_schoolId_status_escalatedAt_idx"
  ON "TeacherEscalation"("schoolId", "status", "escalatedAt");

CREATE UNIQUE INDEX "TeacherCorrectionRequest_schoolId_teacherId_sourceKey_fieldName_key"
  ON "TeacherCorrectionRequest"("schoolId", "teacherId", "sourceKey", "fieldName");

CREATE INDEX "TeacherCorrectionRequest_schoolId_status_createdAt_idx"
  ON "TeacherCorrectionRequest"("schoolId", "status", "createdAt");

CREATE INDEX "TeacherCorrectionRequest_schoolId_teacherId_status_createdAt_idx"
  ON "TeacherCorrectionRequest"("schoolId", "teacherId", "status", "createdAt");

CREATE INDEX "TeacherCorrectionRequest_schoolId_sourceModel_sourceId_idx"
  ON "TeacherCorrectionRequest"("schoolId", "sourceModel", "sourceId");

CREATE INDEX "TeacherAccountabilityAuditLog_schoolId_teacherId_createdAt_idx"
  ON "TeacherAccountabilityAuditLog"("schoolId", "teacherId", "createdAt");

CREATE INDEX "TeacherAccountabilityAuditLog_schoolId_action_createdAt_idx"
  ON "TeacherAccountabilityAuditLog"("schoolId", "action", "createdAt");

CREATE INDEX "TeacherAccountabilityAuditLog_schoolId_sourceModel_sourceId_idx"
  ON "TeacherAccountabilityAuditLog"("schoolId", "sourceModel", "sourceId");

ALTER TABLE "TeacherObligation"
  ADD CONSTRAINT "TeacherObligation_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherObligation"
  ADD CONSTRAINT "TeacherObligation_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherReminder"
  ADD CONSTRAINT "TeacherReminder_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherReminder"
  ADD CONSTRAINT "TeacherReminder_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherReminder"
  ADD CONSTRAINT "TeacherReminder_obligationId_fkey"
  FOREIGN KEY ("obligationId") REFERENCES "TeacherObligation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherEscalation"
  ADD CONSTRAINT "TeacherEscalation_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherEscalation"
  ADD CONSTRAINT "TeacherEscalation_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherEscalation"
  ADD CONSTRAINT "TeacherEscalation_obligationId_fkey"
  FOREIGN KEY ("obligationId") REFERENCES "TeacherObligation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherCorrectionRequest"
  ADD CONSTRAINT "TeacherCorrectionRequest_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherCorrectionRequest"
  ADD CONSTRAINT "TeacherCorrectionRequest_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherAccountabilityAuditLog"
  ADD CONSTRAINT "TeacherAccountabilityAuditLog_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherAccountabilityAuditLog"
  ADD CONSTRAINT "TeacherAccountabilityAuditLog_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

