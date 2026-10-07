import prisma from "@/src/lib/prisma";
import { Prisma, type DailyCollectionSessionStatus } from "@/src/generated/prisma";

export type DailyCollectionReport = Awaited<ReturnType<typeof getDailyCollectionReport>>;

function asNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value ?? 0);
}

function dayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function fullName(person: { name: string; surname: string }) {
  return `${person.name} ${person.surname}`.trim();
}

function latestSessionFirst<T extends { collectionDate: Date; updatedAt: Date }>(a: T, b: T) {
  return b.collectionDate.getTime() - a.collectionDate.getTime() || b.updatedAt.getTime() - a.updatedAt.getTime();
}

const TRACKED_ENTRY_STATUSES: DailyCollectionSessionStatus[] = ["OPEN", "SUBMITTED", "CONFIRMED", "FLAGGED"];

export async function getDailyCollectionReport(schoolId: string, date = new Date()) {
  const { start, end } = dayBounds(date);

  const [sessions, unpaidEntries] = await Promise.all([
    prisma.dailyCollectionSession.findMany({
      where: {
        schoolId,
        collectionDate: { gte: start, lte: end },
      },
      select: {
        id: true,
        collectionDate: true,
        status: true,
        expectedAmount: true,
        reportedAmount: true,
        confirmedAmount: true,
        mismatchReason: true,
        submittedAt: true,
        confirmedAt: true,
        updatedAt: true,
        collectionType: {
          select: { id: true, name: true, category: true },
        },
        collector: {
          select: { id: true, name: true, surname: true },
        },
        entries: {
          select: {
            id: true,
            status: true,
            amountExpected: true,
            amountCollected: true,
          },
        },
      },
      orderBy: [{ collectionDate: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.dailyCollectionEntry.findMany({
      where: {
        schoolId,
        status: "UNPAID",
        session: {
          collectionDate: { gte: start, lte: end },
          status: { in: TRACKED_ENTRY_STATUSES },
        },
      },
      select: {
        id: true,
        amountExpected: true,
        note: true,
        updatedAt: true,
        session: {
          select: {
            id: true,
            collectionDate: true,
            status: true,
            collectionType: { select: { name: true, category: true } },
            collector: { select: { name: true, surname: true } },
          },
        },
        student: {
          select: {
            id: true,
            admissionNumber: true,
            name: true,
            surname: true,
            status: true,
            class: { select: { id: true, name: true } },
            parentRelationships: {
              where: { schoolId, status: "ACTIVE", canViewFees: true },
              select: {
                role: true,
                parent: {
                  select: { name: true, surname: true, email: true, phone: true },
                },
              },
              orderBy: [{ role: "asc" }, { createdAt: "asc" }],
              take: 1,
            },
          },
        },
      },
      orderBy: [{ session: { collectionDate: "desc" } }, { updatedAt: "desc" }],
      take: 12,
    }),
  ]);

  const byStatus = {
    OPEN: 0,
    SUBMITTED: 0,
    CONFIRMED: 0,
    FLAGGED: 0,
    CANCELLED: 0,
  } satisfies Record<DailyCollectionSessionStatus, number>;

  const summary = {
    expectedAmount: 0,
    reportedAmount: 0,
    confirmedAmount: 0,
    flaggedAmount: 0,
    paidEntries: 0,
    unpaidEntries: 0,
    excusedEntries: 0,
    unpaidAmount: 0,
  };

  const byType = new Map<
    string,
    {
      id: string;
      name: string;
      category: string;
      expectedAmount: number;
      reportedAmount: number;
      confirmedAmount: number;
      flaggedAmount: number;
      paidEntries: number;
      unpaidEntries: number;
      excusedEntries: number;
      sessionCount: number;
      sessionsNeedingReview: number;
    }
  >();

  for (const session of sessions) {
    byStatus[session.status] += 1;
    if (session.status === "CANCELLED") continue;

    const sessionExpected = asNumber(session.expectedAmount);
    const sessionReported = asNumber(session.reportedAmount);
    const sessionConfirmed = session.status === "CONFIRMED" ? asNumber(session.confirmedAmount) : 0;
    const sessionFlagged = session.status === "FLAGGED" ? asNumber(session.confirmedAmount) : 0;

    summary.expectedAmount += sessionExpected;
    summary.reportedAmount += sessionReported;
    summary.confirmedAmount += sessionConfirmed;
    summary.flaggedAmount += sessionFlagged;

    const type = byType.get(session.collectionType.id) ?? {
      id: session.collectionType.id,
      name: session.collectionType.name,
      category: session.collectionType.category,
      expectedAmount: 0,
      reportedAmount: 0,
      confirmedAmount: 0,
      flaggedAmount: 0,
      paidEntries: 0,
      unpaidEntries: 0,
      excusedEntries: 0,
      sessionCount: 0,
      sessionsNeedingReview: 0,
    };

    type.expectedAmount += sessionExpected;
    type.reportedAmount += sessionReported;
    type.confirmedAmount += sessionConfirmed;
    type.flaggedAmount += sessionFlagged;
    type.sessionCount += 1;
    if (session.status === "SUBMITTED" || session.status === "FLAGGED") {
      type.sessionsNeedingReview += 1;
    }

    for (const entry of session.entries) {
      const amountExpected = asNumber(entry.amountExpected);
      if (entry.status === "PAID") {
        summary.paidEntries += 1;
        type.paidEntries += 1;
      } else if (entry.status === "EXCUSED") {
        summary.excusedEntries += 1;
        type.excusedEntries += 1;
      } else {
        summary.unpaidEntries += 1;
        summary.unpaidAmount += amountExpected;
        type.unpaidEntries += 1;
      }
    }

    byType.set(session.collectionType.id, type);
  }

  const sessionsNeedingReview = sessions
    .filter((session) => session.status === "SUBMITTED" || session.status === "FLAGGED")
    .sort(latestSessionFirst)
    .slice(0, 8)
    .map((session) => ({
      id: session.id,
      collectionDate: session.collectionDate,
      status: session.status,
      collectionTypeName: session.collectionType.name,
      collectorName: fullName(session.collector),
      reportedAmount: asNumber(session.reportedAmount),
      confirmedAmount: session.confirmedAmount === null ? null : asNumber(session.confirmedAmount),
      mismatchReason: session.mismatchReason,
    }));

  const unpaidList = unpaidEntries.map((entry) => {
    const relationship = entry.student.parentRelationships[0];
    const parent = relationship?.parent;
    return {
      id: entry.id,
      sessionId: entry.session.id,
      collectionDate: entry.session.collectionDate,
      sessionStatus: entry.session.status,
      collectionTypeName: entry.session.collectionType.name,
      collectionCategory: entry.session.collectionType.category,
      studentId: entry.student.id,
      studentName: fullName(entry.student),
      admissionNumber: entry.student.admissionNumber,
      classId: entry.student.class.id,
      className: entry.student.class.name,
      studentStatus: entry.student.status,
      amountExpected: asNumber(entry.amountExpected),
      collectorName: fullName(entry.session.collector),
      parentContact: parent
        ? {
            name: fullName(parent),
            email: parent.email,
            phone: parent.phone,
          }
        : null,
      note: entry.note,
    };
  });

  return {
    date,
    dayStart: start,
    dayEnd: end,
    sessionCount: sessions.length,
    byStatus,
    summary,
    byType: Array.from(byType.values()).sort((a, b) => b.confirmedAmount - a.confirmedAmount || a.name.localeCompare(b.name)),
    sessionsNeedingReview,
    unpaidList,
    hasActivity: sessions.length > 0,
  };
}
