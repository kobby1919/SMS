import prisma from "@/src/lib/prisma";
import type { TeacherAccountabilitySetting } from "@/src/generated/prisma";

export const DEFAULT_TEACHER_ACCOUNTABILITY_SETTINGS = {
  attendanceOpenMinutesBeforeLesson: 10,
  attendanceGraceMinutesAfterLesson: 10,
  attendanceEscalateMinutesAfterLesson: 30,
  allowEarlyAttendanceMarking: true,
  requireLateAttendanceNote: true,
  requireAttendanceCorrectionReason: true,
  caScorePublishWindowSchoolDays: 3,
  caReminderAfterSchoolDays: 2,
  caEscalateAfterSchoolDays: 4,
  homeworkCheckWindowSchoolDays: 2,
  homeworkEscalateAfterSchoolDays: 3,
  syllabusUpdateExpectation: "SAME_DAY",
  teacherCloseoutTime: "16:00",
  remindersEnabled: true,
  escalationsEnabled: true,
  correctionApprovalRequired: true,
} satisfies Omit<
  TeacherAccountabilitySetting,
  "id" | "schoolId" | "school" | "createdAt" | "updatedAt"
>;

export async function ensureDefaultTeacherAccountabilitySettings(
  schoolId: string,
) {
  return prisma.teacherAccountabilitySetting.upsert({
    where: { schoolId },
    create: {
      schoolId,
      ...DEFAULT_TEACHER_ACCOUNTABILITY_SETTINGS,
    },
    update: {},
  });
}

export async function getTeacherAccountabilitySettings(schoolId: string) {
  return ensureDefaultTeacherAccountabilitySettings(schoolId);
}

