import { randomUUID } from "crypto";
import { Prisma } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { decryptPaymentSecret } from "@/src/lib/services/payment-settings-secrets";
import { createCheckoutProviderSession } from "@/src/lib/services/payment-checkout-providers";
import { listActiveParentChildIds } from "@/src/lib/services/parent-student-relationships";
import {
  assertCanRecordPayment,
  assertPaymentWithinAllowedOverpay,
} from "@/src/lib/services/finance-policy";
import type { CreatePaymentIntentInput } from "@/src/lib/validation/payment-intents";

const CHECKOUT_TTL_MS = 30 * 60 * 1000;

type IntentLineShape = { studentBillId: number; amount: Prisma.Decimal };

type CreateParentPaymentIntentArgs = {
  schoolId: string;
  parentId: string;
  input: CreatePaymentIntentInput;
};

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function toMoney(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function lineKey(lines: { studentBillId: number; amount: number }[]) {
  return [...lines]
    .sort((a, b) => a.studentBillId - b.studentBillId)
    .map((line) => `${line.studentBillId}:${line.amount.toFixed(2)}`)
    .join("|");
}

function paymentIntentReference() {
  return `EJ-${Date.now()}-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

function checkoutExpiry() {
  return new Date(Date.now() + CHECKOUT_TTL_MS);
}

function sameMoney(left: Prisma.Decimal.Value, right: Prisma.Decimal.Value) {
  return new Prisma.Decimal(left).equals(new Prisma.Decimal(right));
}

function intentMatchesRequest(
  intent: {
    parentId: string;
    studentId: string;
    provider: string;
    amount: Prisma.Decimal;
    lines: Array<{ studentBillId: number; amount: Prisma.Decimal }>;
  },
  expected: {
    parentId: string;
    studentId: string;
    provider: string;
    amount: Prisma.Decimal;
    lines: IntentLineShape[];
  },
) {
  if (intent.parentId !== expected.parentId) return false;
  if (intent.studentId !== expected.studentId) return false;
  if (intent.provider !== expected.provider) return false;
  if (!sameMoney(intent.amount, expected.amount)) return false;
  if (intent.lines.length !== expected.lines.length) return false;

  const expectedLines = new Map(expected.lines.map((line) => [line.studentBillId, line.amount]));
  return intent.lines.every((line) => {
    const amount = expectedLines.get(line.studentBillId);
    return amount ? sameMoney(line.amount, amount) : false;
  });
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createParentPaymentIntent({
  schoolId,
  parentId,
  input,
}: CreateParentPaymentIntentArgs) {
  const settings = await prisma.schoolPaymentSetting.findUnique({
    where: { schoolId },
  });

  if (!settings?.onlinePaymentsEnabled) {
    throw new Error("Online payments are not enabled by the school yet.");
  }
  if (settings.provider !== "PAYSTACK") {
    throw new Error(`${settings.provider} checkout is not enabled yet. The first rollout supports Paystack only.`);
  }
  if (!settings.encryptedSecretKey || !settings.publicKey) {
    throw new Error("Online payment provider keys are not complete yet.");
  }

  const parent = await prisma.parent.findFirst({
    where: { id: parentId, schoolId },
    select: { id: true, name: true, surname: true, email: true },
  });
  if (!parent) throw new Error("Parent account was not found for this school.");
  if (!parent.email) throw new Error("Your parent account needs an email address before online checkout can start.");

  const uniqueLines = new Map<number, number>();
  for (const line of input.lines) {
    uniqueLines.set(line.studentBillId, (uniqueLines.get(line.studentBillId) ?? 0) + line.amount);
  }
  const requestedLines = [...uniqueLines.entries()].map(([studentBillId, amount]) => ({ studentBillId, amount }));
  const childIds = await listActiveParentChildIds(parentId, schoolId, { permission: "fees" });
  if (childIds.length === 0) throw new Error("This parent account has no ward with fee access.");

  const bills = await prisma.studentBill.findMany({
    where: {
      schoolId,
      id: { in: requestedLines.map((line) => line.studentBillId) },
      studentId: { in: childIds },
    },
    include: {
      student: { select: { id: true, name: true, surname: true } },
      feeStructure: { select: { title: true, term: true, academicYear: true } },
    },
  });

  if (bills.length !== requestedLines.length) {
    throw new Error("One or more selected bills could not be found for this parent account.");
  }

  const billById = new Map(bills.map((bill) => [bill.id, bill]));
  let total = new Prisma.Decimal(0);
  const safeLines = requestedLines.map((line) => {
    const bill = billById.get(line.studentBillId);
    if (!bill) throw new Error("Selected bill was not found.");
    assertCanRecordPayment(bill.status);
    const amount = toMoney(line.amount);
    assertPaymentWithinAllowedOverpay({ amount, currentBalance: bill.balance });
    if (amount.gt(bill.balance)) {
      throw new Error(`Payment for ${bill.student.name} ${bill.student.surname} cannot exceed the bill balance.`);
    }
    total = total.add(amount);
    return { bill, amount };
  });

  if (total.lte(0)) throw new Error("Checkout amount must be greater than zero.");

  const studentIds = new Set(safeLines.map(({ bill }) => bill.studentId));
  if (studentIds.size !== 1) {
    throw new Error("One checkout can only pay bills for one child at a time.");
  }
  if (safeLines.length > 1) {
    throw new Error("Multiple-bill online checkout will be enabled after multi-bill webhook finalization is connected. Please pay one bill at a time for now.");
  }
  const intentStudentId = safeLines[0]?.bill.studentId;
  if (!intentStudentId) throw new Error("Selected bill is missing a student link.");
  const intentLines = safeLines.map(({ bill, amount }) => ({ studentBillId: bill.id, amount }));
  const idempotencyKey = `parent-checkout:${parentId}:${lineKey(requestedLines)}`;
  const now = new Date();
  let intent = await prisma.paymentIntent.findUnique({
    where: { schoolId_idempotencyKey: { schoolId, idempotencyKey } },
    include: { lines: true },
  });
  let shouldInitializeProvider = false;

  if (intent && !intentMatchesRequest(intent, {
    parentId,
    studentId: intentStudentId,
    provider: settings.provider,
    amount: total,
    lines: intentLines,
  })) {
    throw new Error("Existing checkout record does not match this bill. Refresh the bill and try again.");
  }

  if (intent?.status === "PAID") {
    throw new Error("This checkout has already been paid. Refresh the bill to see the latest balance.");
  }

  if (intent && intent.expiresAt <= now && intent.status !== "EXPIRED") {
    intent = await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: "EXPIRED", lastError: "Checkout expired before provider confirmation." },
      include: { lines: true },
    });
  }

  if (intent && intent.status === "PENDING" && intent.checkoutUrl && intent.expiresAt > now) {
    return {
      paymentIntentId: intent.id,
      checkoutUrl: intent.checkoutUrl,
      reference: intent.reference,
      amount: Number(intent.amount),
      reused: true,
    };
  }

  if (!intent) {
    try {
      intent = await prisma.paymentIntent.create({
        data: {
          schoolId,
          parentId,
          studentId: intentStudentId,
          provider: settings.provider,
          reference: paymentIntentReference(),
          amount: total,
          idempotencyKey,
          payerEmail: parent.email,
          payerName: `${parent.name} ${parent.surname}`.trim(),
          expiresAt: checkoutExpiry(),
          lines: {
            create: intentLines,
          },
        },
        include: { lines: true },
      });
      shouldInitializeProvider = true;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      intent = await prisma.paymentIntent.findUnique({
        where: { schoolId_idempotencyKey: { schoolId, idempotencyKey } },
        include: { lines: true },
      });
      if (!intent) throw error;
      if (intent.status === "PENDING" && intent.checkoutUrl && intent.expiresAt > new Date()) {
        return {
          paymentIntentId: intent.id,
          checkoutUrl: intent.checkoutUrl,
          reference: intent.reference,
          amount: Number(intent.amount),
          reused: true,
        };
      }
      throw new Error("Checkout is already being prepared. Please wait a moment and try again.");
    }
  } else if (["FAILED", "CANCELLED", "EXPIRED", "PENDING_PROVIDER", "CHECKOUT_CREATED"].includes(intent.status)) {
    intent = await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: "PENDING",
        reference: paymentIntentReference(),
        checkoutUrl: null,
        providerSessionId: null,
        providerAuthorization: null,
        lastError: null,
        payerEmail: parent.email,
        payerName: `${parent.name} ${parent.surname}`.trim(),
        expiresAt: checkoutExpiry(),
      },
      include: { lines: true },
    });
    shouldInitializeProvider = true;
  }

  if (!shouldInitializeProvider) {
    throw new Error("Checkout is already being prepared. Please wait a moment and try again.");
  }

  const primaryBill = safeLines[0]?.bill;
  if (!primaryBill) throw new Error("No bill was selected for checkout.");

  try {
    const session = await createCheckoutProviderSession({
      provider: settings.provider,
      secretKey: decryptPaymentSecret(settings.encryptedSecretKey),
      email: parent.email,
      amount: Number(intent.amount),
      reference: intent.reference,
      callbackUrl: `${appUrl()}/parent/finance/bills/${primaryBill.id}?payment=return&intent=${encodeURIComponent(intent.id)}`,
      metadata: {
        schoolId,
        parentId,
        paymentIntentId: intent.id,
        reference: intent.reference,
        studentId: intentStudentId,
        studentBillId: primaryBill.id,
        billIds: safeLines.map(({ bill }) => bill.id),
        payerName: `${parent.name} ${parent.surname}`.trim(),
        source: "parent-checkout",
      },
    });

    const updated = await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: "PENDING",
        checkoutUrl: session.checkoutUrl,
        providerSessionId: session.providerSessionId,
        providerAuthorization: session.providerAuthorization,
        lastError: null,
        expiresAt: checkoutExpiry(),
      },
    });

    return {
      paymentIntentId: updated.id,
      checkoutUrl: updated.checkoutUrl ?? session.checkoutUrl,
      reference: updated.reference,
      amount: Number(updated.amount),
      reused: false,
    };
  } catch (error) {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: "FAILED",
        lastError: error instanceof Error ? error.message.slice(0, 1000) : "Provider checkout failed.",
      },
    });
    throw error;
  }
}