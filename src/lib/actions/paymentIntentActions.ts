"use server";

import { requireRole } from "@/src/lib/authz";
import { enforceActionRateLimit } from "@/src/lib/rate-limit";
import { parseActionInput } from "@/src/lib/validation/parse";
import { createPaymentIntentSchema } from "@/src/lib/validation/payment-intents";
import { createParentPaymentIntent } from "@/src/lib/services/payment-intents";

function formLines(data: FormData) {
  const billIds = data.getAll("studentBillId").map((value) => Number(value));
  const amounts = data.getAll("amount").map((value) => Number(value));
  return billIds.map((studentBillId, index) => ({
    studentBillId,
    amount: amounts[index],
  }));
}

export type ParentCheckoutActionState = {
  status: "idle" | "error" | "success";
  message: string;
  checkoutUrl?: string;
  reference?: string;
};

export async function createParentCheckoutWithState(
  _state: ParentCheckoutActionState,
  data: FormData,
): Promise<ParentCheckoutActionState> {
  try {
    const { userId, schoolId } = await requireRole(["parent"]);
    await enforceActionRateLimit({
      key: `parent:create-checkout:${schoolId}:${userId}`,
      limit: 10,
      windowMs: 60_000,
    });

    const input = parseActionInput(createPaymentIntentSchema, { lines: formLines(data) });
    const result = await createParentPaymentIntent({
      schoolId,
      parentId: userId,
      input,
    });

    return {
      status: "success",
      message: result.reused ? "Existing checkout reopened." : "Checkout is ready.",
      checkoutUrl: result.checkoutUrl,
      reference: result.reference,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not start online checkout.",
    };
  }
}