"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type FeeCategory } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { requireDailyCollectionSetupAccess, requireResourceAccess } from "@/src/lib/authz";
import { parseActionInput } from "@/src/lib/validation/parse";
import {
  dailyCollectionTypeSchema,
  dailyCollectionTypeUpdateSchema,
} from "@/src/lib/validation/finance";
import { stringIdSchema } from "@/src/lib/validation/common";

const DAILY_COLLECTION_SETUP_PATH = "/list/finance/daily-collections";
const DUPLICATE_COLLECTION_SETUP_MESSAGE = "A daily collection setup with this name already exists.";

export type DailyCollectionTypeInput = {
  name: string;
  amount: number;
  category: FeeCategory;
  description?: string | null;
  requiresBursarConfirmation: boolean;
};

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeCollectionTypeKey(name: string) {
  return normalizeName(name).toLocaleLowerCase("en-US");
}

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createDailyCollectionType(input: DailyCollectionTypeInput) {
  const data = parseActionInput(dailyCollectionTypeSchema, input);
  const { userId, schoolId } = await requireDailyCollectionSetupAccess();
  const name = normalizeName(data.name);
  const normalizedName = normalizeCollectionTypeKey(name);

  const duplicate = await prisma.dailyCollectionType.findFirst({
    where: {
      schoolId,
      normalizedName,
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new Error(DUPLICATE_COLLECTION_SETUP_MESSAGE);
  }

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const collectionType = await tx.dailyCollectionType.create({
        data: {
          schoolId,
          name,
          normalizedName,
          amount: roundMoney(data.amount),
          category: data.category,
          description: data.description?.trim() || null,
          requiresBursarConfirmation: data.requiresBursarConfirmation,
          createdBy: userId,
        },
      });

      await tx.dailyCollectionAuditLog.create({
        data: {
          schoolId,
          action: "COLLECTION_TYPE_CREATED",
          performedBy: userId,
          entityType: "DailyCollectionType",
          entityId: collectionType.id,
          collectionTypeId: collectionType.id,
          metadata: {
            name: collectionType.name,
            normalizedName: collectionType.normalizedName,
            amount: Number(collectionType.amount),
            category: collectionType.category,
            requiresBursarConfirmation: collectionType.requiresBursarConfirmation,
          },
        },
      });

      return collectionType;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error(DUPLICATE_COLLECTION_SETUP_MESSAGE);
    }
    throw error;
  }

  revalidatePath(DAILY_COLLECTION_SETUP_PATH);
  return created;
}

export async function updateDailyCollectionType(
  id: string,
  input: Partial<DailyCollectionTypeInput>,
) {
  const collectionTypeId = parseActionInput(stringIdSchema, id);
  const data = parseActionInput(dailyCollectionTypeUpdateSchema, input);
  const context = await requireDailyCollectionSetupAccess();
  const { userId, schoolId } = context;

  const existing = requireResourceAccess(
    await prisma.dailyCollectionType.findFirst({ where: { id: collectionTypeId, schoolId } }),
    context,
    "Daily collection setup not found.",
  );

  const nextName = data.name ? normalizeName(data.name) : undefined;
  const nextNormalizedName = nextName ? normalizeCollectionTypeKey(nextName) : undefined;
  if (nextName) {
    const duplicate = await prisma.dailyCollectionType.findFirst({
      where: {
        schoolId,
        id: { not: existing.id },
        normalizedName: nextNormalizedName,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new Error(DUPLICATE_COLLECTION_SETUP_MESSAGE);
    }
  }

  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const collectionType = await tx.dailyCollectionType.update({
        where: { id: existing.id },
        data: {
          name: nextName,
          normalizedName: nextNormalizedName,
          amount: data.amount === undefined ? undefined : roundMoney(data.amount),
          category: data.category,
          description: data.description === undefined ? undefined : data.description?.trim() || null,
          requiresBursarConfirmation: data.requiresBursarConfirmation,
          updatedBy: userId,
        },
      });

      await tx.dailyCollectionAuditLog.create({
        data: {
          schoolId,
          action: "COLLECTION_TYPE_UPDATED",
          performedBy: userId,
          entityType: "DailyCollectionType",
          entityId: collectionType.id,
          collectionTypeId: collectionType.id,
          metadata: {
            before: {
              name: existing.name,
              normalizedName: existing.normalizedName,
              amount: Number(existing.amount),
              category: existing.category,
              requiresBursarConfirmation: existing.requiresBursarConfirmation,
              isActive: existing.isActive,
            },
            after: {
              name: collectionType.name,
              normalizedName: collectionType.normalizedName,
              amount: Number(collectionType.amount),
              category: collectionType.category,
              requiresBursarConfirmation: collectionType.requiresBursarConfirmation,
              isActive: collectionType.isActive,
            },
          },
        },
      });

      return collectionType;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error(DUPLICATE_COLLECTION_SETUP_MESSAGE);
    }
    throw error;
  }

  revalidatePath(DAILY_COLLECTION_SETUP_PATH);
  return updated;
}

export async function setDailyCollectionTypeActive(id: string, isActive: boolean) {
  const collectionTypeId = parseActionInput(stringIdSchema, id);
  const context = await requireDailyCollectionSetupAccess();
  const { userId, schoolId } = context;

  const existing = requireResourceAccess(
    await prisma.dailyCollectionType.findFirst({ where: { id: collectionTypeId, schoolId } }),
    context,
    "Daily collection setup not found.",
  );

  if (existing.isActive === isActive) {
    return existing;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const collectionType = await tx.dailyCollectionType.update({
      where: { id: existing.id },
      data: { isActive, updatedBy: userId },
    });

    await tx.dailyCollectionAuditLog.create({
      data: {
        schoolId,
        action: isActive ? "COLLECTION_TYPE_REACTIVATED" : "COLLECTION_TYPE_DEACTIVATED",
        performedBy: userId,
        entityType: "DailyCollectionType",
        entityId: collectionType.id,
        collectionTypeId: collectionType.id,
        metadata: {
          name: collectionType.name,
          normalizedName: collectionType.normalizedName,
          amount: Number(collectionType.amount),
          category: collectionType.category,
          previousActiveState: existing.isActive,
          newActiveState: collectionType.isActive,
        },
      },
    });

    return collectionType;
  });

  revalidatePath(DAILY_COLLECTION_SETUP_PATH);
  return updated;
}

export async function assignCollectorToDailyCollectionType(input: {
  collectorId: string;
  collectionTypeId: string;
}) {
  const collectorId = parseActionInput(stringIdSchema, input.collectorId);
  const collectionTypeId = parseActionInput(stringIdSchema, input.collectionTypeId);
  const context = await requireDailyCollectionSetupAccess();
  const { userId, schoolId } = context;

  const [collector, collectionType] = await Promise.all([
    prisma.collector.findFirst({
      where: { id: collectorId, schoolId, status: "ACTIVE" },
      select: { id: true, name: true, surname: true, email: true, schoolId: true },
    }),
    prisma.dailyCollectionType.findFirst({
      where: { id: collectionTypeId, schoolId, isActive: true },
      select: { id: true, name: true, schoolId: true },
    }),
  ]);

  const safeCollector = requireResourceAccess(collector, context, "Active collector not found.");
  const safeCollectionType = requireResourceAccess(collectionType, context, "Active daily collection setup not found.");

  const existingAssignment = await prisma.dailyCollectionTypeCollector.findFirst({
    where: { schoolId, collectorId, collectionTypeId },
    select: { id: true },
  });

  if (existingAssignment) {
    return existingAssignment;
  }

  let assignment;
  try {
    assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.dailyCollectionTypeCollector.create({
        data: {
          schoolId,
          collectorId,
          collectionTypeId,
          assignedBy: userId,
        },
      });

      await tx.dailyCollectionAuditLog.create({
        data: {
          schoolId,
          action: "COLLECTOR_UPDATED",
          performedBy: userId,
          entityType: "DailyCollectionTypeCollector",
          entityId: created.id,
          collectorId,
          collectionTypeId,
          metadata: {
            action: "ASSIGNED_TO_COLLECTION_TYPE",
            collectorName: `${safeCollector.name} ${safeCollector.surname}`.trim(),
            collectorEmail: safeCollector.email,
            collectionTypeName: safeCollectionType.name,
          },
        },
      });

      return created;
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    assignment = await prisma.dailyCollectionTypeCollector.findFirst({
      where: { schoolId, collectorId, collectionTypeId },
      select: { id: true },
    });
    if (!assignment) throw error;
  }

  revalidatePath(DAILY_COLLECTION_SETUP_PATH);
  revalidatePath("/collector");
  return assignment;
}

export async function unassignCollectorFromDailyCollectionType(input: {
  collectorId: string;
  collectionTypeId: string;
}) {
  const collectorId = parseActionInput(stringIdSchema, input.collectorId);
  const collectionTypeId = parseActionInput(stringIdSchema, input.collectionTypeId);
  const context = await requireDailyCollectionSetupAccess();
  const { userId, schoolId } = context;

  const assignment = requireResourceAccess(
    await prisma.dailyCollectionTypeCollector.findFirst({
      where: { collectorId, collectionTypeId, schoolId },
      include: {
        collector: { select: { name: true, surname: true, email: true } },
        collectionType: { select: { name: true } },
      },
    }),
    context,
    "Collector assignment not found.",
  );

  const hasOpenOrSubmittedSession = await prisma.dailyCollectionSession.findFirst({
    where: {
      schoolId,
      collectorId,
      collectionTypeId,
      status: { in: ["OPEN", "SUBMITTED"] },
    },
    select: { id: true },
  });

  if (hasOpenOrSubmittedSession) {
    throw new Error("Resolve open or submitted sessions before removing this collector assignment.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.dailyCollectionTypeCollector.delete({
      where: { id: assignment.id },
    });

    await tx.dailyCollectionAuditLog.create({
      data: {
        schoolId,
        action: "COLLECTOR_UPDATED",
        performedBy: userId,
        entityType: "DailyCollectionTypeCollector",
        entityId: assignment.id,
        collectorId,
        collectionTypeId,
        metadata: {
          action: "UNASSIGNED_FROM_COLLECTION_TYPE",
          collectorName: `${assignment.collector.name} ${assignment.collector.surname}`.trim(),
          collectorEmail: assignment.collector.email,
          collectionTypeName: assignment.collectionType.name,
        },
      },
    });
  });

  revalidatePath(DAILY_COLLECTION_SETUP_PATH);
  revalidatePath("/collector");
  return { ok: true };
}
