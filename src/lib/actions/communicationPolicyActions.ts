"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/authz";
import { parseActionInput } from "@/src/lib/validation/parse";
import { schoolCommunicationPolicySchema } from "@/src/lib/validation/communication-policy";

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

  await prisma.schoolCommunicationPolicy.upsert({
    where: { schoolId },
    create: { schoolId, ...parsed },
    update: parsed,
  });

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
