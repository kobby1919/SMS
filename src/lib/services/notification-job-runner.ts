import prisma from "@/src/lib/prisma";
import { processPendingNotificationDeliveries } from "@/src/lib/services/app-notifications";

export type NotificationWorkerRunInput = {
  schoolId?: string;
  limit?: number;
  schoolLimit?: number;
  now?: Date;
};

function cleanOptionalText(value?: string | null) {
  const cleaned = value?.trim();
  return cleaned || null;
}

function clampLimit(value: number | undefined, fallback: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value ?? fallback), 1), max);
}

async function schoolsWithDueDeliveries(input: {
  schoolId?: string;
  schoolLimit: number;
  now: Date;
}) {
  const groups = await prisma.appNotificationDelivery.groupBy({
    by: ["schoolId"],
    where: {
      schoolId: input.schoolId,
      status: { in: ["PENDING", "RETRYING"] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: input.now } }],
    },
    orderBy: { schoolId: "asc" },
    take: input.schoolLimit,
  });

  return groups.map((group) => group.schoolId);
}

export async function runNotificationDeliveryWorker(input: NotificationWorkerRunInput = {}) {
  const now = input.now ?? new Date();
  const limit = clampLimit(input.limit, 25, 100);
  const schoolLimit = clampLimit(input.schoolLimit, 10, 100);
  const schoolId = cleanOptionalText(input.schoolId);
  const schoolIds = await schoolsWithDueDeliveries({ schoolId: schoolId ?? undefined, schoolLimit, now });
  const results = [];

  for (const dueSchoolId of schoolIds) {
    const schoolResults = await processPendingNotificationDeliveries(
      {
        schoolId: dueSchoolId,
        limit,
        now,
      },
      prisma,
    );

    results.push({
      schoolId: dueSchoolId,
      processed: schoolResults.length,
    });
  }

  return {
    processedSchools: results.length,
    processedDeliveries: results.reduce((total, item) => total + item.processed, 0),
    results,
  };
}