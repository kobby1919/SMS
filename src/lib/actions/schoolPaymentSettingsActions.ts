"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/src/lib/authz";
import { updateSchoolPaymentSettings } from "@/src/lib/services/school-payment-settings";
import { parseActionInput } from "@/src/lib/validation/parse";
import { schoolPaymentSettingsSchema } from "@/src/lib/validation/payment-settings";

function boolFromFormData(data: FormData, key: string) {
  return data.get(key) === "on" || data.get(key) === "true";
}

function formValue(data: FormData, key: string, fallback = "") {
  return String(data.get(key) ?? fallback);
}

export async function saveSchoolPaymentSettings(data: unknown) {
  const { userId, schoolId } = await requireRole(["admin"]);
  const input = data instanceof FormData
    ? {
        onlinePaymentsEnabled: boolFromFormData(data, "onlinePaymentsEnabled"),
        provider: formValue(data, "provider", "PAYSTACK"),
        publicKey: formValue(data, "publicKey"),
        secretKey: formValue(data, "secretKey"),
        webhookSecret: formValue(data, "webhookSecret"),
        acceptedPaymentMethods: data.getAll("acceptedPaymentMethods").map(String),
        settlementAccountReference: formValue(data, "settlementAccountReference"),
        feePayerRule: formValue(data, "feePayerRule", "SCHOOL_ABSORBS"),
      }
    : data;
  const parsed = parseActionInput(schoolPaymentSettingsSchema, input);

  await updateSchoolPaymentSettings({
    schoolId,
    actorId: userId,
    input: parsed,
  });

  revalidatePath("/admin/payment-settings");
}

export type SchoolPaymentSettingsActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function saveSchoolPaymentSettingsWithState(
  _state: SchoolPaymentSettingsActionState,
  data: FormData,
): Promise<SchoolPaymentSettingsActionState> {
  try {
    await saveSchoolPaymentSettings(data);
    return {
      status: "success",
      message: "Payment settings saved successfully.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not save payment settings.",
    };
  }
}
