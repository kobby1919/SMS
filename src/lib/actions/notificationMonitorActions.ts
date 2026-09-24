"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/src/lib/authz";
import { enforceActionRateLimit } from "@/src/lib/rate-limit";
import { retryFailed } from "@/src/lib/services/app-notifications";

export type NotificationRetryState = {
  ok: boolean;
  message: string | null;
};

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function retryNotificationDeliveryWithState(
  _prevState: NotificationRetryState,
  formData: FormData,
): Promise<NotificationRetryState> {
  try {
    const ctx = await requireRole(["admin"]);
    await enforceActionRateLimit({
      key: `notification-monitor:retry:${ctx.schoolId}:${ctx.userId}`,
      limit: 12,
      windowMs: 60_000,
    });

    const deliveryId = formString(formData, "deliveryId");
    if (!deliveryId) return { ok: false, message: "Delivery record was not provided." };

    const result = await retryFailed({
      schoolId: ctx.schoolId,
      deliveryId,
      before: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });

    revalidatePath("/admin/notifications");

    if (result.count === 0) {
      return {
        ok: false,
        message: "This delivery cannot be retried. It may already be delivered, cancelled, outside retry rules, or past the retry limit.",
      };
    }

    return { ok: true, message: "Delivery returned to the pending queue." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Retry failed. Please try again.",
    };
  }
}
