import prisma from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import type { PaymentProvider, PaymentStatus, PaymentWebhookEvent } from "@/src/generated/prisma";
import {
  generateReceiptNumber,
  recomputeBillStatus,
  writeAuditLog,
} from "@/src/lib/actions/financeActions";
import { enqueueFinanceJob } from "@/src/lib/services/finance-queue";
import {
  assertCanRecordPayment,
  assertPaymentWithinAllowedOverpay,
} from "@/src/lib/services/finance-policy";
import { recordParentActivityEvents } from "@/src/lib/services/parent-activity-events";
import { PAYMENT_METHOD_LABELS } from "@/src/lib/constants/finance";

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
  const schoolId = readString(event.schoolId, payload.schoolId, data.schoolId, metadata.schoolId);
  const studentBillId = readNumber(payload.studentBillId, data.studentBillId, metadata.studentBillId);
  const amount = normalizeAmount(event.provider, payload, data);
  const externalReference = readString(
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

  if (!schoolId || !studentBillId || !amount || !externalReference) return null;

  return {
    schoolId,
    studentBillId,
    amount,
    externalReference,
    paidBy,
    paymentStatus: eventIsSuccessful ? "CONFIRMED" : eventIsFailed ? "FAILED" : "PENDING",
  };
}

function provisionalReceiptNumber(provider: PaymentProvider, externalReference: string) {
  const cleanRef = externalReference.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
  return `WEB-${provider}-${cleanRef || Date.now()}`;
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

    if (normalized.paymentStatus !== "CONFIRMED") {
      const payment = existingPayment ?? await prisma.payment.create({
        data: {
          receiptNumber: provisionalReceiptNumber(event.provider, normalized.externalReference),
          amount: normalized.amount,
          schoolId: normalized.schoolId,
          paymentMethod: "OTHER",
          paymentDate: new Date(),
          paidBy: normalized.paidBy,
          referenceNo: normalized.externalReference,
          externalProvider: event.provider,
          externalReference: normalized.externalReference,
          idempotencyKey,
          notes: `${normalized.paymentStatus.toLowerCase()} ${event.provider} payment webhook ${event.providerEventId}`,
          status: normalized.paymentStatus,
          studentBillId: normalized.studentBillId,
          recordedBy: "system:webhook",
        },
      });

      if (existingPayment && existingPayment.status !== normalized.paymentStatus) {
        existingPayment = await prisma.payment.update({
          where: { id: existingPayment.id },
          data: {
            status: normalized.paymentStatus,
            notes: `${normalized.paymentStatus.toLowerCase()} ${event.provider} payment webhook ${event.providerEventId}`,
          },
        });
      }

      await recordParentActivityEvents({
        schoolId: normalized.schoolId,
        studentIds: [bill.studentId],
        type: "PAYMENT",
        title: normalized.paymentStatus === "FAILED" ? "Online payment failed" : "Online payment pending",
        body: `${event.provider} payment of GHS ${normalized.amount.toFixed(2)} for ${bill.student.name} ${bill.student.surname} is ${normalized.paymentStatus.toLowerCase()}.`,
        href: `/parent/finance/bills/${bill.id}`,
        sourceModel: "Payment",
        sourceId: String(payment.id),
        sourceKey: `payment:${payment.id}:${normalized.paymentStatus.toLowerCase()}`,
        occurredAt: new Date(),
        payload: {
          paymentId: payment.id,
          provider: event.provider,
          externalReference: normalized.externalReference,
          amount: normalized.amount.toNumber(),
          status: normalized.paymentStatus,
        },
      });

      await prisma.paymentWebhookEvent.update({
        where: { id: webhookEventId },
        data: { paymentId: payment.id },
      });

      return markWebhookProcessed(webhookEventId, payment.id, "PROCESSED");
    }

    assertCanRecordPayment(bill.status);
    assertPaymentWithinAllowedOverpay({
      amount: normalized.amount,
      currentBalance: bill.balance,
    });

    const receiptNumber = await generateReceiptNumber(normalized.schoolId);
    const payment = await prisma.$transaction(async (tx) => {
      const createdPayment = existingPayment
        ? await tx.payment.update({
            where: { id: existingPayment.id },
            data: {
              receiptNumber,
              amount: normalized.amount,
              paymentDate: new Date(),
              paidBy: normalized.paidBy,
              referenceNo: normalized.externalReference,
              notes: `Confirmed from ${event.provider} webhook ${event.providerEventId}`,
              status: "CONFIRMED",
            },
          })
        : await tx.payment.create({
            data: {
              receiptNumber,
              amount: normalized.amount,
              schoolId: normalized.schoolId,
              paymentMethod: "OTHER",
              paymentDate: new Date(),
              paidBy: normalized.paidBy,
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

      await tx.studentBill.update({
        where: { id: normalized.studentBillId },
        data: {
          amountPaid: { increment: normalized.amount },
        },
      });

      let remaining = new Prisma.Decimal(normalized.amount);
      const sortedLines = [...bill.lineItems].sort((a, b) => a.id - b.id);

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

      return createdPayment;
    });

    await recomputeBillStatus(normalized.studentBillId, normalized.schoolId);
    const updatedBill = await prisma.studentBill.findFirst({
      where: { id: normalized.studentBillId, schoolId: normalized.schoolId },
      include: {
        feeStructure: { select: { title: true } },
      },
    });

    await writeAuditLog({
      schoolId: normalized.schoolId,
      action: "PAYMENT_RECORDED",
      performedBy: "system:webhook",
      entityType: "Payment",
      entityId: String(payment.id),
      metadata: {
        receiptNumber,
        amount: normalized.amount.toNumber(),
        provider: event.provider,
        providerEventId: event.providerEventId,
        externalReference: normalized.externalReference,
        studentBillId: normalized.studentBillId,
        studentName: `${bill.student.name} ${bill.student.surname}`,
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
      },
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
