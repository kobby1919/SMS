"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/src/lib/prisma";
import { requireRole, requireResourceAccess } from "@/src/lib/authz";
import { requireFinanceAccess } from "@/src/lib/actions/financeActions";
import { parseActionInput } from "@/src/lib/validation/parse";
import { parentFinanceQuerySchema, resolveFinanceQuerySchema } from "@/src/lib/validation/finance";
import { enforceActionRateLimit } from "@/src/lib/rate-limit";
import { recordParentActivityEvents } from "@/src/lib/services/parent-activity-events";

const QUERY_REASON_LABELS: Record<string, string> = {
  ALREADY_PAID: "I have already paid",
  WRONG_AMOUNT: "Wrong amount",
  NEED_CLARIFICATION: "Need clarification",
  RECEIPT_ISSUE: "Receipt issue",
  OTHER: "Other",
};

export async function openParentFinanceQuery(input: unknown) {
  const ctx = await requireRole(["parent"]);
  const { schoolId, userId } = ctx;
  await enforceActionRateLimit({
    key: `parent-finance:query:${schoolId}:${userId}`,
    limit: 10,
    windowMs: 60_000,
  });
  const data = parseActionInput(parentFinanceQuerySchema, input);

  const bill = requireResourceAccess(
    await prisma.studentBill.findFirst({
      where: {
        id: data.studentBillId,
        schoolId,
        student: { parentId: userId },
      },
      include: {
        student: { select: { id: true, name: true, surname: true } },
        feeStructure: { select: { title: true } },
        payments: {
          where: data.paymentId ? { id: data.paymentId } : { id: -1 },
          select: { id: true, receiptNumber: true },
        },
      },
    }),
    ctx,
    "Bill not found.",
  );

  if (data.paymentId && bill.payments.length === 0) {
    throw new Error("Payment not found for this bill.");
  }

  const query = await prisma.financeQuery.create({
    data: {
      schoolId,
      parentId: userId,
      studentId: bill.student.id,
      studentBillId: bill.id,
      paymentId: data.paymentId ?? null,
      reason: data.reason,
      message: data.message.trim(),
    },
  });

  await prisma.financeAuditLog.create({
    data: {
      schoolId,
      action: "FINANCE_QUERY_OPENED",
      performedBy: userId,
      entityType: "FinanceQuery",
      entityId: String(query.id),
      metadata: {
        queryId: query.id,
        billId: bill.id,
        paymentId: data.paymentId ?? null,
        reason: data.reason,
        studentId: bill.student.id,
        studentName: `${bill.student.name} ${bill.student.surname}`,
      },
    },
  });

  await recordParentActivityEvents({
    schoolId,
    studentIds: [bill.student.id],
    type: "BILL",
    title: "Finance query submitted",
    body: `${QUERY_REASON_LABELS[data.reason]} query was submitted for ${bill.feeStructure.title}.`,
    href: `/parent/finance/bills/${bill.id}`,
    sourceModel: "FinanceQuery",
    sourceId: String(query.id),
    sourceKey: `finance-query:${query.id}:opened`,
    occurredAt: query.createdAt,
    payload: {
      queryId: query.id,
      billId: bill.id,
      paymentId: data.paymentId ?? null,
      reason: data.reason,
    },
  });

  revalidatePath("/parent");
  revalidatePath("/parent/finance");
  revalidatePath(`/parent/finance/bills/${bill.id}`);

  return query;
}

export async function resolveFinanceQuery(input: unknown) {
  const ctx = await requireFinanceAccess();
  const { schoolId, userId } = ctx;
  const data = parseActionInput(resolveFinanceQuerySchema, input);

  const existing = requireResourceAccess(
    await prisma.financeQuery.findFirst({
      where: { id: data.queryId, schoolId },
      include: {
        studentBill: { select: { id: true } },
        student: { select: { id: true, name: true, surname: true } },
      },
    }),
    ctx,
    "Finance query not found.",
  );

  const query = await prisma.financeQuery.update({
    where: { id: existing.id },
    data: {
      status: data.status,
      response: data.response.trim(),
      resolvedBy: userId,
      resolvedAt: new Date(),
    },
  });

  await prisma.financeAuditLog.create({
    data: {
      schoolId,
      action: "FINANCE_QUERY_RESOLVED",
      performedBy: userId,
      entityType: "FinanceQuery",
      entityId: String(query.id),
      metadata: {
        queryId: query.id,
        billId: existing.studentBill.id,
        studentId: existing.student.id,
        studentName: `${existing.student.name} ${existing.student.surname}`,
        status: data.status,
      },
    },
  });

  await recordParentActivityEvents({
    schoolId,
    studentIds: [existing.student.id],
    type: "BILL",
    title: "Finance query updated",
    body: `The finance office responded to your query for bill #${existing.studentBill.id}.`,
    href: `/parent/finance/bills/${existing.studentBill.id}`,
    sourceModel: "FinanceQuery",
    sourceId: String(query.id),
    sourceKey: `finance-query:${query.id}:${data.status.toLowerCase()}`,
    occurredAt: new Date(),
    payload: {
      queryId: query.id,
      billId: existing.studentBill.id,
      status: data.status,
    },
  });

  revalidatePath(`/list/finance/bills/${existing.studentBill.id}`);
  revalidatePath("/parent");
  revalidatePath("/parent/finance");
  revalidatePath(`/parent/finance/bills/${existing.studentBill.id}`);

  return query;
}
