import type { PaymentProvider } from "@/src/generated/prisma";

export type CheckoutProviderInput = {
  provider: PaymentProvider;
  secretKey: string;
  email: string;
  amount: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
};

export type CheckoutProviderSession = {
  checkoutUrl: string;
  providerSessionId?: string | null;
  providerAuthorization?: string | null;
};

type PaystackInitializeResponse = {
  status?: boolean;
  message?: string;
  data?: {
    authorization_url?: string;
    access_code?: string;
    reference?: string;
  };
};

function assertProviderResponse(ok: boolean, status: number, body: PaystackInitializeResponse) {
  if (!ok || !body.status || !body.data?.authorization_url) {
    throw new Error(body.message || `Paystack checkout could not be created. Provider status: ${status}.`);
  }
}

export async function createCheckoutProviderSession(input: CheckoutProviderInput): Promise<CheckoutProviderSession> {
  if (input.provider !== "PAYSTACK") {
    throw new Error(`${input.provider} checkout is not enabled yet. Use Paystack for the first online payment rollout.`);
  }

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amount * 100),
      currency: "GHS",
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
    cache: "no-store",
  });

  const body = await response.json().catch(() => ({})) as PaystackInitializeResponse;
  assertProviderResponse(response.ok, response.status, body);

  return {
    checkoutUrl: body.data?.authorization_url ?? "",
    providerSessionId: body.data?.reference ?? input.reference,
    providerAuthorization: body.data?.access_code ?? null,
  };
}