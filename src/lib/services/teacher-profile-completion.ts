import type { TeacherStatus } from "@/src/generated/prisma";

type TeacherProfileShape = {
  name?: string | null;
  surname?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  status?: TeacherStatus | null;
};

export type TeacherProfileField = "name" | "surname" | "email" | "phone";

const REQUIRED_PROFILE_FIELDS: Array<{
  key: TeacherProfileField;
  label: string;
}> = [
  { key: "name", label: "first name" },
  { key: "surname", label: "last name" },
  { key: "email", label: "email" },
  { key: "phone", label: "phone" },
];

function hasValue(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export function getTeacherProfileCompletion(teacher: TeacherProfileShape) {
  const missingFields = REQUIRED_PROFILE_FIELDS.filter(({ key }) => !hasValue(teacher[key]));
  const completedCount = REQUIRED_PROFILE_FIELDS.length - missingFields.length;
  const completionPercent = Math.round((completedCount / REQUIRED_PROFILE_FIELDS.length) * 100);

  return {
    isComplete: missingFields.length === 0,
    completionPercent,
    missingFields: missingFields.map((field) => field.label),
    missingKeys: missingFields.map((field) => field.key),
  };
}

export function nextTeacherProfileStatus(teacher: TeacherProfileShape): TeacherStatus {
  if (teacher.status === "SUSPENDED" || teacher.status === "LEFT_SCHOOL") {
    return teacher.status;
  }

  return getTeacherProfileCompletion(teacher).isComplete ? "ACTIVE" : "INCOMPLETE_SETUP";
}

