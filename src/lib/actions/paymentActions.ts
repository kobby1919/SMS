"use server";

// src/lib/actions/paymentActions.ts
import prisma from "@/src/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  requireFinanceAccess,
  generateReceiptNumber,
  writeAuditLog,
  recomputeBillStatus,
} from "@/src/lib/actions/financeActions";
import { requireResourceAccess } from "@/src/lib/authz";
import { parseActionInput } from "@/src/lib/validation/parse";
import {
  paymentFiltersSchema,
  recordPaymentSchema,
  reversePaymentSchema,
} from "@/src/lib/validation/finance";
import { Prisma } from "@/src/generated/prisma";
import type { PaymentMethod } from "@/src/generated/prisma";
import { enforceActionRateLimit } from "@/src/lib/rate-limit";
import { revalidateDashboard, revalidateDocument } from "@/src/lib/cacheTags";
import { enqueueFinanceJob } from "@/src/lib/services/finance-queue";
import {
  assertCanRecordPayment,
  assertCanReversePayment,
  assertPaymentWithinAllowedOverpay,
} from "@/src/lib/services/finance-policy";
import { recordParentActivityEvents } from "@/src/lib/services/parent-activity-events";

// ─── Record a payment ─────────────────────────────────────────────────────────

export type RecordPaymentInput = {
  studentBillId: number;
  amount:         number;
  paymentMethod: PaymentMethod;
  paymentDate:    string;
  paidBy:         string;
  referenceNo?:   string;
  idempotencyKey?: string;
  notes?:         string;
};

export async function recordPayment(input: RecordPaymentInput) {
  const ctx = await requireFinanceAccess();
  const { userId, schoolId } = ctx;
  await enforceActionRateLimit({
    key: `finance:record-payment:${schoolId}:${userId}`,
    limit: 30,
    windowMs: 60_000,
  });
  const data = parseActionInput(recordPaymentSchema, input);
  const idempotencyKey = data.idempotencyKey?.trim() || null;

  if (idempotencyKey) {
    const existingPayment = await prisma.payment.findFirst({
      where: { schoolId, idempotencyKey },
    });

    if (existingPayment) {
      return existingPayment;
    }
  }

  const bill = requireResourceAccess(
    await prisma.studentBill.findFirst({
      where:   { id: data.studentBillId, schoolId },
      include: {
        student:      { select: { name: true, surname: true } },
        lineItems:    true,
      },
    }),
    ctx,
    "Bill not found.",
  );
  assertCanRecordPayment(bill.status);

  const currentBalance = new Prisma.Decimal(bill.balance);
  const paymentAmount = new Prisma.Decimal(data.amount);

  assertPaymentWithinAllowedOverpay({
    amount: paymentAmount,
    currentBalance,
  });

  const receiptNumber = await generateReceiptNumber();

  let reusedIdempotentPayment = false;

  const payment = await prisma.$transaction(async (tx) => {
    // 1. Create the Payment record
    const pmt = await tx.payment.create({
      data: {
        receiptNumber,
        amount:         paymentAmount,
        schoolId,
        paymentMethod: data.paymentMethod,
        paymentDate:    data.paymentDate ? new Date(data.paymentDate) : new Date(),
        paidBy:         data.paidBy.trim(),
        referenceNo:    data.referenceNo?.trim() ?? null,
        idempotencyKey,
        notes:          data.notes?.trim() ?? null,
        status:         "CONFIRMED",
        studentBillId: data.studentBillId,
        recordedBy:     userId,
      },
    });

    // 2. Update bill amountPaid
    await tx.studentBill.update({
      where: { id: data.studentBillId },
      data:  {
        amountPaid: { increment: paymentAmount },
      },
    });

    // 3. Allocate payment across line items (FIFO)
    let remaining = new Prisma.Decimal(paymentAmount);
    const sortedLines = [...bill.lineItems].sort((a, b) => a.id - b.id);

    for (const line of sortedLines) {
      if (remaining.lte(0)) break;
      if (line.isPaid) continue;

      const lineBalance = new Prisma.Decimal(line.balance);
      if (lineBalance.lte(0)) continue;

      const allocated = Prisma.Decimal.min(remaining, lineBalance);
      const newPaid   = new Prisma.Decimal(line.amountPaid).add(allocated);
      const newBal    = new Prisma.Decimal(line.amount).sub(newPaid);

      await tx.billLineItem.update({
        where: { id: line.id },
        data: {
          amountPaid: newPaid,
          balance:    Prisma.Decimal.max(newBal, 0),
          isPaid:     newBal.lte(0),
        },
      });

      remaining = remaining.sub(allocated);
    }

    return pmt;
  }).catch(async (error: unknown) => {
    if (
      idempotencyKey &&
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const existingPayment = await prisma.payment.findFirst({
        where: { schoolId, idempotencyKey },
      });

      if (existingPayment) {
        reusedIdempotentPayment = true;
        return existingPayment;
      }
    }

    throw error;
  });

  if (reusedIdempotentPayment) {
    return payment;
  }

  await recomputeBillStatus(data.studentBillId, schoolId);

  await writeAuditLog({
    schoolId,
    action:      "PAYMENT_RECORDED",
    performedBy: userId,
    entityType:  "Payment",
    entityId:    String(payment.id),
    metadata: {
      receiptNumber,
      amount:         paymentAmount.toNumber(),
      paymentMethod: data.paymentMethod,
      paidBy:         data.paidBy,
      studentBillId: data.studentBillId,
      studentName:   `${bill.student.name} ${bill.student.surname}`,
    },
  });

  await recordParentActivityEvents({
    schoolId,
    studentIds: [bill.studentId],
    type: "PAYMENT",
    title: `Payment received: GHS ${paymentAmount.toNumber().toFixed(2)}`,
    body: `Receipt ${receiptNumber} was recorded for ${bill.student.name} ${bill.student.surname}.`,
    href: `/api/finance/receipt?paymentId=${payment.id}`,
    sourceModel: "Payment",
    sourceId: String(payment.id),
    sourceKey: `payment:${payment.id}:confirmed`,
    occurredAt: payment.paymentDate,
    payload: {
      paymentId: payment.id,
      receiptNumber,
      amount: paymentAmount.toNumber(),
      paymentMethod: data.paymentMethod,
    },
  });

  await Promise.all([
    enqueueFinanceJob({
      schoolId,
      type: "GENERATE_RECEIPT_PDF",
      payload: { paymentId: payment.id, receiptNumber },
      idempotencyKey: `receipt-pdf:${schoolId}:${payment.id}`,
      createdBy: userId,
    }),
    enqueueFinanceJob({
      schoolId,
      type: "SEND_PAYMENT_RECEIPT",
      payload: {
        paymentId: payment.id,
        studentBillId: data.studentBillId,
        receiptNumber,
      },
      idempotencyKey: `payment-receipt:${schoolId}:${payment.id}`,
      createdBy: userId,
    }),
    enqueueFinanceJob({
      schoolId,
      type: "RECOMPUTE_FINANCE_SUMMARY",
      payload: {
        reason: "PAYMENT_RECORDED",
        paymentId: payment.id,
        studentBillId: data.studentBillId,
      },
      idempotencyKey: `finance-summary:${schoolId}:payment:${payment.id}`,
      createdBy: userId,
    }),
    enqueueFinanceJob({
      schoolId,
      type: "GENERATE_DAILY_REPORT",
      payload: {
        date: payment.paymentDate.toISOString().slice(0, 10),
      },
      idempotencyKey: `daily-report:${schoolId}:${payment.paymentDate.toISOString().slice(0, 10)}`,
      createdBy: userId,
    }),
  ]);

  revalidatePath(`/list/finance/bills/${data.studentBillId}`);
  revalidatePath("/list/finance/bills");
  revalidatePath("/list/finance/payments");
  revalidatePath("/bursar");
  revalidateDashboard(schoolId);
  revalidateDocument(
    schoolId,
    "daily-finance",
    payment.paymentDate.toISOString().slice(0, 10),
  );

  return payment;
}

// ─── Reverse a payment ────────────────────────────────────────────────────────

export async function reversePayment(paymentId: number, reason: string) {
  const ctx = await requireFinanceAccess();
  const { userId, schoolId } = ctx;
  await enforceActionRateLimit({
    key: `finance:reverse-payment:${schoolId}:${userId}`,
    limit: 10,
    windowMs: 10 * 60_000,
  });
  const data = parseActionInput(reversePaymentSchema, { paymentId, reason });

  const payment = requireResourceAccess(
    await prisma.payment.findFirst({
      where:   { id: data.paymentId, schoolId },
      include: {
        studentBill: {
          include: {
            student:   { select: { name: true, surname: true } },
            lineItems: true,
          },
        },
        reversal: true,
      },
    }),
    ctx,
    "Payment not found.",
  );
  assertCanReversePayment({
    status: payment.status,
    hasReversal: Boolean(payment.reversal),
  });

  const billId = payment.studentBillId;
  const amountToReverse = new Prisma.Decimal(payment.amount);

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: data.paymentId },
      data:  { status: "REVERSED" },
    });

    await tx.paymentReversal.create({
      data: {
        schoolId,
        paymentId: data.paymentId,
        reason:      data.reason.trim(),
        reversedBy: userId,
        reversedAt: new Date(),
      },
    });

    // 3. Reduce bill amountPaid
    await tx.studentBill.update({
      where: { id: billId },
      data:  { amountPaid: { decrement: amountToReverse } },
    });

    // 4. Reverse FIFO line item allocation (LIFO order for unwinding)
    let toUnwind = new Prisma.Decimal(amountToReverse);
    const sortedLines = [...payment.studentBill.lineItems]
      .sort((a, b) => b.id - a.id);

    for (const line of sortedLines) {
      if (toUnwind.lte(0)) break;

      const paid      = new Prisma.Decimal(line.amountPaid);
      const toDeduct  = Prisma.Decimal.min(toUnwind, paid);
      const newPaid   = paid.sub(toDeduct);
      const newBal    = new Prisma.Decimal(line.amount).sub(newPaid);

      await tx.billLineItem.update({
        where: { id: line.id },
        data: {
          amountPaid: Prisma.Decimal.max(newPaid, 0),
          balance:    newBal,
          isPaid:     false,
        },
      });

      toUnwind = toUnwind.sub(toDeduct);
    }
  });

  await recomputeBillStatus(billId, schoolId);

  await writeAuditLog({
    schoolId,
    action:      "PAYMENT_REVERSED",
    performedBy: userId,
    entityType:  "Payment",
    entityId:    String(data.paymentId),
    metadata: {
      paymentId: data.paymentId,
      receiptNumber: payment.receiptNumber,
      amount: amountToReverse.toNumber(),
      reason: data.reason,
      studentBillId: billId,
    },
  });

  await Promise.all([
    enqueueFinanceJob({
      schoolId,
      type: "RECOMPUTE_FINANCE_SUMMARY",
      payload: {
        reason: "PAYMENT_REVERSED",
        paymentId: data.paymentId,
        studentBillId: billId,
      },
      idempotencyKey: `finance-summary:${schoolId}:payment-reversal:${data.paymentId}`,
      createdBy: userId,
    }),
    enqueueFinanceJob({
      schoolId,
      type: "GENERATE_DAILY_REPORT",
      payload: {
        date: payment.paymentDate.toISOString().slice(0, 10),
      },
      idempotencyKey: `daily-report:${schoolId}:${payment.paymentDate.toISOString().slice(0, 10)}`,
      createdBy: userId,
    }),
  ]);

  revalidatePath(`/list/finance/bills/${billId}`);
  revalidatePath("/list/finance/payments");
  revalidatePath("/bursar");
  revalidateDashboard(schoolId);
  revalidateDocument(schoolId, "receipt", data.paymentId);
  revalidateDocument(
    schoolId,
    "daily-finance",
    payment.paymentDate.toISOString().slice(0, 10),
  );
}

// ─── Get all payments ─────────────────────────────────────────────────────────

export type PaymentFilters = {
  status?:  string;
  method?:  string;
  dateFrom?: string;
  dateTo?:   string;
  search?:   string;
  page?:     number;
};

export async function getPayments(filters: PaymentFilters = {}) {
  const { schoolId } = await requireFinanceAccess();
  const f = parseActionInput(paymentFiltersSchema, filters);

  const PAGE_SIZE = 20;
  const page      = f.page ?? 1;

  const where: Prisma.PaymentWhereInput = { schoolId };
  if (f.status) where.status         = f.status;
  if (f.method) where.paymentMethod  = f.method;
  if (f.dateFrom || f.dateTo) {
    where.paymentDate = {};
    if (f.dateFrom) where.paymentDate.gte = new Date(f.dateFrom);
    if (f.dateTo)   where.paymentDate.lte = new Date(f.dateTo + "T23:59:59");
  }
  if (f.search) {
    where.OR = [
      { receiptNumber: { contains: f.search, mode: "insensitive" } },
      { paidBy:         { contains: f.search, mode: "insensitive" } },
      { referenceNo:    { contains: f.search, mode: "insensitive" } },
      { studentBill:   { student: { name:     { contains: f.search, mode: "insensitive" } } } },
      { studentBill:   { student: { surname: { contains: f.search, mode: "insensitive" } } } },
    ];
  }

  const [payments, count] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        studentBill: {
          include: {
            student: {
              select: {
                name:    true,
                surname: true,
                class:   { select: { name: true } },
              },
            },
            feeStructure: { select: { term: true, academicYear: true } },
          },
        },
        reversal: { select: { reason: true, reversedAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take:    PAGE_SIZE,
      skip:    PAGE_SIZE * (page - 1),
    }),
    prisma.payment.count({ where }),
  ]);

  return { payments, count, pageSize: PAGE_SIZE };
}
