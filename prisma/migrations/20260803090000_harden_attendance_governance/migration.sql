CREATE TYPE "AttendanceFollowUpStatus" AS ENUM (
  'NOT_REQUIRED',
  'PENDING_REASON',
  'REASON_PROVIDED',
  'RESOLVED'
);

ALTER TABLE "Attendance"
  ADD COLUMN "arrivalTime" TEXT,
  ADD COLUMN "followUpStatus" "AttendanceFollowUpStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN "followUpNote" TEXT,
  ADD COLUMN "correctionCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastCorrectedAt" TIMESTAMP(3);

UPDATE "Attendance"
SET "followUpStatus" = CASE
  WHEN "status" = 'ABSENT' AND ("note" IS NULL OR BTRIM("note") = '') THEN 'PENDING_REASON'::"AttendanceFollowUpStatus"
  WHEN "status" = 'ABSENT' THEN 'REASON_PROVIDED'::"AttendanceFollowUpStatus"
  ELSE 'NOT_REQUIRED'::"AttendanceFollowUpStatus"
END;

CREATE TABLE "AttendanceAuditLog" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "previousStatus" "AttendanceStatus",
  "newStatus" "AttendanceStatus",
  "previousNote" TEXT,
  "newNote" TEXT,
  "previousArrivalTime" TEXT,
  "newArrivalTime" TEXT,
  "previousFollowUp" "AttendanceFollowUpStatus",
  "newFollowUp" "AttendanceFollowUpStatus",
  "actorId" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "schoolId" TEXT NOT NULL DEFAULT 'default-school',
  "attendanceId" INTEGER,
  "studentId" TEXT,
  "lessonId" INTEGER,

  CONSTRAINT "AttendanceAuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AttendanceAuditLog"
  ADD CONSTRAINT "AttendanceAuditLog_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttendanceAuditLog"
  ADD CONSTRAINT "AttendanceAuditLog_attendanceId_fkey"
  FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AttendanceAuditLog"
  ADD CONSTRAINT "AttendanceAuditLog_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AttendanceAuditLog"
  ADD CONSTRAINT "AttendanceAuditLog_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Attendance_schoolId_followUpStatus_date_idx"
  ON "Attendance"("schoolId", "followUpStatus", "date");

CREATE INDEX "AttendanceAuditLog_schoolId_createdAt_idx"
  ON "AttendanceAuditLog"("schoolId", "createdAt");

CREATE INDEX "AttendanceAuditLog_schoolId_attendanceId_idx"
  ON "AttendanceAuditLog"("schoolId", "attendanceId");

CREATE INDEX "AttendanceAuditLog_schoolId_studentId_createdAt_idx"
  ON "AttendanceAuditLog"("schoolId", "studentId", "createdAt");
