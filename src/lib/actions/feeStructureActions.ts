"use server";

// src/lib/actions/feeStructureActions.ts
// All server actions for Fee Structure management (Step 2).
// Fee structures are the master templates that bills are generated from.
// Only admin and bursar can manage fee structures.

import prisma from "@/src/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  requireFinanceAccess,
  writeAuditLog,
} from "@/src/lib/actions/financeActions";
import type { FeeCategory, Term } from "@/src/generated/prisma";
import { parseActionInput } from "@/src/lib/validation/parse";
import { feeStructureCreateSchema } from "@/src/lib/validation/finance";

// ─── Fee Structure CRUD ───────────────────────────────────────────────────────

export type FeeStructureInput = {
  title:        string;
  description?: string;
  gradeId:      number;
  term:         Term;
  academicYear: string;
};

export async function createFeeStructure(data: FeeStructureInput) {
  const { userId, schoolId } = await requireFinanceAccess();
  const parsed = parseActionInput(feeStructureCreateSchema, data);

  const existing = await prisma.feeStructure.findUnique({
    where: {
      schoolId_gradeId_term_academicYear: {
        schoolId,
        gradeId:      parsed.gradeId,
        term:         parsed.term,
        academicYear: parsed.academicYear,
      },
    },
  });
  if (existing) {
    throw new Error(
      "A fee structure for this grade, term, and academic year already exists."
    );
  }

  const structure = await prisma.feeStructure.create({
    data: {
      schoolId,
      title:        parsed.title,
      description:  parsed.description ?? null,
      gradeId:      parsed.gradeId,
      term:         parsed.term,
      academicYear: parsed.academicYear,
      status:       "DRAFT",
      createdBy:    userId,
    },
  });

  await writeAuditLog({
    schoolId,
    action:      "FEE_STRUCTURE_CREATED",
    performedBy: userId,
    entityType:  "FeeStructure",
    entityId:    structure.id,
    metadata: {
      title:        structure.title,
      gradeId:      structure.gradeId,
      term:         structure.term,
      academicYear: structure.academicYear,
    },
  });

  revalidatePath("/list/finance/fee-structures");
  return structure;
}

export async function updateFeeStructure(
  id:   number,
  data: Partial<Pick<FeeStructureInput, "title" | "description">>
) {
  const { schoolId } = await requireFinanceAccess();

  // Cannot edit a published structure
  const existing = await prisma.feeStructure.findFirst({
    where: { id, schoolId },
  });
  if (!existing) throw new Error("Fee structure not found.");
  if (existing.status === "PUBLISHED") {
    throw new Error(
      "This fee structure is published and cannot be edited. " +
      "Unpublish it first if changes are needed (note: this will affect generated bills)."
    );
  }

  await prisma.feeStructure.update({
    where: { id },
    data: {
      title:       data.title?.trim(),
      description: data.description?.trim() ?? null,
    },
  });

  revalidatePath("/list/finance/fee-structures");
  revalidatePath(`/list/finance/fee-structures/${id}`);
}

export async function publishFeeStructure(id: number) {
  const { userId, schoolId } = await requireFinanceAccess();

  const structure = await prisma.feeStructure.findFirst({
    where:   { id, schoolId },
    include: { feeItems: true },
  });
  if (!structure) throw new Error("Fee structure not found.");
  if (structure.status === "PUBLISHED") throw new Error("Already published.");

  // Must have at least one fee item before publishing
  if (structure.feeItems.length === 0) {
    throw new Error(
      "Add at least one fee item before publishing this structure."
    );
  }

  // Must have at least one non-optional (mandatory) fee item
  const hasMandatory = structure.feeItems.some((item) => !item.isOptional);
  if (!hasMandatory) {
    throw new Error(
      "At least one fee item must be non-optional (mandatory). " +
      "A structure with only optional items cannot be published."
    );
  }

  await prisma.feeStructure.update({
    where: { id },
    data:  { status: "PUBLISHED", publishedAt: new Date() },
  });

  await writeAuditLog({
    schoolId,
    action:      "FEE_STRUCTURE_PUBLISHED",
    performedBy: userId,
    entityType:  "FeeStructure",
    entityId:    id,
    metadata: {
      title:        structure.title,
      feeItemCount: structure.feeItems.length,
      totalAmount:  structure.feeItems
        .reduce((sum, item) => sum + Number(item.amount), 0),
    },
  });

  revalidatePath("/list/finance/fee-structures");
  revalidatePath(`/list/finance/fee-structures/${id}`);
}

export async function deleteFeeStructure(id: number) {
  const { userId, schoolId } = await requireFinanceAccess();

  const structure = await prisma.feeStructure.findFirst({
    where:   { id, schoolId },
    include: { bills: { take: 1 } },
  });
  if (!structure) throw new Error("Fee structure not found.");

  // Cannot delete if bills have already been generated from it
  if (structure.bills.length > 0) {
    throw new Error(
      "Cannot delete this fee structure — student bills have already been " +
      "generated from it. Archive or waive individual bills instead."
    );
  }

  await prisma.feeStructure.delete({ where: { id } });

  await writeAuditLog({
    schoolId,
    action:      "FEE_STRUCTURE_DELETED",
    performedBy: userId,
    entityType:  "FeeStructure",
    entityId:    id,
    metadata:    { title: structure.title, term: structure.term, academicYear: structure.academicYear },
  });

  revalidatePath("/list/finance/fee-structures");
}

// ─── Fee Item CRUD ────────────────────────────────────────────────────────────

export type FeeItemInput = {
  name:          string;
  amount:        number;
  category:      FeeCategory;
  isOptional:    boolean;
  description?:  string;
};

export async function addFeeItem(
  feeStructureId: number,
  data:           FeeItemInput
) {
  const { schoolId } = await requireFinanceAccess();

  // Cannot add items to a published structure
  const structure = await prisma.feeStructure.findFirst({
    where: { id: feeStructureId, schoolId },
  });
  if (!structure) throw new Error("Fee structure not found.");
  if (structure.status === "PUBLISHED") {
    throw new Error("Cannot add items to a published fee structure.");
  }

  if (!data.name.trim())   throw new Error("Item name is required.");
  if (data.amount <= 0)    throw new Error("Amount must be greater than zero.");

  const item = await prisma.feeItem.create({
    data: {
      feeStructureId,
      name:        data.name.trim(),
      amount:      data.amount,
      category:    data.category,
      isOptional:  data.isOptional,
      description: data.description?.trim() ?? null,
    },
  });

  revalidatePath(`/list/finance/fee-structures/${feeStructureId}`);
  return item;
}

export async function updateFeeItem(
  itemId: number,
  data:   Partial<FeeItemInput>
) {
  const { schoolId } = await requireFinanceAccess();

  const item = await prisma.feeItem.findFirst({
    where:   { id: itemId, feeStructure: { is: { schoolId } } },
    include: { feeStructure: true },
  });
  if (!item) throw new Error("Fee item not found.");
  if (item.feeStructure.status === "PUBLISHED") {
    throw new Error("Cannot edit items on a published fee structure.");
  }

  if (data.amount !== undefined && data.amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  await prisma.feeItem.update({
    where: { id: itemId },
    data: {
      name:        data.name?.trim(),
      amount:      data.amount,
      category:    data.category,
      isOptional:  data.isOptional,
      description: data.description?.trim() ?? null,
    },
  });

  revalidatePath(`/list/finance/fee-structures/${item.feeStructureId}`);
}

export async function deleteFeeItem(itemId: number) {
  const { schoolId } = await requireFinanceAccess();

  const item = await prisma.feeItem.findFirst({
    where:   { id: itemId, feeStructure: { is: { schoolId } } },
    include: { feeStructure: true },
  });
  if (!item) throw new Error("Fee item not found.");
  if (item.feeStructure.status === "PUBLISHED") {
    throw new Error("Cannot delete items from a published fee structure.");
  }

  await prisma.feeItem.delete({ where: { id: itemId } });
  revalidatePath(`/list/finance/fee-structures/${item.feeStructureId}`);
}
