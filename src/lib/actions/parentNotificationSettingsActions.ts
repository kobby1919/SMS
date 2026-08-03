"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/authz";
import { parseActionInput } from "@/src/lib/validation/parse";
import { upsertParentNotificationPreference } from "@/src/lib/services/parent-notification-preferences";
import {
  parentNotificationPreferenceSchema,
  schoolNotificationSettingsSchema,
} from "@/src/lib/validation/parent-notifications";

function boolFromFormData(data: FormData, key: string) {
  return data.get(key) === "on" || data.get(key) === "true";
}

function formValue(data: FormData, key: string, fallback = "") {
  return String(data.get(key) ?? fallback);
}

export async function updateSchoolNotificationSettings(data: unknown) {
  const { schoolId } = await requireRole(["admin"]);
  const input = data instanceof FormData
    ? {
        timezone: formValue(data, "timezone", "Africa/Accra"),
        openingTime: formValue(data, "openingTime", "07:30"),
        closingTime: formValue(data, "closingTime", "15:00"),
        summaryCadence: formValue(data, "summaryCadence", "WEEKLY"),
        dailySummarySendTime: formValue(data, "dailySummarySendTime", "15:15"),
        weeklySummarySendDay: formValue(data, "weeklySummarySendDay", "FRIDAY"),
        weeklySummarySendTime: formValue(data, "weeklySummarySendTime", "15:15"),
        activeDays: data.getAll("activeDays").map(String),
        emailEnabled: boolFromFormData(data, "emailEnabled"),
        smsEnabled: boolFromFormData(data, "smsEnabled"),
        whatsappEnabled: boolFromFormData(data, "whatsappEnabled"),
        urgentAlertsImmediate: boolFromFormData(data, "urgentAlertsImmediate"),
        quietHoursStart: formValue(data, "quietHoursStart", "20:00"),
        quietHoursEnd: formValue(data, "quietHoursEnd", "06:00"),
      }
    : data;
  const parsed = parseActionInput(schoolNotificationSettingsSchema, input);

  await prisma.schoolNotificationSetting.upsert({
    where: { schoolId },
    create: { schoolId, ...parsed },
    update: parsed,
  });

  revalidatePath("/admin/notification-settings");
}

export type SchoolNotificationSettingsActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function updateSchoolNotificationSettingsWithState(
  _state: SchoolNotificationSettingsActionState,
  data: FormData,
): Promise<SchoolNotificationSettingsActionState> {
  try {
    await updateSchoolNotificationSettings(data);
    return {
      status: "success",
      message: "Notification settings saved successfully.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not save notification settings.",
    };
  }
}

export async function updateParentNotificationPreference(data: unknown) {
  const { userId, schoolId } = await requireRole(["parent"]);
  const input = data instanceof FormData
    ? {
        dailySummaryEnabled: boolFromFormData(data, "dailySummaryEnabled"),
        weeklySummaryEnabled: boolFromFormData(data, "weeklySummaryEnabled"),
        urgentAlertsEnabled: boolFromFormData(data, "urgentAlertsEnabled"),
        preferredChannel: formValue(data, "preferredChannel", "WHATSAPP"),
        fallbackChannel: formValue(data, "fallbackChannel", "SMS"),
        emailEnabled: boolFromFormData(data, "emailEnabled"),
        smsEnabled: boolFromFormData(data, "smsEnabled"),
        whatsappEnabled: boolFromFormData(data, "whatsappEnabled"),
      }
    : data;
  const parsed = parseActionInput(parentNotificationPreferenceSchema, input);

  await upsertParentNotificationPreference({
    schoolId,
    parentId: userId,
    ...parsed,
  });

  revalidatePath("/parent/updates");
  revalidatePath("/parent");
}

export type ParentPreferenceActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function updateParentNotificationPreferenceWithState(
  _state: ParentPreferenceActionState,
  data: FormData,
): Promise<ParentPreferenceActionState> {
  try {
    await updateParentNotificationPreference(data);
    return {
      status: "success",
      message: "Delivery preferences saved successfully.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not save delivery preferences.",
    };
  }
}
