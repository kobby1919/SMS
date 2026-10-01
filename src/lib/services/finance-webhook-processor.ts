import prisma from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import type { PaymentProvider, PaymentStatus, PaymentWebhookEvent } from "@/src/generated/prisma";

import { enqueueFinanceJob } from "@/src/lib/services/finance-queue";
import { verifyProviderPayment } from "@/src/lib/services/payment-checkout-providers";
import { decryptPaymentSecret } from "@/src/lib/services/payment-settings-secrets";
import {
  assertPaymentWithinAllowedOverpay,
} from "@/src/lib/services/finance-policy";
import { recordParentActivityEvents } from "@/src/lib/services/parent-activity-events";
import { PAYMENT_METHOD_LABELS } from "@/src/lib/constants/finance";
import {
  createNotification,
  createNotificationIdempotencyKey,
  notifyRole,
} from "@/src/lib/services/app-notifications";

type WebhookRecord = PaymentWebhookEvent & {
  payload: Prisma.JsonValue;
};

type NormalizedPaymentWebhook = {
  schoolId: string;
  studentBillId: number;
  amount: Prisma.Decimal;
  externalReference: string;
  paidBy: string;
  paymentStatus: Extract<PaymentStatus, "PENDING" | "CONFIRMED" | "FAILED">;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return null;
}

function readNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }

  return null;
}

function normalizeAmount(provider: PaymentProvider, payload: Record<string, unknown>, data: Record<string, unknown>) {
  const majorAmount = readNumber(
    payload.amountGhs,
    payload.amountMajor,
    payload.amount,
    data.amountGhs,
    data.amountMajor,
  );

  if (majorAmount !== null) return new Prisma.Decimal(majorAmount);

  const minorAmount = readNumber(data.amount, data.amount_paid, data.amount_received);
  if (minorAmount === null) return null;

  return provider === "PAYSTACK" || provider === "STRIPE"
    ? new Prisma.Decimal(minorAmount).div(100)
    : new Prisma.Decimal(minorAmount);
}

function normalizePaymentWebhook(event: WebhookRecord): NormalizedPaymentWebhook | null {
  const payload = asRecord(event.payload);
  const data = asRecord(payload.data);
  const metadata = asRecord(data.metadata ?? payload.metadata);
  const transaction = asRecord(data.transaction);
  const transactionMetadata = asRecord(transaction.metadata);
  const schoolId = readString(event.schoolId, payload.schoolId, data.schoolId, metadata.schoolId);
  const studentBillId = readNumber(payload.studentBillId, data.studentBillId, metadata.studentBillId, transactionMetadata.studentBillId);
  const amount = normalizeAmount(event.provider, payload, data);
  const externalReference = readString(
    transaction.reference,
    transaction.id,
    transactionMetadata.reference,
    data.reference,
    data.id,
    data.payment_intent,
    payload.reference,
    payload.externalReference,
    metadata.reference,
  );
  const paidBy = readString(
    payload.paidBy,
    data.paidBy,
    metadata.paidBy,
    asRecord(data.customer).name,
    asRecord(data.customer).email,
  ) ?? "Online payment";
  const status = readString(payload.status, data.status)?.toLowerCase();
  const eventType = event.eventType.toLowerCase();
  const eventIsSuccessful =
    eventType.includes("success") ||
    eventType.includes("succeeded") ||
    status === "success" ||
    status === "succeeded" ||
    status === "paid";
  const eventIsFailed =
    eventType.includes("fail") ||
    eventType.includes("cancel") ||
    status === "failed" ||
    status === "cancelled" ||
    status === "canceled";

  const isReversalEvent = isProviderReversalEvent(event.eventType);
  if (!schoolId || !amount || !externalReference) return null;
  if (!studentBillId && !isReversalEvent) return null;

  return {
    schoolId,
    studentBillId: studentBillId ?? 0,
    amount,
    externalReference,
    paidBy,
    paymentStatus: eventIsSuccessful ? "CONFIRMED" : eventIsFailed ? "FAILED" : "PENDING",
  };
}


function money(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value).toDecimalPlaces(2);
}

function sameMoney(left: Prisma.Decimal.Value, right: Prisma.Decimal.Value) {
  return money(left).equals(money(right));
}

function verificationStatusToPaymentStatus(status: "SUCCESS" | "FAILED" | "PENDING") {
  if (status === "SUCCESS") return "CONFIRMED" as const;
  if (status === "FAILED") return "FAILED" as const;
  return "PENDING" as const;
}

function isProviderReversalEvent(eventType: string) {
  const normalized = eventType.toLowerCase();
  return normalized.includes("refund") || normalized.includes("reversal") || normalized.includes("reversed");
}

function isFinalProviderReversal(event: WebhookRecord) {
  const eventType = event.eventType.toLowerCase();
  const payload = asRecord(event.payload);
  const data = asRecord(payload.data);
  const status = readString(payload.status, data.status)?.toLowerCase();

  return (
    eventType.includes("processed") ||
    eventType.includes("success") ||
    eventType.includes("succeeded") ||
    eventType.includes("reversed") ||
    status === "success" ||
    status === "succeeded" ||
    status === "processed" ||
    status === "reversed" ||
    status === "refunded"
  );
}

async function markProviderReversalAlreadyApplied(webhookEventId: string, paymentId: number) {
  const existingReversal = await prisma.paymentReversal.findUnique({
    where: { paymentId },
    select: { id: true },
  });

  if (!existingReversal) return null;

  await prisma.paymentWebhookEvent.update({
    where: { id: webhookEventId },
    data: { paymentId },
  });

  return markWebhookProcessed(webhookEventId, paymentId, "PROCESSED");
}

async function generateReceiptNumberInTransaction(
  tx: Prisma.TransactionClient,
  schoolId: string,
) {
  const year = new Date().getFullYear();

  await tx.receiptCounter.upsert({
    where: { schoolId_year: { schoolId, year } },
    create: { schoolId, year, lastCounter: 0 },
    update: {},
  });

  const counter = await tx.receiptCounter.update({
    where: { schoolId_year: { schoolId, year } },
    data: { lastCounter: { increment: 1 } },
  });

  return `RCP-${year}-${String(counter.lastCounter).padStart(3, "0")}`;
}

async function notifyConfirmedOnlinePayment(input: {
  schoolId: string;
  studentId: string;
  studentName: string;
  billId: number;
  billTitle: string;
  amount: Prisma.Decimal;
  balance: Prisma.Decimal.Value;
  status: string;
  provider: PaymentProvider;
  receiptNumber: string;
  paymentId: number;
}) {
  const amountLabel = `GHS ${input.amount.toFixed(2)}`;
  const balanceLabel = `GHS ${new Prisma.Decimal(input.balance).toFixed(2)}`;
  const receiptHref = `/api/finance/receipt?billId=${input.billId}&receiptNumber=${encodeURIComponent(input.receiptNumber)}`;
  const [parentRows, relationshipCount] = await Promise.all([
    prisma.parentStudentRelationship.findMany({
      where: {
        schoolId: input.schoolId,
        studentId: input.studentId,
        status: "ACTIVE",
        canViewFees: true,
        parent: { schoolId: input.schoolId },
        student: { schoolId: input.schoolId },
      },
      select: {
        parent: { select: { id: true, email: true } },
      },
    }),
    prisma.parentStudentRelationship.count({
      where: {
        schoolId: input.schoolId,
        studentId: input.studentId,
      },
    }),
  ]);
  const parentsById = new Map(parentRows.map((row) => [row.parent.id, row.parent]));

  if (parentsById.size === 0 && relationshipCount === 0) {
    const legacyStudent = await prisma.student.findFirst({
      where: { id: input.studentId, schoolId: input.schoolId },
      select: {
        parent: { select: { id: true, email: true, schoolId: true } },
      },
    });
    if (legacyStudent?.parent?.schoolId === input.schoolId) {
      parentsById.set(legacyStudent.parent.id, {
        id: legacyStudent.parent.id,
        email: legacyStudent.parent.email,
      });
    }
  }

  const parents = [...parentsById.values()];

  await Promise.all([
    ...parents.map((parent) => createNotification({
      schoolId: input.schoolId,
      recipientType: "PARENT",
      recipientId: parent.id,
      type: "SYSTEM",
      category: "FINANCE",
      priority: "HIGH",
      title: `Receipt ready: ${amountLabel}`,
      body: [
        `Payment received for ${input.studentName}.`,
        `Bill: ${input.billTitle}`,
        `Receipt: ${input.receiptNumber}`,
        `Provider: ${input.provider}`,
        `Current balance: ${balanceLabel}`,
      ].join("\n"),
      href: receiptHref,
      sourceModel: "Payment",
      sourceId: String(input.paymentId),
      idempotencyKey: createNotificationIdempotencyKey("online-payment-receipt", String(input.paymentId)),
      payload: {
        paymentId: input.paymentId,
        billId: input.billId,
        studentId: input.studentId,
        receiptNumber: input.receiptNumber,
        amount: input.amount.toNumber(),
        balance: new Prisma.Decimal(input.balance).toNumber(),
        provider: input.provider,
      },
      deliveries: [
        { channel: "IN_APP", destination: parent.id },
        ...(parent.email ? [{ channel: "EMAIL" as const, destination: parent.email }] : []),
      ],
    })),
    notifyRole({
      schoolId: input.schoolId,
      recipientType: "BURSAR",
      type: "SYSTEM",
      category: "FINANCE",
      priority: "HIGH",
      title: `Online payment confirmed: ${amountLabel}`,
      body: [
        `Student: ${input.studentName}`,
        `Bill: ${input.billTitle}`,
        `Receipt: ${input.receiptNumber}`,
        `Provider: ${input.provider}`,
        `Balance after payment: ${balanceLabel}`,
      ].join("\n"),
      href: `/list/finance/receipts?search=${encodeURIComponent(input.receiptNumber)}`,
      sourceModel: "Payment",
      sourceId: String(input.paymentId),
      idempotencyKey: createNotificationIdempotencyKey("online-payment-bursar", String(input.paymentId)),
      payload: {
        paymentId: input.paymentId,
        billId: input.billId,
        studentId: input.studentId,
        receiptNumber: input.receiptNumber,
        amount: input.amount.toNumber(),
        provider: input.provider,
      },
    }),
    notifyRole({
      schoolId: input.schoolId,
      recipientType: "ADMIN",
      type: "SYSTEM",
      category: "FINANCE",
      priority: "NORMAL",
      title: `Online payment included in reports: ${amountLabel}`,
      body: [
        `Student: ${input.studentName}`,
        `Bill: ${input.billTitle}`,
        `Receipt: ${input.receiptNumber}`,
        `This payment is now part of Today’s Money Pulse and finance reports.`,
      ].join("\n"),
      href: `/list/finance/reports?search=${encodeURIComponent(input.receiptNumber)}`,
      sourceModel: "Payment",
      sourceId: String(input.paymentId),
      idempotencyKey: createNotificationIdempotencyKey("online-payment-admin-report", String(input.paymentId)),
      payload: {
        paymentId: input.paymentId,
        billId: input.billId,
        studentId: input.studentId,
        receiptNumber: input.receiptNumber,
        amount: input.amount.toNumber(),
        provider: input.provider,
      },
    }),
  ]);
}

async function safelyNotifyConfirmedOnlinePayment(input: Parameters<typeof notifyConfirmedOnlinePayment>[0]) {
  try {
    await notifyConfirmedOnlinePayment(input);
  } catch (error) {
    console.error("[finance-webhook-processor] payment notification failed", {
      schoolId: input.schoolId,
      paymentId: input.paymentId,
      receiptNumber: input.receiptNumber,
      error,
    });
  }
}

function billStatusAfterPayment(input: {
  totalAmount: Prisma.Decimal.Value;
  amountPaid: Prisma.Decimal.Value;
  discountAmount: Prisma.Decimal.Value;
  currentStatus: string;
}) {
  if (input.currentStatus === "WAIVED") {
    return { balance: money(new Prisma.Decimal(input.amountPaid).neg()), status: "OVERPAID" as const };
  }

  const total = new Prisma.Decimal(input.totalAmount);
  const paid = new Prisma.Decimal(input.amountPaid);
  const discount = new Prisma.Decimal(input.discountAmount);
  const balance = total.sub(paid).sub(discount).toDecimalPlaces(2);

  if (balance.lessThan(0)) return { balance, status: "OVERPAID" as const };
  if (balance.equals(0)) return { balance, status: "PAID" as const };
  if (paid.greaterThan(0)) return { balance, status: "PARTIAL" as const };
  return { balance, status: "UNPAID" as const };
}

async function verifyWebhookPaymentWithProvider(
  event: WebhookRecord,
  normalized: NormalizedPaymentWebhook,
) {
  const intent = await prisma.paymentIntent.findFirst({
    where: {
      schoolId: normalized.schoolId,
      provider: event.provider,
      reference: normalized.externalReference,
    },
    include: {
      lines: true,
      school: {
        select: {
          paymentSettings: {
            select: {
              provider: true,
              encryptedSecretKey: true,
            },
          },
        },
      },
    },
  });

  if (!intent) {
    throw new Error("Verified webhook reference does not match any Edujay payment intent.");
  }

  if (intent.provider !== event.provider) {
    throw new Error("Webhook provider does not match the payment intent provider.");
  }

  if (intent.school.paymentSettings?.provider !== event.provider) {
    throw new Error("School payment provider settings do not match this webhook provider.");
  }

  if (!intent.school.paymentSettings?.encryptedSecretKey) {
    throw new Error("School payment provider secret key is missing, so payment cannot be verified.");
  }

  if (intent.currency !== "GHS") {
    throw new Error(`Unsupported payment intent currency: ${intent.currency}.`);
  }

  if (!sameMoney(intent.amount, normalized.amount)) {
    throw new Error("Webhook amount does not match the Edujay payment intent amount.");
  }

  if (intent.lines.length !== 1) {
    throw new Error("Webhook verification supports one-bill online payment intents only.");
  }

  const intentLine = intent.lines[0];
  if (!intentLine || intentLine.studentBillId !== normalized.studentBillId) {
    throw new Error("Webhook bill does not match the Edujay payment intent bill.");
  }

  if (!sameMoney(intentLine.amount, normalized.amount)) {
    throw new Error("Webhook bill amount does not match the Edujay payment intent line amount.");
  }

  const verification = await verifyProviderPayment({
    provider: event.provider,
    secretKey: decryptPaymentSecret(intent.school.paymentSettings.encryptedSecretKey),
    reference: normalized.externalReference,
  });

  if (verification.provider !== event.provider) {
    throw new Error("Provider verification returned the wrong provider.");
  }

  if (verification.reference !== normalized.externalReference) {
    throw new Error("Provider verification reference does not match the webhook reference.");
  }

  if (verification.currency !== intent.currency) {
    throw new Error("Provider verification currency does not match the Edujay payment intent currency.");
  }

  if (!sameMoney(verification.amount, intent.amount)) {
    throw new Error("Provider verification amount does not match the Edujay payment intent amount.");
  }

  return { intent, verification };
}

async function markWebhookProcessed(eventId: string, paymentId: number | null, status: "PROCESSED" | "IGNORED") {
  return prisma.paymentWebhookEvent.update({
    where: { id: eventId },
    data: {
      status,
      paymentId,
      processedAt: new Date(),
      lastError: null,
    },
  });
}

async function markWebhookFailed(eventId: string, error: unknown) {
  return prisma.paymentWebhookEvent.update({
    where: { id: eventId },
    data: {
      status: "FAILED",
      lastError: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
    },
  });
}

async function processVerifiedProviderReversal(
  event: WebhookRecord,
  normalized: NormalizedPaymentWebhook,
  webhookEventId: string,
) {
  if (!isFinalProviderReversal(event)) {
    return markWebhookProcessed(webhookEventId, null, "IGNORED");
  }

  const payment = await prisma.payment.findFirst({
    where: {
      schoolId: normalized.schoolId,
      externalProvider: event.provider,
      externalReference: normalized.externalReference,
    },
    include: {
      reversal: true,
      studentBill: {
        include: {
          student: { select: { id: true, name: true, surname: true } },
          lineItems: true,
          feeStructure: { select: { title: true } },
        },
      },
    },
  });

  if (!payment) {
    throw new Error("Provider reversal reference does not match any Edujay online payment.");
  }

  if (!sameMoney(payment.amount, normalized.amount)) {
    throw new Error("Partial provider refunds are not automated yet. Review this payment manually before adjusting the bill.");
  }

  if (payment.status === "REVERSED" || payment.reversal) {
    await prisma.paymentWebhookEvent.update({
      where: { id: webhookEventId },
      data: { paymentId: payment.id },
    });
    return markWebhookProcessed(webhookEventId, payment.id, "PROCESSED");
  }

  if (payment.status !== "CONFIRMED") {
    throw new Error("Only confirmed online payments can be reversed by provider webhook.");
  }

  const amountToReverse = new Prisma.Decimal(payment.amount);
  const reversedAt = new Date();
  const reason = `Verified ${event.provider} reversal/refund webhook ${event.providerEventId}`;

  let reversal: { id: number };

  try {
    reversal = await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "REVERSED" },
    });

    const createdReversal = await tx.paymentReversal.create({
      data: {
        schoolId: normalized.schoolId,
        paymentId: payment.id,
        reason,
        reversedBy: "system:webhook",
        reversedAt,
      },
    });

    const decrementedBill = await tx.studentBill.update({
      where: { id: payment.studentBillId },
      data: { amountPaid: { decrement: amountToReverse } },
      select: {
        totalAmount: true,
        amountPaid: true,
        discountAmount: true,
        status: true,
      },
    });

    const nextBill = billStatusAfterPayment({
      totalAmount: decrementedBill.totalAmount,
      amountPaid: decrementedBill.amountPaid,
      discountAmount: decrementedBill.discountAmount,
      currentStatus: decrementedBill.status,
    });

    await tx.studentBill.update({
      where: { id: payment.studentBillId },
      data: {
        balance: nextBill.balance,
        status: nextBill.status,
      },
    });

    let toUnwind = new Prisma.Decimal(amountToReverse);
    const sortedLines = [...payment.studentBill.lineItems].sort((a, b) => b.id - a.id);

    for (const line of sortedLines) {
      if (toUnwind.lte(0)) break;

      const paid = new Prisma.Decimal(line.amountPaid);
      const toDeduct = Prisma.Decimal.min(toUnwind, paid);
      if (toDeduct.lte(0)) continue;

      const newPaid = paid.sub(toDeduct);
      const newBalance = new Prisma.Decimal(line.amount).sub(newPaid);

      await tx.billLineItem.update({
        where: { id: line.id },
        data: {
          amountPaid: Prisma.Decimal.max(newPaid, 0),
          balance: newBalance,
          isPaid: false,
        },
      });

      toUnwind = toUnwind.sub(toDeduct);
    }

    await tx.paymentWebhookEvent.update({
      where: { id: webhookEventId },
      data: { paymentId: payment.id },
    });

    await tx.financeAuditLog.create({
      data: {
        schoolId: normalized.schoolId,
        action: "PAYMENT_REVERSED",
        performedBy: "system:webhook",
        entityType: "Payment",
        entityId: String(payment.id),
        metadata: {
          paymentId: payment.id,
          receiptNumber: payment.receiptNumber,
          amount: amountToReverse.toNumber(),
          provider: event.provider,
          providerEventId: event.providerEventId,
          externalReference: normalized.externalReference,
          studentBillId: payment.studentBillId,
          reason,
        } as Prisma.InputJsonValue,
      },
    });

    return createdReversal;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const processed = await markProviderReversalAlreadyApplied(webhookEventId, payment.id);
      if (processed) return processed;
    }

    throw error;
  }

  await recordParentActivityEvents({
    schoolId: normalized.schoolId,
    studentIds: [payment.studentBill.studentId],
    type: "PAYMENT",
    title: `Online payment reversed: ${payment.receiptNumber}`,
    body: `A verified provider reversal/refund of GHS ${amountToReverse.toFixed(2)} was applied. Receipt ${payment.receiptNumber} is now voided and remains visible only for history.`,
    href: `/parent/finance/bills/${payment.studentBillId}`,
    sourceModel: "PaymentReversal",
    sourceId: String(payment.id),
    sourceKey: `payment:${payment.id}:provider-reversed`,
    occurredAt: reversedAt,
    payload: {
      paymentId: payment.id,
      reversalId: reversal.id,
      receiptNumber: payment.receiptNumber,
      amount: amountToReverse.toNumber(),
      provider: event.provider,
      externalReference: normalized.externalReference,
      reason,
    },
  });

  await Promise.all([
    notifyRole({
      schoolId: normalized.schoolId,
      recipientType: "BURSAR",
      type: "PAYMENT_CORRECTION",
      title: `Online receipt reversed: ${payment.receiptNumber}`,
      body: `${event.provider} reversed GHS ${amountToReverse.toFixed(2)} for ${payment.studentBill.student.name} ${payment.studentBill.student.surname}.`,
      category: "FINANCE",
      priority: "HIGH",
      href: `/list/finance/bills/${payment.studentBillId}`,
      sourceModel: "PaymentReversal",
      sourceId: String(reversal.id),
      idempotencyKey: createNotificationIdempotencyKey("online-payment-reversed-bursar", String(reversal.id)),
    }),
    notifyRole({
      schoolId: normalized.schoolId,
      recipientType: "ADMIN",
      type: "PAYMENT_CORRECTION",
      title: `Online receipt reversed: ${payment.receiptNumber}`,
      body: `${event.provider} reversed GHS ${amountToReverse.toFixed(2)} for ${payment.studentBill.student.name} ${payment.studentBill.student.surname}.`,
      category: "FINANCE",
      priority: "HIGH",
      href: `/list/finance/bills/${payment.studentBillId}`,
      sourceModel: "PaymentReversal",
      sourceId: String(reversal.id),
      idempotencyKey: createNotificationIdempotencyKey("online-payment-reversed-admin", String(reversal.id)),
    }),
    enqueueFinanceJob({
      schoolId: normalized.schoolId,
      type: "RECOMPUTE_FINANCE_SUMMARY",
      payload: {
        reason: "PAYMENT_PROVIDER_REVERSAL",
        paymentId: payment.id,
        studentBillId: payment.studentBillId,
      },
      idempotencyKey: `finance-summary:${normalized.schoolId}:payment-reversal:${payment.id}`,
      createdBy: "system:webhook",
    }),
    enqueueFinanceJob({
      schoolId: normalized.schoolId,
      type: "GENERATE_DAILY_REPORT",
      payload: { date: reversedAt.toISOString().slice(0, 10) },
      idempotencyKey: `daily-report:${normalized.schoolId}:${reversedAt.toISOString().slice(0, 10)}`,
      createdBy: "system:webhook",
    }),
  ]);

  return markWebhookProcessed(webhookEventId, payment.id, "PROCESSED");
}

export async function processPaymentWebhookEvent(webhookEventId: string) {
  const event = await prisma.paymentWebhookEvent.findUnique({
    where: { id: webhookEventId },
  });

  if (!event) throw new Error("Payment webhook event not found.");
  if (event.status === "PROCESSED" || event.status === "IGNORED") return event;

  await prisma.paymentWebhookEvent.update({
    where: { id: webhookEventId },
    data: { status: "PROCESSING" },
  });

  try {
    const normalized = normalizePaymentWebhook(event as WebhookRecord);
    if (!normalized) {
      return markWebhookProcessed(webhookEventId, null, "IGNORED");
    }

    if (isProviderReversalEvent(event.eventType)) {
      return processVerifiedProviderReversal(event as WebhookRecord, normalized, webhookEventId);
    }

    const { intent, verification } = await verifyWebhookPaymentWithProvider(event as WebhookRecord, normalized);
    const effectivePaymentStatus = verificationStatusToPaymentStatus(verification.status);
    const effectivePaidBy = verification.paidBy ?? normalized.paidBy;
    const effectivePaymentDate = verification.paidAt ?? new Date();

    const idempotencyKey = `payment:${event.provider}:${normalized.externalReference}`;
    let existingPayment = await prisma.payment.findFirst({
      where: {
        schoolId: normalized.schoolId,
        OR: [
          { idempotencyKey },
          {
            externalProvider: event.provider,
            externalReference: normalized.externalReference,
          },
        ],
      },
    });

    if (existingPayment && existingPayment.status === "CONFIRMED") {
      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: { status: "PAID", lastError: null },
      });
      return markWebhookProcessed(webhookEventId, existingPayment.id, "PROCESSED");
    }

    const bill = await prisma.studentBill.findFirst({
      where: { id: normalized.studentBillId, schoolId: normalized.schoolId },
      include: {
        student: { select: { id: true, name: true, surname: true } },
        lineItems: true,
      },
    });

    if (!bill) throw new Error("Webhook payment bill not found.");

    if (effectivePaymentStatus !== "CONFIRMED") {
      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: effectivePaymentStatus === "FAILED" ? "FAILED" : "PENDING_PROVIDER",
          lastError: verification.providerMessage ?? `Provider status: ${verification.providerStatus}`,
        },
      });

      await recordParentActivityEvents({
        schoolId: normalized.schoolId,
        studentIds: [bill.studentId],
        type: "PAYMENT",
        title: effectivePaymentStatus === "FAILED" ? "Online payment failed" : "Online payment pending",
        body: `${event.provider} payment of GHS ${normalized.amount.toFixed(2)} for ${bill.student.name} ${bill.student.surname} is ${effectivePaymentStatus.toLowerCase()}.`,
        href: `/parent/finance/bills/${bill.id}`,
        sourceModel: "PaymentIntent",
        sourceId: intent.id,
        sourceKey: `payment-intent:${intent.id}:${effectivePaymentStatus.toLowerCase()}`,
        occurredAt: new Date(),
        payload: {
          paymentIntentId: intent.id,
          provider: event.provider,
          externalReference: normalized.externalReference,
          amount: normalized.amount.toNumber(),
          status: effectivePaymentStatus,
        },
      });

      return markWebhookProcessed(webhookEventId, null, "PROCESSED");
    }

    let paymentResult: {
      payment: { id: number; receiptNumber: string; createdAt: Date; paymentDate: Date };
      receiptNumber: string;
      balanceApplied: boolean;
    };

    try {
      paymentResult = await prisma.$transaction(async (tx) => {
      const freshBill = await tx.studentBill.findFirst({
        where: { id: normalized.studentBillId, schoolId: normalized.schoolId },
        include: { lineItems: true },
      });
      if (!freshBill) throw new Error("Webhook payment bill not found during final confirmation.");

      const alreadySettledBeforeWebhook = freshBill.status === "PAID" || freshBill.status === "OVERPAID" || freshBill.status === "WAIVED";
      if (!alreadySettledBeforeWebhook) {
        assertPaymentWithinAllowedOverpay({
          amount: normalized.amount,
          currentBalance: freshBill.balance,
        });
      }

      let createdPayment;
      let shouldApplyBalance = true;
      let receiptNumber: string;

      if (existingPayment) {
        const currentBeforeUpdate = await tx.payment.findUnique({ where: { id: existingPayment.id } });
        if (!currentBeforeUpdate) throw new Error("Existing payment disappeared during webhook confirmation.");
        if (currentBeforeUpdate.status === "CONFIRMED") {
          await tx.paymentWebhookEvent.update({
            where: { id: webhookEventId },
            data: { paymentId: currentBeforeUpdate.id },
          });

          await tx.paymentIntent.update({
            where: { id: intent.id },
            data: { status: "PAID", lastError: null },
          });

          return {
            payment: currentBeforeUpdate,
            receiptNumber: currentBeforeUpdate.receiptNumber,
            balanceApplied: false,
          };
        }

        receiptNumber = await generateReceiptNumberInTransaction(tx, normalized.schoolId);
        const confirmed = await tx.payment.updateMany({
          where: { id: existingPayment.id, status: { not: "CONFIRMED" } },
          data: {
            receiptNumber,
            amount: normalized.amount,
            paymentDate: effectivePaymentDate,
            paidBy: effectivePaidBy,
            referenceNo: normalized.externalReference,
            notes: `Confirmed from ${event.provider} webhook ${event.providerEventId}`,
            status: "CONFIRMED",
          },
        });

        const currentPayment = await tx.payment.findUnique({ where: { id: existingPayment.id } });
        if (!currentPayment) throw new Error("Existing payment disappeared during webhook confirmation.");
        createdPayment = currentPayment;
        shouldApplyBalance = confirmed.count > 0;
      } else {
        receiptNumber = await generateReceiptNumberInTransaction(tx, normalized.schoolId);
        createdPayment = await tx.payment.create({
          data: {
            receiptNumber,
            amount: normalized.amount,
            schoolId: normalized.schoolId,
            paymentMethod: "OTHER",
            paymentDate: effectivePaymentDate,
            paidBy: effectivePaidBy,
            referenceNo: normalized.externalReference,
            externalProvider: event.provider,
            externalReference: normalized.externalReference,
            idempotencyKey,
            notes: `Recorded from ${event.provider} webhook ${event.providerEventId}`,
            status: "CONFIRMED",
            studentBillId: normalized.studentBillId,
            recordedBy: "system:webhook",
          },
        });
      }

      if (!shouldApplyBalance) {
        await tx.paymentWebhookEvent.update({
          where: { id: webhookEventId },
          data: { paymentId: createdPayment.id },
        });

        await tx.paymentIntent.update({
          where: { id: intent.id },
          data: { status: "PAID", lastError: null },
        });

        return { payment: createdPayment, receiptNumber: createdPayment.receiptNumber, balanceApplied: false };
      }

      const incrementedBill = await tx.studentBill.update({
        where: { id: normalized.studentBillId },
        data: {
          amountPaid: { increment: normalized.amount },
        },
        select: {
          totalAmount: true,
          amountPaid: true,
          discountAmount: true,
          status: true,
        },
      });
      const nextBill = billStatusAfterPayment({
        totalAmount: incrementedBill.totalAmount,
        amountPaid: incrementedBill.amountPaid,
        discountAmount: incrementedBill.discountAmount,
        currentStatus: incrementedBill.status,
      });

      await tx.studentBill.update({
        where: { id: normalized.studentBillId },
        data: {
          balance: nextBill.balance,
          status: nextBill.status,
        },
      });

      let remaining = new Prisma.Decimal(normalized.amount);
      const sortedLines = [...freshBill.lineItems].sort((a, b) => a.id - b.id);

      for (const line of sortedLines) {
        if (remaining.lte(0)) break;
        if (line.isPaid) continue;

        const lineBalance = new Prisma.Decimal(line.balance);
        if (lineBalance.lte(0)) continue;

        const allocated = Prisma.Decimal.min(remaining, lineBalance);
        const newPaid = new Prisma.Decimal(line.amountPaid).add(allocated);
        const newBalance = new Prisma.Decimal(line.amount).sub(newPaid);

        await tx.billLineItem.update({
          where: { id: line.id },
          data: {
            amountPaid: newPaid,
            balance: Prisma.Decimal.max(newBalance, 0),
            isPaid: newBalance.lte(0),
          },
        });

        remaining = remaining.sub(allocated);
      }

      await tx.paymentWebhookEvent.update({
        where: { id: webhookEventId },
        data: { paymentId: createdPayment.id },
      });

      await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { status: "PAID", lastError: null },
      });

      await tx.financeAuditLog.create({
        data: {
          schoolId: normalized.schoolId,
          action: "PAYMENT_RECORDED",
          performedBy: "system:webhook",
          entityType: "Payment",
          entityId: String(createdPayment.id),
          metadata: {
            receiptNumber,
            amount: normalized.amount.toNumber(),
            provider: event.provider,
            providerEventId: event.providerEventId,
            externalReference: normalized.externalReference,
            studentBillId: normalized.studentBillId,
            studentName: `${bill.student.name} ${bill.student.surname}`,
          } as Prisma.InputJsonValue,
        },
      });

      return { payment: createdPayment, receiptNumber, balanceApplied: true };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicatePayment = await prisma.payment.findFirst({
          where: {
            schoolId: normalized.schoolId,
            status: "CONFIRMED",
            OR: [
              { idempotencyKey },
              {
                externalProvider: event.provider,
                externalReference: normalized.externalReference,
              },
            ],
          },
        });

        if (duplicatePayment) {
          await prisma.paymentIntent.update({
            where: { id: intent.id },
            data: { status: "PAID", lastError: null },
          });
          return markWebhookProcessed(webhookEventId, duplicatePayment.id, "PROCESSED");
        }
      }

      throw error;
    }

    const payment = paymentResult.payment;
    const receiptNumber = paymentResult.receiptNumber;

    if (!paymentResult.balanceApplied) {
      return markWebhookProcessed(webhookEventId, payment.id, "PROCESSED");
    }

    const updatedBill = await prisma.studentBill.findFirst({
      where: { id: normalized.studentBillId, schoolId: normalized.schoolId },
      include: {
        feeStructure: { select: { title: true } },
      },
    });

    await recordParentActivityEvents({
      schoolId: normalized.schoolId,
      studentIds: [bill.studentId],
      type: "PAYMENT",
      title: `Online payment received: GHS ${normalized.amount.toFixed(2)}`,
      body: [
        `Bill: ${updatedBill?.feeStructure.title ?? "School fees"}`,
        `Receipt: ${receiptNumber}`,
        `Amount paid: GHS ${normalized.amount.toFixed(2)}`,
        `Method: ${PAYMENT_METHOD_LABELS.OTHER}`,
        `Provider: ${event.provider}`,
        `Current balance: GHS ${Number(updatedBill?.balance ?? 0).toFixed(2)}`,
        `Status: ${updatedBill?.status ?? "UPDATED"}`,
      ].join("\n"),
      href: `/api/finance/receipt?billId=${normalized.studentBillId}&receiptNumber=${encodeURIComponent(receiptNumber)}`,
      sourceModel: "Payment",
      sourceId: String(payment.id),
      sourceKey: `payment:${payment.id}:webhook-confirmed`,
      occurredAt: payment.createdAt,
      payload: {
        paymentId: payment.id,
        receiptNumber,
        amount: normalized.amount.toNumber(),
        provider: event.provider,
        paymentDate: payment.paymentDate.toISOString(),
        providerStatus: verification.providerStatus,
      },
    });

    await safelyNotifyConfirmedOnlinePayment({
      schoolId: normalized.schoolId,
      studentId: bill.studentId,
      studentName: `${bill.student.name} ${bill.student.surname}`,
      billId: normalized.studentBillId,
      billTitle: updatedBill?.feeStructure.title ?? "School fees",
      amount: normalized.amount,
      balance: updatedBill?.balance ?? 0,
      status: updatedBill?.status ?? "UPDATED",
      provider: event.provider,
      receiptNumber,
      paymentId: payment.id,
    });

    await Promise.all([
      enqueueFinanceJob({
        schoolId: normalized.schoolId,
        type: "GENERATE_RECEIPT_PDF",
        payload: { paymentId: payment.id, receiptNumber },
        idempotencyKey: `receipt-pdf:${normalized.schoolId}:${payment.id}`,
        createdBy: "system:webhook",
      }),
      enqueueFinanceJob({
        schoolId: normalized.schoolId,
        type: "SEND_PAYMENT_RECEIPT",
        payload: {
          paymentId: payment.id,
          studentBillId: normalized.studentBillId,
          receiptNumber,
        },
        idempotencyKey: `payment-receipt:${normalized.schoolId}:${payment.id}`,
        createdBy: "system:webhook",
      }),
      enqueueFinanceJob({
        schoolId: normalized.schoolId,
        type: "RECOMPUTE_FINANCE_SUMMARY",
        payload: {
          reason: "PAYMENT_WEBHOOK_PROCESSED",
          paymentId: payment.id,
          studentBillId: normalized.studentBillId,
        },
        idempotencyKey: `finance-summary:${normalized.schoolId}:payment:${payment.id}`,
        createdBy: "system:webhook",
      }),
    ]);

    return markWebhookProcessed(webhookEventId, payment.id, "PROCESSED");
  } catch (error) {
    await markWebhookFailed(webhookEventId, error);
    throw error;
  }
}
