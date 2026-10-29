import type { TeacherStatus } from "@/src/generated/prisma";

export function isCurrentTeacher(teacher: { status: TeacherStatus }) {
  return teacher.status !== "LEFT_SCHOOL";
}

export function currentTeacherWhere(schoolId: string) {
  return { schoolId, status: { not: "LEFT_SCHOOL" as const } };
}

export type TeacherLifecycleAvailability = {
  canSuspend: boolean;
  canReactivate: boolean;
  canMarkLeftSchool: boolean;
  reasons: {
    suspend?: string;
    reactivate?: string;
    markLeftSchool?: string;
  };
};

export function getTeacherLifecycleAvailability(
  status: TeacherStatus,
): TeacherLifecycleAvailability {
  return {
    canSuspend: status === "ACTIVE" || status === "INCOMPLETE_SETUP" || status === "INVITED",
    canReactivate: status === "SUSPENDED",
    canMarkLeftSchool:
      status === "ACTIVE" ||
      status === "INCOMPLETE_SETUP" ||
      status === "INVITED" ||
      status === "SUSPENDED",
    reasons: {
      suspend:
        status === "SUSPENDED"
          ? "Teacher is already suspended."
          : status === "LEFT_SCHOOL"
            ? "Teacher has already left the school."
            : undefined,
      reactivate:
        status === "SUSPENDED"
          ? undefined
          : status === "LEFT_SCHOOL"
            ? "Teachers marked as left school must be invited again if they return."
            : "Only suspended teachers can be reactivated.",
      markLeftSchool:
        status === "LEFT_SCHOOL" ? "Teacher has already been marked as left school." : undefined,
    },
  };
}
