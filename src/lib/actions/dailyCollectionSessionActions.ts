"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type DailyCollectionEntryStatus } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import {
  requireDailyCollectionAccess,
  requireDailyCollectionSetupAccess,
  requireResourceAccess,
} from "@/src/lib/authz";
import { parseActionInput } from "@/src/lib/validation/parse";
import {
  dailyCollectionConfirmSessionSchema,
  dailyCollectionFlagSessionSchema,
  dailyCollectionMarkEntrySchema,
  dailyCollectionOpenSessionSchema,
  dailyCollectionSubmitSessionSchema,
} from "@/src/lib/validation/finance";
import { revalidateDashboard } from "@/src/lib/cacheTags";

const COLLECTOR_PATH = "/collector";
const DAILY_COLLECTIONS_PATH = "/list/finance/daily-collections";

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeCollectionDate(dateKey = todayDateKey()) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Use a valid collection date.");
  }

  const today = new Date(`${todayDateKey()}T12:00:00.000Z`);
  if (date > today) {
    throw new Error("Daily collection sessions cannot be opened for a future date.");
  }

  return date;
}

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

function isPrismaErrorCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

async function getActiveCollectorOrThrow(userId: string, schoolId: string) {
  const collector = await prisma.collector.findFirst({
    where: { id: userId, schoolId, status: "ACTIVE" },
    select: { id: true, name: true, surname: true, schoolId: true },
  });

  if (!collector) {
    throw new Error("Collector access is not active.");
  }

  return collector;
}

export async function openDailyCollectionSession(input: {
  collectionTypeId: string;
  collectionDate?: string;
}) {
  const data = parseActionInput(dailyCollectionOpenSessionSchema, input);
  const context = await requireDailyCollectionAccess();
  const { userId, schoolId, role } = context;

  if (role !== "collector") {
    throw new Error("Only the assigned collector can open a daily collection session.");
  }

  const collector = await getActiveCollectorOrThrow(userId, schoolId);
  const collectionDate = normalizeCollectionDate(data.collectionDate);

  const assignment = await prisma.dailyCollectionTypeCollector.findFirst({
    where: {
      schoolId,
      collectorId: collector.id,
      collectionTypeId: data.collectionTypeId,
      collectionType: { isActive: true, schoolId },
    },
    include: { collectionType: true },
  });

  if (!assignment) {
    throw new Error("This daily collection setup is not assigned to you or is inactive.");
  }

  const activeStudents = await prisma.student.findMany({
    where: { schoolId, status: "ACTIVE" },
    select: { id: true },
    orderBy: [{ classId: "asc" }, { surname: "asc" }, { name: "asc" }],
  });

  if (activeStudents.length === 0) {
    throw new Error("No active students were found for today's collection session.");
  }

  const amountPerStudent = new Prisma.Decimal(assignment.collectionType.amount);
  const expectedAmount = amountPerStudent.mul(activeStudents.length);
  let sessionId: string | null = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const session = await prisma.$transaction(async (tx) => {
        const existing = await tx.dailyCollectionSession.findUnique({
          where: {
            schoolId_collectionTypeId_collectorId_collectionDate: {
              schoolId,
              collectionTypeId: assignment.collectionTypeId,
              collectorId: collector.id,
              collectionDate,
            },
          },
        });

        if (existing) return existing;

        const created = await tx.dailyCollectionSession.create({
          data: {
            schoolId,
            collectorId: collector.id,
            collectionTypeId: assignment.collectionTypeId,
            collectionDate,
            expectedAmount,
            reportedAmount: 0,
          },
        });

        await tx.dailyCollectionEntry.createMany({
          data: activeStudents.map((student) => ({
            schoolId,
            sessionId: created.id,
            studentId: student.id,
            collectorId: collector.id,
            status: "UNPAID",
            amountExpected: amountPerStudent,
            amountCollected: 0,
          })),
          skipDuplicates: true,
        });

        await tx.dailyCollectionAuditLog.create({
          data: {
            schoolId,
            action: "SESSION_OPENED",
            performedBy: userId,
            entityType: "DailyCollectionSession",
            entityId: created.id,
            collectorId: collector.id,
            collectionTypeId: assignment.collectionTypeId,
            metadata: {
              collectionDate: collectionDate.toISOString().slice(0, 10),
              collectionTypeName: assignment.collectionType.name,
              studentCount: activeStudents.length,
              expectedAmount: expectedAmount.toNumber(),
            },
          },
        });

        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      sessionId = session.id;
      break;
    } catch (error) {
      if (isPrismaErrorCode(error, "P2002") || isPrismaErrorCode(error, "P2034")) {
        if (attempt === 1) continue;
      }
      throw error;
    }
  }

  if (!sessionId) {
    throw new Error("Could not open the daily collection session safely. Please try again.");
  }

  revalidatePath(COLLECTOR_PATH);
  revalidatePath(DAILY_COLLECTIONS_PATH);
  return { id: sessionId };
}

export async function markDailyCollectionEntry(input: {
  entryId: string;
  status: DailyCollectionEntryStatus;
  note?: string | null;
}) {
  const data = parseActionInput(dailyCollectionMarkEntrySchema, input);
  const context = await requireDailyCollectionAccess();
  const { userId, schoolId, role } = context;

  if (role !== "collector") {
    throw new Error("Only the assigned collector can mark daily collection entries.");
  }

  const collector = await getActiveCollectorOrThrow(userId, schoolId);
  const entry = requireResourceAccess(
    await prisma.dailyCollectionEntry.findFirst({
      where: { id: data.entryId, schoolId, collectorId: collector.id },
      include: {
        session: {
          select: {
            id: true,
            status: true,
            collectionTypeId: true,
            collectionDate: true,
            collectionType: { select: { name: true } },
          },
        },
        student: { select: { name: true, surname: true } },
      },
    }),
    context,
    "Daily collection entry not found.",
  );

  if (entry.session.status !== "OPEN") {
    throw new Error("This session is locked. Entries can only be marked while the session is open.");
  }

  const amountCollected = data.status === "PAID" ? entry.amountExpected : new Prisma.Decimal(0);
  const note = data.note?.trim() || null;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.dailyCollectionEntry.update({
      where: { id: entry.id },
      data: {
        status: data.status,
        amountCollected,
        note,
        markedAt: new Date(),
        markedBy: userId,
      },
    });

    await tx.dailyCollectionAuditLog.create({
      data: {
        schoolId,
        action: "ENTRY_MARKED",
        performedBy: userId,
        entityType: "DailyCollectionEntry",
        entityId: updated.id,
        collectorId: collector.id,
        collectionTypeId: entry.session.collectionTypeId,
        metadata: {
          sessionId: entry.session.id,
          collectionDate: entry.session.collectionDate.toISOString().slice(0, 10),
          collectionTypeName: entry.session.collectionType.name,
          studentName: `${entry.student.name} ${entry.student.surname}`,
          previousStatus: entry.status,
          newStatus: updated.status,
          amountCollected: Number(updated.amountCollected),
          note,
        },
      },
    });
  });

  revalidatePath(COLLECTOR_PATH);
  return { ok: true };
}

export async function submitDailyCollectionSession(input: { sessionId: string }) {
  const data = parseActionInput(dailyCollectionSubmitSessionSchema, input);
  const context = await requireDailyCollectionAccess();
  const { userId, schoolId, role } = context;

  if (role !== "collector") {
    throw new Error("Only the assigned collector can submit a daily collection session.");
  }

  const collector = await getActiveCollectorOrThrow(userId, schoolId);

  await prisma.$transaction(async (tx) => {
    const session = await tx.dailyCollectionSession.findFirst({
      where: { id: data.sessionId, schoolId, collectorId: collector.id },
      include: { entries: true, collectionType: { select: { id: true, name: true } } },
    });

    const safeSession = requireResourceAccess(session, context, "Daily collection session not found.");

    if (safeSession.status !== "OPEN") {
      throw new Error("Only open sessions can be submitted.");
    }

    if (safeSession.entries.length === 0) {
      throw new Error("This session has no student entries to submit.");
    }

    const reportedAmount = safeSession.entries.reduce(
      (sum, entry) => sum.add(entry.amountCollected),
      new Prisma.Decimal(0),
    );
    const paidCount = safeSession.entries.filter((entry) => entry.status === "PAID").length;
    const unpaidCount = safeSession.entries.filter((entry) => entry.status === "UNPAID").length;
    const excusedCount = safeSession.entries.filter((entry) => entry.status === "EXCUSED").length;

    const submitted = await tx.dailyCollectionSession.update({
      where: { id: safeSession.id },
      data: {
        status: "SUBMITTED",
        reportedAmount,
        submittedAt: new Date(),
      },
    });

    await tx.dailyCollectionAuditLog.create({
      data: {
        schoolId,
        action: "SESSION_SUBMITTED",
        performedBy: userId,
        entityType: "DailyCollectionSession",
        entityId: submitted.id,
        collectorId: collector.id,
        collectionTypeId: safeSession.collectionTypeId,
        metadata: {
          collectionTypeName: safeSession.collectionType.name,
          collectionDate: safeSession.collectionDate.toISOString().slice(0, 10),
          expectedAmount: Number(safeSession.expectedAmount),
          reportedAmount: reportedAmount.toNumber(),
          paidCount,
          unpaidCount,
          excusedCount,
        },
      },
    });
  });

  revalidatePath(COLLECTOR_PATH);
  revalidatePath(DAILY_COLLECTIONS_PATH);
  return { ok: true };
}

export async function confirmDailyCollectionSession(input: {
  sessionId: string;
  amountReceived: number;
}) {
  const data = parseActionInput(dailyCollectionConfirmSessionSchema, input);
  const context = await requireDailyCollectionSetupAccess();
  const { userId, schoolId } = context;
  const amountReceived = new Prisma.Decimal(roundMoney(data.amountReceived));

  await prisma.$transaction(async (tx) => {
    const session = requireResourceAccess(
      await tx.dailyCollectionSession.findFirst({
        where: { id: data.sessionId, schoolId },
        include: { collectionType: { select: { id: true, name: true } }, collector: { select: { id: true, name: true, surname: true } } },
      }),
      context,
      "Daily collection session not found.",
    );

    if (session.status !== "SUBMITTED") {
      throw new Error("Only submitted sessions can be confirmed.");
    }

    if (!amountReceived.equals(session.reportedAmount)) {
      throw new Error("Amount received does not match the collector's submitted total. Flag the session as a mismatch instead.");
    }

    const confirmed = await tx.dailyCollectionSession.update({
      where: { id: session.id },
      data: {
        status: "CONFIRMED",
        confirmedAmount: amountReceived,
        confirmedAt: new Date(),
        confirmedBy: userId,
      },
    });

    await tx.dailyCollectionAuditLog.create({
      data: {
        schoolId,
        action: "SESSION_CONFIRMED",
        performedBy: userId,
        entityType: "DailyCollectionSession",
        entityId: confirmed.id,
        collectorId: session.collectorId,
        collectionTypeId: session.collectionTypeId,
        metadata: {
          collectionTypeName: session.collectionType.name,
          collectorName: `${session.collector.name} ${session.collector.surname}`,
          collectionDate: session.collectionDate.toISOString().slice(0, 10),
          reportedAmount: Number(session.reportedAmount),
          confirmedAmount: amountReceived.toNumber(),
        },
      },
    });
  });

  revalidatePath(DAILY_COLLECTIONS_PATH);
  revalidatePath(COLLECTOR_PATH);
  revalidateDashboard(schoolId);
  return { ok: true };
}

export async function flagDailyCollectionSession(input: {
  sessionId: string;
  amountReceived: number;
  reason: string;
}) {
  const data = parseActionInput(dailyCollectionFlagSessionSchema, input);
  const context = await requireDailyCollectionSetupAccess();
  const { userId, schoolId } = context;
  const amountReceived = new Prisma.Decimal(roundMoney(data.amountReceived));

  await prisma.$transaction(async (tx) => {
    const session = requireResourceAccess(
      await tx.dailyCollectionSession.findFirst({
        where: { id: data.sessionId, schoolId },
        include: { collectionType: { select: { id: true, name: true } }, collector: { select: { id: true, name: true, surname: true } } },
      }),
      context,
      "Daily collection session not found.",
    );

    if (session.status !== "SUBMITTED") {
      throw new Error("Only submitted sessions can be flagged for mismatch.");
    }

    const flagged = await tx.dailyCollectionSession.update({
      where: { id: session.id },
      data: {
        status: "FLAGGED",
        confirmedAmount: amountReceived,
        confirmedAt: new Date(),
        confirmedBy: userId,
        mismatchReason: data.reason.trim(),
      },
    });

    await tx.dailyCollectionAuditLog.create({
      data: {
        schoolId,
        action: "SESSION_FLAGGED",
        performedBy: userId,
        entityType: "DailyCollectionSession",
        entityId: flagged.id,
        collectorId: session.collectorId,
        collectionTypeId: session.collectionTypeId,
        metadata: {
          collectionTypeName: session.collectionType.name,
          collectorName: `${session.collector.name} ${session.collector.surname}`,
          collectionDate: session.collectionDate.toISOString().slice(0, 10),
          reportedAmount: Number(session.reportedAmount),
          amountReceived: amountReceived.toNumber(),
          mismatchReason: data.reason.trim(),
        },
      },
    });
  });

  revalidatePath(DAILY_COLLECTIONS_PATH);
  revalidatePath(COLLECTOR_PATH);
  revalidateDashboard(schoolId);
  return { ok: true };
}
