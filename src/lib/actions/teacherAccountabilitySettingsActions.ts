"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/authz";
import { parseActionInput } from "@/src/lib/validation/parse";
import { teacherAccountabilitySettingsSchema } from "@/src/lib/validation/teacher-accountability";

function boolFromFormData(data: FormData, key: string) {
  return data.get(key) === "on" || data.get(key) === "true";
}

function formValue(data: FormData, key: string, fallback = "") {
  return String(data.get(key) ?? fallback);
}

export type TeacherAccountabilitySettingsActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function updateTeacherAccountabilitySettings(data: unknown) {
  const { schoolId } = await requireRole(["admin"]);
  const input = data instanceof FormData
    ? {
        attendanceOpenMinutesBeforeLesson: formValue(data, "attendanceOpenMinutesBeforeLesson", "10"),
        attendanceGraceMinutesAfterLesson: formValue(data, "attendanceGraceMinutesAfterLesson", "10"),
        attendanceEscalateMinutesAfterLesson: formValue(data, "attendanceEscalateMinutesAfterLesson", "30"),
        allowEarlyAttendanceMarking: boolFromFormData(data, "allowEarlyAttendanceMarking"),
        requireLateAttendanceNote: boolFromFormData(data, "requireLateAttendanceNote"),
        requireAttendanceCorrectionReason: boolFromFormData(data, "requireAttendanceCorrectionReason"),
        caScorePublishWindowSchoolDays: formValue(data, "caScorePublishWindowSchoolDays", "3"),
        caReminderAfterSchoolDays: formValue(data, "caReminderAfterSchoolDays", "2"),
        caEscalateAfterSchoolDays: formValue(data, "caEscalateAfterSchoolDays", "4"),
        homeworkCheckWindowSchoolDays: formValue(data, "homeworkCheckWindowSchoolDays", "2"),
        homeworkEscalateAfterSchoolDays: formValue(data, "homeworkEscalateAfterSchoolDays", "3"),
        syllabusUpdateExpectation: formValue(data, "syllabusUpdateExpectation", "SAME_DAY"),
        teacherCloseoutTime: formValue(data, "teacherCloseoutTime", "16:00"),
        remindersEnabled: boolFromFormData(data, "remindersEnabled"),
        escalationsEnabled: boolFromFormData(data, "escalationsEnabled"),
        correctionApprovalRequired: boolFromFormData(data, "correctionApprovalRequired"),
      }
    : data;
  const parsed = parseActionInput(teacherAccountabilitySettingsSchema, input);

  await prisma.teacherAccountabilitySetting.upsert({
    where: { schoolId },
    create: { schoolId, ...parsed },
    update: parsed,
  });

  revalidatePath("/admin/accountability-settings");
  revalidatePath("/admin/accountability");
  revalidatePath("/teacher/accountability");
  revalidatePath("/teacher");
}

export async function updateTeacherAccountabilitySettingsWithState(
  _state: TeacherAccountabilitySettingsActionState,
  data: FormData,
): Promise<TeacherAccountabilitySettingsActionState> {
  try {
    await updateTeacherAccountabilitySettings(data);
    return {
      status: "success",
      message: "Teacher accountability settings saved successfully.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not save teacher accountability settings.",
    };
  }
}
