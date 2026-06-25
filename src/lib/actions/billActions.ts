"use server";

// src/lib/actions/billActions.ts
import prisma from "@/src/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  requireFinanceAccess,
  writeAuditLog,
} from "@/src/lib/actions/financeActions";
import { requireResourceAccess } from "@/src/lib/authz";
import { parseActionInput } from "@/src/lib/validation/parse";
import {
  billFiltersSchema,
  billPreviewSchema,
  generateBillsSchema,
  waiveBillSchema,
} from "@/src/lib/validation/finance";
import { Prisma } from "@/src/generated/prisma";
import type { BillStatus } from "@/src/generated/prisma";
import { enforceActionRateLimit } from "@/src/lib/rate-limit";
import { revalidateDashboard } from "@/src/lib/cacheTags";
import { enqueueFinanceJob } from "@/src/lib/services/finance-queue";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BillPreview = {
  classId:         number;
  className:       string;
  studentCount:    number;
  alreadyBilled:   number;
  newBillCount:    number;
  totalAmount:     number;
  grandTotal:      number;
};

export type GenerateBillsInput = {
  feeStructureId:       number;
  classIds:             number[];
  includeOptionalItems: boolean;
};

// ─── Preview (no DB writes) ───────────────────────────────────────────────────
export async function previewBillGeneration(
  feeStructureId: number,
  classIds:        number[]
): Promise<{ previews: BillPreview[]; mandatoryTotal: number; optionalTotal: number }> {
  const { schoolId } = await requireFinanceAccess();
  const input = parseActionInput(billPreviewSchema, { feeStructureId, classIds });

  const structure = await prisma.feeStructure.findFirst({
    where:   { id: input.feeStructureId, schoolId },
    include: {
      feeItems: true,
      grade:    { select: { id: true } },
    },
  });
  if (!structure) throw new Error("Fee structure not found.");
  if (structure.status !== "PUBLISHED") {
    throw new Error("Bills can only be generated from a published fee structure.");
  }

  const mandatoryTotal = structure.feeItems
    .filter((i) => !i.isOptional)
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const optionalTotal = structure.feeItems
    .filter((i) => i.isOptional)
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const uniqueClassIds = [...new Set(input.classIds)];
  const classes = await prisma.class.findMany({
    where: { id: { in: uniqueClassIds }, schoolId },
    select: { id: true, name: true, students: { select: { id: true } } },
  });
  if (classes.length !== uniqueClassIds.length) {
    throw new Error("One or more selected classes were not found.");
  }

  const studentIds = classes.flatMap((cls) => cls.students.map((student) => student.id));
  const existingBills = await prisma.studentBill.findMany({
    where: { schoolId, feeStructureId: input.feeStructureId, studentId: { in: studentIds } },
    select: { studentId: true },
  });
  const billedStudentIds = new Set(existingBills.map((bill) => bill.studentId));

  const previews: BillPreview[] = classes.map((cls) => {
    const alreadyBilled = cls.students.reduce(
      (count, student) => count + Number(billedStudentIds.has(student.id)),
      0,
    );
    const newBillCount = cls.students.length - alreadyBilled;
    return {
      classId: cls.id,
      className: cls.name,
      studentCount: cls.students.length,
      alreadyBilled,
      newBillCount,
      totalAmount: mandatoryTotal,
      grandTotal: newBillCount * mandatoryTotal,
    };
  });

  return { previews, mandatoryTotal, optionalTotal };
}

// ─── Generate Bills (writes to DB) ───────────────────────────────────────────

export async function generateBills(rawInput: GenerateBillsInput): Promise<{
  created: number;
  skipped: number;
}> {
  const ctx = await requireFinanceAccess();
  const { userId, schoolId } = ctx;
  await enforceActionRateLimit({
    key: `finance:generate-bills:${schoolId}:${userId}`,
    limit: 5,
    windowMs: 10 * 60_000,
  });
  const input = parseActionInput(generateBillsSchema, rawInput);

  const structure = requireResourceAccess(
    await prisma.feeStructure.findFirst({
      where:   { id: input.feeStructureId, schoolId },
      include: { feeItems: true },
    }),
    ctx,
    "Fee structure not found.",
  );
  if (structure.status !== "PUBLISHED") {
    throw new Error("Bills can only be generated from a published fee structure.");
  }
  if (input.classIds.length === 0) {
    throw new Error("Select at least one class to generate bills for.");
  }

  const itemsToInclude = input.includeOptionalItems
    ? structure.feeItems
    : structure.feeItems.filter((i) => !i.isOptional);

  if (itemsToInclude.length === 0) {
    throw new Error("No fee items to bill. Add items to the structure first.");
  }

  // Use Prisma.Decimal for consistent math
  const billTotal = itemsToInclude.reduce(
    (sum, i) => sum.add(new Prisma.Decimal(i.amount)), new Prisma.Decimal(0)
  );

  const students = await prisma.student.findMany({
    where:  { schoolId, classId: { in: input.classIds } },
    select: { id: true, classId: true },
  });

  const createdBills = await prisma.$transaction(async (tx) => {
    const bills = await tx.studentBill.createManyAndReturn({
      data: students.map((student) => ({
        schoolId,
        studentId: student.id,
        feeStructureId: input.feeStructureId,
        totalAmount: billTotal,
        amountPaid: 0,
        discountAmount: 0,
        balance: billTotal,
        status: "UNPAID" as const,
        generatedBy: userId,
      })),
      skipDuplicates: true,
      select: { id: true },
    });

    if (bills.length > 0) {
      await tx.billLineItem.createMany({
        data: bills.flatMap((bill) =>
          itemsToInclude.map((item) => ({
            studentBillId: bill.id,
            feeItemId: item.id,
            amount: new Prisma.Decimal(item.amount),
            amountPaid: 0,
            balance: new Prisma.Decimal(item.amount),
            isPaid: false,
          })),
        ),
      });
    }

    return bills;
  });
  const created = createdBills.length;
  const skipped = students.length - created;

  await writeAuditLog({
    schoolId,
    action:      "BILL_GENERATED",
    performedBy: userId,
    entityType:  "FeeStructure",
    entityId:    input.feeStructureId,
    metadata: {
      feeStructureId:  input.feeStructureId,
      classIds:        input.classIds,
      billsCreated:    created,
      billsSkipped:    skipped,
      amountPerStudent: billTotal.toNumber(),
      totalGenerated:  billTotal.mul(created).toNumber(),
      includeOptional: input.includeOptionalItems,
    },
  });

  await Promise.all([
    enqueueFinanceJob({
      schoolId,
      type: "RECOMPUTE_FINANCE_SUMMARY",
      payload: {
        reason: "BILL_GENERATED",
        feeStructureId: input.feeStructureId,
        created,
        skipped,
      },
      idempotencyKey: `finance-summary:${schoolId}:fee-structure:${input.feeStructureId}:bills`,
      createdBy: userId,
    }),
    enqueueFinanceJob({
      schoolId,
      type: "SEND_PAYMENT_REMINDER",
      payload: {
        feeStructureId: input.feeStructureId,
        classIds: input.classIds,
      },
      idempotencyKey: `payment-reminders:${schoolId}:fee-structure:${input.feeStructureId}`,
      createdBy: userId,
      runAfter: new Date(Date.now() + 15 * 60_000),
    }),
  ]);

  revalidatePath("/list/finance/bills");
  revalidatePath(`/list/finance/fee-structures/${input.feeStructureId}`);
  revalidatePath("/bursar");
  revalidateDashboard(schoolId);

  return { created, skipped };
}

// ─── Waive a bill ─────────────────────────────────────────────────────────────

export async function waiveBill(billId: number, reason: string) {
  ({ billId, reason } = parseActionInput(waiveBillSchema, { billId, reason }));
  const ctx = await requireFinanceAccess();
  const { userId, schoolId } = ctx;

  const bill = requireResourceAccess(
    await prisma.studentBill.findFirst({
      where:   { id: billId, schoolId },
      include: { student: { select: { name: true, surname: true } } },
    }),
    ctx,
    "Bill not found.",
  );
  if (bill.status === "PAID") {
    throw new Error("Cannot waive a bill that has already been paid.");
  }
  if (bill.status === "WAIVED") {
    throw new Error("This bill is already waived.");
  }

  await prisma.studentBill.update({
    where: { id: billId },
    data: {
      status:  "WAIVED",
      balance: 0,
      notes:   reason,
    },
  });

  await writeAuditLog({
    schoolId,
    action:      "BILL_WAIVED",
    performedBy: userId,
    entityType:  "StudentBill",
    entityId:    billId,
    metadata: {
      billId,
      studentId:   bill.studentId,
      studentName: `${bill.student.name} ${bill.student.surname}`,
      reason,
      originalAmount: Number(bill.totalAmount),
    },
  });

  await enqueueFinanceJob({
    schoolId,
    type: "RECOMPUTE_FINANCE_SUMMARY",
    payload: {
      reason: "BILL_WAIVED",
      billId,
    },
    idempotencyKey: `finance-summary:${schoolId}:bill-waived:${billId}`,
    createdBy: userId,
  });

  revalidatePath("/list/finance/bills");
  revalidatePath(`/list/finance/bills/${billId}`);
  revalidateDashboard(schoolId);
}

// ─── Get bills (with filters) ─────────────────────────────────────────────────

export type BillFilters = {
  feeStructureId?: number;
  classId?:        number;
  status?:         BillStatus;
  studentId?:      string;
  page?:           number;
};

export async function getBills(filters: BillFilters = {}) {
  const { schoolId } = await requireFinanceAccess();
  const f = parseActionInput(billFiltersSchema, filters);

  const where: Prisma.StudentBillWhereInput = { schoolId };
  if (f.feeStructureId) where.feeStructureId = f.feeStructureId;
  if (f.status)         where.status         = f.status;
  if (f.studentId)      where.studentId      = f.studentId;
  if (f.classId) {
    where.student = { classId: f.classId };
  }

  const PAGE_SIZE = 20;
  const page      = f.page ?? 1;

  const [bills, count] = await Promise.all([
    prisma.studentBill.findMany({
      where,
      include: {
        student: {
          select: {
            name:    true,
            surname: true,
            class:   { select: { name: true } },
          },
        },
        feeStructure: {
          select: { title: true, term: true, academicYear: true },
        },
        payments: {
          where:  { status: "CONFIRMED" },
          select: { amount: true, receiptNumber: true, paymentDate: true },
          orderBy: { createdAt: "desc" },
          take:   1,
        },
      },
      orderBy: [{ status: "asc" }, { balance: "desc" }],
      take:    PAGE_SIZE,
      skip:    PAGE_SIZE * (page - 1),
    }),
    prisma.studentBill.count({ where }),
  ]);

  return { bills, count, pageSize: PAGE_SIZE };
}
