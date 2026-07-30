"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/authz";
import { parseActionInput } from "@/src/lib/validation/parse";
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
        dailySummarySendTime: formValue(data, "dailySummarySendTime", "15:15"),
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

export async function updateParentNotificationPreference(data: unknown) {
  const { userId, schoolId } = await requireRole(["parent"]);
  const input = data instanceof FormData
    ? {
        dailySummaryEnabled: boolFromFormData(data, "dailySummaryEnabled"),
        urgentAlertsEnabled: boolFromFormData(data, "urgentAlertsEnabled"),
        preferredChannel: formValue(data, "preferredChannel", "WHATSAPP"),
        fallbackChannel: formValue(data, "fallbackChannel", "SMS"),
        emailEnabled: boolFromFormData(data, "emailEnabled"),
        smsEnabled: boolFromFormData(data, "smsEnabled"),
        whatsappEnabled: boolFromFormData(data, "whatsappEnabled"),
      }
    : data;
  const parsed = parseActionInput(parentNotificationPreferenceSchema, input);

  await prisma.parentNotificationPreference.upsert({
    where: { parentId: userId },
    create: {
      schoolId,
      parentId: userId,
      ...parsed,
    },
    update: parsed,
  });

  revalidatePath("/parent/updates");
  revalidatePath("/parent");
}
