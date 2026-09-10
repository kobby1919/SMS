"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/authz";
import { parseActionInput } from "@/src/lib/validation/parse";
import {
  communicationRoutesSchema,
  schoolCommunicationPolicySchema,
} from "@/src/lib/validation/communication-policy";
import { communicationRouteCategories } from "@/src/lib/services/school-communication-policy";

function boolFromFormData(data: FormData, key: string) {
  return data.get(key) === "on" || data.get(key) === "true";
}

function formValue(data: FormData, key: string, fallback = "") {
  return String(data.get(key) ?? fallback);
}

export async function updateSchoolCommunicationPolicy(data: unknown) {
  const { schoolId } = await requireRole(["admin"]);
  const input =
    data instanceof FormData
      ? {
          enabled: boolFromFormData(data, "enabled"),
          allowParentTeacherMessaging: boolFromFormData(data, "allowParentTeacherMessaging"),
          allowInAppMessages: boolFromFormData(data, "allowInAppMessages"),
          allowEmailMessages: boolFromFormData(data, "allowEmailMessages"),
          allowSmsMessages: boolFromFormData(data, "allowSmsMessages"),
          allowWhatsappMessages: boolFromFormData(data, "allowWhatsappMessages"),
          exposeTeacherPhone: boolFromFormData(data, "exposeTeacherPhone"),
          exposeTeacherEmail: boolFromFormData(data, "exposeTeacherEmail"),
          requireParentReason: boolFromFormData(data, "requireParentReason"),
          requireTeacherResponse: boolFromFormData(data, "requireTeacherResponse"),
          contactStartTime: formValue(data, "contactStartTime", "07:00"),
          contactEndTime: formValue(data, "contactEndTime", "17:00"),
          quietHoursStart: formValue(data, "quietHoursStart", "20:00"),
          quietHoursEnd: formValue(data, "quietHoursEnd", "06:00"),
          responseSlaHours: formValue(data, "responseSlaHours", "24"),
          escalationEnabled: boolFromFormData(data, "escalationEnabled"),
          escalateAfterHours: formValue(data, "escalateAfterHours", "48"),
          urgentBypassesQuietHours: boolFromFormData(data, "urgentBypassesQuietHours"),
        }
      : data;
  const parsed = parseActionInput(schoolCommunicationPolicySchema, input);
  const routeInput = communicationRouteCategories.map((category) => ({
    category,
    target:
      data instanceof FormData
        ? formValue(data, `routeTarget_${category}`, category === "ACADEMIC_SUPPORT" || category === "HOMEWORK" ? "SUBJECT_TEACHER" : "CLASS_TEACHER")
        : category === "ACADEMIC_SUPPORT" || category === "HOMEWORK"
          ? "SUBJECT_TEACHER"
          : "CLASS_TEACHER",
    selectedTeacherId:
      data instanceof FormData ? formValue(data, `selectedTeacherId_${category}`) || null : null,
  }));
  const parsedRoutes = parseActionInput(communicationRoutesSchema, routeInput);

  const selectedTeacherIds = parsedRoutes
    .map((route) => route.selectedTeacherId)
    .filter((teacherId): teacherId is string => Boolean(teacherId));

  if (selectedTeacherIds.length > 0) {
    const teacherCount = await prisma.teacher.count({
      where: {
        schoolId,
        id: { in: selectedTeacherIds },
      },
    });

    if (teacherCount !== new Set(selectedTeacherIds).size) {
      throw new Error("One or more selected route teachers do not belong to this school.");
    }
  }

  await prisma.$transaction([
    prisma.schoolCommunicationPolicy.upsert({
      where: { schoolId },
      create: { schoolId, ...parsed },
      update: parsed,
    }),
    ...parsedRoutes.map((route) =>
      prisma.schoolCommunicationRoute.upsert({
        where: {
          schoolId_category: {
            schoolId,
            category: route.category,
          },
        },
        create: {
          schoolId,
          category: route.category,
          target: route.target,
          selectedTeacherId: route.target === "SELECTED_TEACHER" ? route.selectedTeacherId : null,
        },
        update: {
          target: route.target,
          selectedTeacherId: route.target === "SELECTED_TEACHER" ? route.selectedTeacherId : null,
        },
      }),
    ),
  ]);

  revalidatePath("/admin/communication-policy");
  revalidatePath("/parent");
}

export type CommunicationPolicyActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function updateSchoolCommunicationPolicyWithState(
  _state: CommunicationPolicyActionState,
  data: FormData,
): Promise<CommunicationPolicyActionState> {
  try {
    await updateSchoolCommunicationPolicy(data);
    return {
      status: "success",
      message: "Communication policy saved successfully.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not save communication policy.",
    };
  }
}
