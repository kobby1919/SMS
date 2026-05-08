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
import { billFiltersSchema, generateBillsSchema } from "@/src/lib/validation/finance";
import { Prisma } from "@/src/generated/prisma";
import type { BillStatus } from "@/src/generated/prisma";

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

  const structure = await prisma.feeStructure.findFirst({
    where:   { id: feeStructureId, schoolId },
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

  const previews: BillPreview[] = await Promise.all(
    classIds.map(async (classId) => {
      const cls = await prisma.class.findFirst({
        where:  { id: classId, schoolId },
        select: { name: true, students: { where: { schoolId }, select: { id: true } } },
      });
      if (!cls) throw new Error(`Class ${classId} not found.`);

      const studentIds = cls.students.map((s) => s.id);

      const existingBills = await prisma.studentBill.count({
        where: {
          schoolId,
          feeStructureId,
          studentId: { in: studentIds },
        },
      });

      const newBillCount = studentIds.length - existingBills;

      return {
        classId,
        className:      cls.name,
        studentCount:   studentIds.length,
        alreadyBilled:  existingBills,
        newBillCount,
        totalAmount:    mandatoryTotal,
        grandTotal:     newBillCount * mandatoryTotal,
      };
    })
  );

  return { previews, mandatoryTotal, optionalTotal };
}

// ─── Generate Bills (writes to DB) ───────────────────────────────────────────

export async function generateBills(rawInput: GenerateBillsInput): Promise<{
  created: number;
  skipped: number;
}> {
  const ctx = await requireFinanceAccess();
  const { userId, schoolId } = ctx;
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

  let created = 0;
  let skipped = 0;

  const students = await prisma.student.findMany({
    where:  { schoolId, classId: { in: input.classIds } },
    select: { id: true, classId: true },
  });

  await prisma.$transaction(async (tx) => {
    for (const student of students) {
      const existing = await tx.studentBill.findUnique({
        where: {
          schoolId_studentId_feeStructureId: {
            schoolId,
            studentId:      student.id,
            feeStructureId: input.feeStructureId,
          },
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const bill = await tx.studentBill.create({
        data: {
          schoolId,
          studentId:      student.id,
          feeStructureId: input.feeStructureId,
          totalAmount:    billTotal,
          amountPaid:     0,
          discountAmount: 0,
          balance:        billTotal,
          status:         "UNPAID",
          generatedBy:    userId,
        },
      });

      await tx.billLineItem.createMany({
        data: itemsToInclude.map((item) => ({
          studentBillId: bill.id,
          feeItemId:     item.id,
          amount:        new Prisma.Decimal(item.amount),
          amountPaid:    0,
          balance:       new Prisma.Decimal(item.amount),
          isPaid:        false,
        })),
      });

      created++;
    }
  });

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

  revalidatePath("/list/finance/bills");
  revalidatePath(`/list/finance/fee-structures/${input.feeStructureId}`);
  revalidatePath("/bursar");

  return { created, skipped };
}

// ─── Waive a bill ─────────────────────────────────────────────────────────────

export async function waiveBill(billId: number, reason: string) {
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

  revalidatePath("/list/finance/bills");
  revalidatePath(`/list/finance/bills/${billId}`);
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
