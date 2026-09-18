import type { TeacherStatus } from "@/src/generated/prisma";
import { getTeacherProfileCompletion } from "@/src/lib/services/teacher-profile-completion";

export type TeacherReadinessTone = "ready" | "warning" | "blocked" | "inactive";

export type TeacherReadinessInput = {
  status: TeacherStatus;
  name?: string | null;
  surname?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  subjectCount: number;
  publishedLessonCount: number;
  taughtClassCount: number;
  supervisedClassCount: number;
  hasPendingInvite?: boolean;
};

export type TeacherReadiness = {
  status: "READY" | "NEEDS_SETUP" | "INVITED" | "SUSPENDED" | "LEFT_SCHOOL";
  label: string;
  tone: TeacherReadinessTone;
  isReady: boolean;
  canOperate: boolean;
  blockers: string[];
  setupWarnings: string[];
  profileCompletion: ReturnType<typeof getTeacherProfileCompletion>;
};

export function getTeacherReadiness(input: TeacherReadinessInput): TeacherReadiness {
  const profileCompletion = getTeacherProfileCompletion(input);
  const blockers: string[] = [];
  const setupWarnings: string[] = [];

  if (input.status === "LEFT_SCHOOL") {
    return {
      status: "LEFT_SCHOOL",
      label: "Left school",
      tone: "inactive",
      isReady: false,
      canOperate: false,
      blockers: ["teacher has left the school"],
      setupWarnings,
      profileCompletion,
    };
  }

  if (input.status === "SUSPENDED") {
    return {
      status: "SUSPENDED",
      label: "Suspended",
      tone: "blocked",
      isReady: false,
      canOperate: false,
      blockers: ["teacher account is suspended"],
      setupWarnings,
      profileCompletion,
    };
  }

  if (input.status === "INVITED" || input.hasPendingInvite) {
    blockers.push("invite not accepted");
  }

  if (!profileCompletion.isComplete) {
    blockers.push(`profile missing ${profileCompletion.missingFields.join(", ")}`);
  }

  if (input.subjectCount === 0) {
    blockers.push("no subject capability assigned");
  }

  if (input.publishedLessonCount === 0) {
    blockers.push("no published timetable lessons");
  }

  if (input.taughtClassCount === 0 && input.supervisedClassCount === 0) {
    setupWarnings.push("not linked to any teaching or class-teacher responsibility yet");
  }

  if (blockers.length === 0 && input.status === "ACTIVE") {
    return {
      status: "READY",
      label: "Ready to operate",
      tone: "ready",
      isReady: true,
      canOperate: true,
      blockers,
      setupWarnings,
      profileCompletion,
    };
  }

  return {
    status: input.status === "INVITED" ? "INVITED" : "NEEDS_SETUP",
    label: input.status === "INVITED" ? "Invite pending" : "Needs setup",
    tone: input.status === "INVITED" ? "warning" : "warning",
    isReady: false,
    canOperate: input.status === "ACTIVE" && blockers.length === 0,
    blockers,
    setupWarnings,
    profileCompletion,
  };
}

export function teacherReadinessToneClass(tone: TeacherReadinessTone) {
  switch (tone) {
    case "ready":
      return "bg-emerald-50 text-emerald-700";
    case "blocked":
      return "bg-rose-50 text-rose-700";
    case "inactive":
      return "bg-gray-100 text-gray-600";
    case "warning":
    default:
      return "bg-amber-50 text-amber-700";
  }
}