CREATE TABLE "TeacherAccountabilitySetting" (
  "id" TEXT NOT NULL,
  "attendanceOpenMinutesBeforeLesson" INTEGER NOT NULL DEFAULT 10,
  "attendanceGraceMinutesAfterLesson" INTEGER NOT NULL DEFAULT 10,
  "attendanceEscalateMinutesAfterLesson" INTEGER NOT NULL DEFAULT 30,
  "allowEarlyAttendanceMarking" BOOLEAN NOT NULL DEFAULT true,
  "requireLateAttendanceNote" BOOLEAN NOT NULL DEFAULT true,
  "requireAttendanceCorrectionReason" BOOLEAN NOT NULL DEFAULT true,
  "caScorePublishWindowSchoolDays" INTEGER NOT NULL DEFAULT 3,
  "caReminderAfterSchoolDays" INTEGER NOT NULL DEFAULT 2,
  "caEscalateAfterSchoolDays" INTEGER NOT NULL DEFAULT 4,
  "homeworkCheckWindowSchoolDays" INTEGER NOT NULL DEFAULT 2,
  "homeworkEscalateAfterSchoolDays" INTEGER NOT NULL DEFAULT 3,
  "syllabusUpdateExpectation" TEXT NOT NULL DEFAULT 'SAME_DAY',
  "teacherCloseoutTime" TEXT NOT NULL DEFAULT '16:00',
  "remindersEnabled" BOOLEAN NOT NULL DEFAULT true,
  "escalationsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "correctionApprovalRequired" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL,

  CONSTRAINT "TeacherAccountabilitySetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherAccountabilitySetting_schoolId_key"
  ON "TeacherAccountabilitySetting"("schoolId");

ALTER TABLE "TeacherAccountabilitySetting"
  ADD CONSTRAINT "TeacherAccountabilitySetting_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

