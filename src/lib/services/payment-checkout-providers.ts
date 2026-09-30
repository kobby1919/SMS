import type { PaymentMethod, PaymentProvider } from "@/src/generated/prisma";

export type CheckoutProviderInput = {
  provider: PaymentProvider;
  secretKey: string;
  email: string;
  amount: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
  acceptedPaymentMethods: PaymentMethod[];
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

type PaystackVerifyResponse = {
  status?: boolean;
  message?: string;
  data?: {
    id?: number | string;
    status?: string;
    reference?: string;
    amount?: number;
    currency?: string;
    paid_at?: string | null;
    gateway_response?: string;
    metadata?: Record<string, unknown>;
    customer?: {
      email?: string | null;
      first_name?: string | null;
      last_name?: string | null;
    };
  };
};

export type ProviderPaymentVerificationInput = {
  provider: PaymentProvider;
  secretKey: string;
  reference: string;
};

export type ProviderPaymentVerificationStatus = "SUCCESS" | "FAILED" | "PENDING";

export type ProviderPaymentVerification = {
  provider: PaymentProvider;
  reference: string;
  amount: number;
  currency: string;
  status: ProviderPaymentVerificationStatus;
  providerStatus: string;
  providerMessage?: string | null;
  paidAt?: Date | null;
  customerEmail?: string | null;
  paidBy?: string | null;
  raw: Record<string, unknown>;
};

type PaystackCustomer = NonNullable<NonNullable<PaystackVerifyResponse["data"]>["customer"]>;

function paystackChannels(methods: PaymentMethod[]) {
  const channels = new Set<string>();

  for (const method of methods) {
    if (method === "CARD") channels.add("card");
    if (method === "MTN_MOMO" || method === "VODAFONE_CASH" || method === "AIRTELTIGO_MONEY") {
      channels.add("mobile_money");
    }
    if (method === "BANK_TRANSFER") channels.add("bank_transfer");
  }

  return [...channels];
}

function assertProviderResponse(ok: boolean, status: number, body: PaystackInitializeResponse) {
  if (!ok || !body.status || !body.data?.authorization_url) {
    throw new Error(body.message || `Paystack checkout could not be created. Provider status: ${status}.`);
  }
}

export async function createCheckoutProviderSession(input: CheckoutProviderInput): Promise<CheckoutProviderSession> {
  if (input.provider !== "PAYSTACK") {
    throw new Error(`${input.provider} checkout is not enabled yet. Use Paystack for the first online payment rollout.`);
  }

  const channels = paystackChannels(input.acceptedPaymentMethods);
  if (channels.length === 0) {
    throw new Error("The school has not selected a Paystack-supported online payment method.");
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
      channels,
      metadata: {
        ...input.metadata,
        allowedChannels: channels,
      },
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

function normalizeProviderStatus(status: string | undefined | null): ProviderPaymentVerificationStatus {
  const normalized = status?.toLowerCase();
  if (normalized === "success" || normalized === "succeeded" || normalized === "paid") return "SUCCESS";
  if (normalized === "failed" || normalized === "abandoned" || normalized === "cancelled" || normalized === "canceled") return "FAILED";
  return "PENDING";
}

function customerName(customer?: PaystackCustomer | null) {
  if (!customer || typeof customer !== "object") return null;
  const firstName = "first_name" in customer && typeof customer.first_name === "string" ? customer.first_name : "";
  const lastName = "last_name" in customer && typeof customer.last_name === "string" ? customer.last_name : "";
  return `${firstName} ${lastName}`.trim() || null;
}

function validDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function verifyProviderPayment(
  input: ProviderPaymentVerificationInput,
): Promise<ProviderPaymentVerification> {
  if (input.provider !== "PAYSTACK") {
    throw new Error(`${input.provider} payment verification is not enabled yet. Use Paystack for the first online payment rollout.`);
  }

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(input.reference)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${input.secretKey}` },
      cache: "no-store",
    },
  );

  const body = await response.json().catch(() => ({})) as PaystackVerifyResponse;
  if (!response.ok || !body.status || !body.data?.reference) {
    throw new Error(body.message || `Paystack payment verification failed. Provider status: ${response.status}.`);
  }

  const amount = typeof body.data.amount === "number" && Number.isFinite(body.data.amount)
    ? body.data.amount / 100
    : NaN;
  if (!Number.isFinite(amount)) {
    throw new Error("Paystack verification response did not include a valid amount.");
  }

  const customer = body.data.customer;
  return {
    provider: input.provider,
    reference: body.data.reference,
    amount,
    currency: body.data.currency ?? "",
    status: normalizeProviderStatus(body.data.status),
    providerStatus: body.data.status ?? "unknown",
    providerMessage: body.data.gateway_response ?? body.message ?? null,
    paidAt: validDate(body.data.paid_at),
    customerEmail: customer?.email ?? null,
    paidBy: customerName(customer) ?? customer?.email ?? "Online payment",
    raw: body as Record<string, unknown>,
  };
}
