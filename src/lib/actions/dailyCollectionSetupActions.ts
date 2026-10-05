"use server";

import { revalidatePath } from "next/cache";
import type { DailyCollectionAuditAction, FeeCategory, Prisma } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { requireDailyCollectionSetupAccess, requireResourceAccess } from "@/src/lib/authz";
import { parseActionInput } from "@/src/lib/validation/parse";
import {
  dailyCollectionTypeSchema,
  dailyCollectionTypeUpdateSchema,
} from "@/src/lib/validation/finance";
import { stringIdSchema } from "@/src/lib/validation/common";

const DAILY_COLLECTION_SETUP_PATH = "/list/finance/daily-collections";

export type DailyCollectionTypeInput = {
  name: string;
  amount: number;
  category: FeeCategory;
  description?: string | null;
  requiresBursarConfirmation: boolean;
};

async function writeDailyCollectionAudit(input: {
  schoolId: string;
  action: DailyCollectionAuditAction;
  performedBy: string;
  entityType: string;
  entityId: string;
  collectionTypeId?: string | null;
  collectorId?: string | null;
  metadata: Prisma.InputJsonValue;
}) {
  await prisma.dailyCollectionAuditLog.create({
    data: {
      schoolId: input.schoolId,
      action: input.action,
      performedBy: input.performedBy,
      entityType: input.entityType,
      entityId: input.entityId,
      collectionTypeId: input.collectionTypeId ?? null,
      collectorId: input.collectorId ?? null,
      metadata: input.metadata,
    },
  });
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export async function createDailyCollectionType(input: DailyCollectionTypeInput) {
  const data = parseActionInput(dailyCollectionTypeSchema, input);
  const { userId, schoolId } = await requireDailyCollectionSetupAccess();
  const name = normalizeName(data.name);

  const duplicate = await prisma.dailyCollectionType.findFirst({
    where: {
      schoolId,
      name: { equals: name, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new Error("A daily collection setup with this name already exists.");
  }

  const created = await prisma.dailyCollectionType.create({
    data: {
      schoolId,
      name,
      amount: data.amount,
      category: data.category,
      description: data.description?.trim() || null,
      requiresBursarConfirmation: data.requiresBursarConfirmation,
      createdBy: userId,
    },
  });

  await writeDailyCollectionAudit({
    schoolId,
    action: "COLLECTION_TYPE_CREATED",
    performedBy: userId,
    entityType: "DailyCollectionType",
    entityId: created.id,
    collectionTypeId: created.id,
    metadata: {
      name: created.name,
      amount: Number(created.amount),
      category: created.category,
      requiresBursarConfirmation: created.requiresBursarConfirmation,
    },
  });

  revalidatePath(DAILY_COLLECTION_SETUP_PATH);
  return created;
}

export async function updateDailyCollectionType(
  id: string,
  input: Partial<DailyCollectionTypeInput>,
) {
  const collectionTypeId = parseActionInput(stringIdSchema, id);
  const data = parseActionInput(dailyCollectionTypeUpdateSchema, input);
  const { userId, schoolId } = await requireDailyCollectionSetupAccess();

  const existing = requireResourceAccess(
    await prisma.dailyCollectionType.findFirst({ where: { id: collectionTypeId, schoolId } }),
    { userId, schoolId, role: "admin" },
    "Daily collection setup not found.",
  );

  const nextName = data.name ? normalizeName(data.name) : undefined;
  if (nextName) {
    const duplicate = await prisma.dailyCollectionType.findFirst({
      where: {
        schoolId,
        id: { not: existing.id },
        name: { equals: nextName, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new Error("A daily collection setup with this name already exists.");
    }
  }

  const updated = await prisma.dailyCollectionType.update({
    where: { id: existing.id },
    data: {
      name: nextName,
      amount: data.amount,
      category: data.category,
      description: data.description === undefined ? undefined : data.description?.trim() || null,
      requiresBursarConfirmation: data.requiresBursarConfirmation,
      updatedBy: userId,
    },
  });

  await writeDailyCollectionAudit({
    schoolId,
    action: "COLLECTION_TYPE_UPDATED",
    performedBy: userId,
    entityType: "DailyCollectionType",
    entityId: updated.id,
    collectionTypeId: updated.id,
    metadata: {
      before: {
        name: existing.name,
        amount: Number(existing.amount),
        category: existing.category,
        requiresBursarConfirmation: existing.requiresBursarConfirmation,
        isActive: existing.isActive,
      },
      after: {
        name: updated.name,
        amount: Number(updated.amount),
        category: updated.category,
        requiresBursarConfirmation: updated.requiresBursarConfirmation,
        isActive: updated.isActive,
      },
    },
  });

  revalidatePath(DAILY_COLLECTION_SETUP_PATH);
  return updated;
}

export async function setDailyCollectionTypeActive(id: string, isActive: boolean) {
  const collectionTypeId = parseActionInput(stringIdSchema, id);
  const { userId, schoolId } = await requireDailyCollectionSetupAccess();

  const existing = requireResourceAccess(
    await prisma.dailyCollectionType.findFirst({ where: { id: collectionTypeId, schoolId } }),
    { userId, schoolId, role: "admin" },
    "Daily collection setup not found.",
  );

  if (existing.isActive === isActive) {
    return existing;
  }

  const updated = await prisma.dailyCollectionType.update({
    where: { id: existing.id },
    data: { isActive, updatedBy: userId },
  });

  await writeDailyCollectionAudit({
    schoolId,
    action: isActive ? "COLLECTION_TYPE_REACTIVATED" : "COLLECTION_TYPE_DEACTIVATED",
    performedBy: userId,
    entityType: "DailyCollectionType",
    entityId: updated.id,
    collectionTypeId: updated.id,
    metadata: {
      name: updated.name,
      amount: Number(updated.amount),
      category: updated.category,
      previousActiveState: existing.isActive,
      newActiveState: updated.isActive,
    },
  });

  revalidatePath(DAILY_COLLECTION_SETUP_PATH);
  return updated;
}
