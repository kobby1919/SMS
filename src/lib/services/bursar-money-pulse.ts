import prisma from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma";

export type BursarMoneyPulse = Awaited<ReturnType<typeof getBursarMoneyPulse>>;

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

function collectionRate(collected: number, expected: number) {
  if (expected <= 0) return 0;
  return Math.min(100, Math.round((collected / expected) * 100));
}

function classSortKey(name: string) {
  const normalized = name.trim().toLowerCase();
  if (normalized.includes("nursery")) return 10;
  if (normalized.includes("kg") || normalized.includes("kindergarten")) {
    const match = normalized.match(/\d+/);
    return 20 + Number(match?.[0] ?? 0);
  }
  if (normalized.includes("class")) {
    const match = normalized.match(/\d+/);
    return 40 + Number(match?.[0] ?? 0);
  }
  if (normalized.includes("jhs")) {
    const match = normalized.match(/\d+/);
    return 70 + Number(match?.[0] ?? 0);
  }
  return 999;
}

export async function getBursarMoneyPulse(schoolId: string, date = new Date()) {
  const { start, end } = dayBounds(date);

  const [
    todayByMethod,
    pendingConfirmationCount,
    pendingConfirmations,
    receiptsIssuedToday,
    reversalsToday,
    correctionAuditsToday,
    openFinanceQueries,
    overpaidBills,
    highOutstandingBills,
    classBills,
    recentPayments,
  ] = await Promise.all([
    prisma.payment.groupBy({
      by: ["paymentMethod"],
      where: {
        schoolId,
        status: "CONFIRMED",
        paymentDate: { gte: start, lte: end },
      },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.payment.count({
      where: {
        schoolId,
        status: "PENDING",
      },
    }),
    prisma.payment.findMany({
      where: {
        schoolId,
        status: "PENDING",
      },
      select: {
        id: true,
        receiptNumber: true,
        amount: true,
        paymentMethod: true,
        paidBy: true,
        referenceNo: true,
        paymentDate: true,
        studentBill: {
          select: {
            student: {
              select: {
                name: true,
                surname: true,
                class: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { paymentDate: "asc" },
      take: 5,
    }),
    prisma.payment.count({
      where: {
        schoolId,
        status: "CONFIRMED",
        createdAt: { gte: start, lte: end },
      },
    }),
    prisma.paymentReversal.findMany({
      where: {
        schoolId,
        reversedAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        reason: true,
        reversedAt: true,
        payment: {
          select: {
            id: true,
            receiptNumber: true,
            amount: true,
            studentBill: {
              select: {
                student: {
                  select: {
                    name: true,
                    surname: true,
                    class: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { reversedAt: "desc" },
      take: 5,
    }),
    prisma.financeAuditLog.findMany({
      where: {
        schoolId,
        action: { in: ["DISCOUNT_APPLIED", "DISCOUNT_REMOVED"] },
        createdAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.financeQuery.findMany({
      where: {
        schoolId,
        status: { in: ["OPEN", "IN_REVIEW"] },
      },
      select: {
        id: true,
        reason: true,
        status: true,
        createdAt: true,
        student: {
          select: {
            name: true,
            surname: true,
            class: { select: { name: true } },
          },
        },
        studentBill: {
          select: {
            id: true,
            balance: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      take: 6,
    }),
    prisma.studentBill.findMany({
      where: {
        schoolId,
        status: "OVERPAID",
      },
      select: {
        id: true,
        balance: true,
        student: {
          select: {
            name: true,
            surname: true,
            class: { select: { name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.studentBill.findMany({
      where: {
        schoolId,
        status: { in: ["UNPAID", "PARTIAL"] },
      },
      select: {
        id: true,
        balance: true,
        status: true,
        student: {
          select: {
            name: true,
            surname: true,
            class: { select: { name: true } },
          },
        },
      },
      orderBy: { balance: "desc" },
      take: 5,
    }),
    prisma.studentBill.findMany({
      where: { schoolId },
      select: {
        totalAmount: true,
        amountPaid: true,
        discountAmount: true,
        balance: true,
        status: true,
        payments: {
          where: {
            status: "CONFIRMED",
            paymentDate: { gte: start, lte: end },
          },
          select: { amount: true },
        },
        student: {
          select: {
            class: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.payment.findMany({
      where: {
        schoolId,
        createdAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        receiptNumber: true,
        amount: true,
        status: true,
        paymentMethod: true,
        paymentDate: true,
        createdAt: true,
        paidBy: true,
        studentBill: {
          select: {
            student: {
              select: {
                name: true,
                surname: true,
                class: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const paymentsReceivedToday = todayByMethod.reduce((sum, row) => sum + row._count._all, 0);
  const amountReceivedToday = todayByMethod.reduce(
    (sum, row) => sum + asNumber(row._sum.amount),
    0,
  );
  const methodBreakdown = todayByMethod.map((row) => ({
    method: row.paymentMethod,
    count: row._count._all,
    amount: asNumber(row._sum.amount),
  }));

  const classCollectionMap = new Map<
    number,
    {
      classId: number;
      className: string;
      expected: number;
      collected: number;
      outstanding: number;
      collectedToday: number;
      billCount: number;
      paidBills: number;
      unpaidBills: number;
    }
  >();

  for (const bill of classBills) {
    const klass = bill.student.class;
    if (!klass) continue;

    const current = classCollectionMap.get(klass.id) ?? {
      classId: klass.id,
      className: klass.name,
      expected: 0,
      collected: 0,
      outstanding: 0,
      collectedToday: 0,
      billCount: 0,
      paidBills: 0,
      unpaidBills: 0,
    };

    current.expected += Math.max(0, asNumber(bill.totalAmount) - asNumber(bill.discountAmount));
    current.collected += Math.max(0, asNumber(bill.amountPaid));
    current.outstanding += Math.max(0, asNumber(bill.balance));
    current.collectedToday += bill.payments.reduce((sum, payment) => sum + asNumber(payment.amount), 0);
    current.billCount += 1;
    if (bill.status === "PAID" || bill.status === "OVERPAID") current.paidBills += 1;
    if (bill.status === "UNPAID" || bill.status === "PARTIAL") current.unpaidBills += 1;

    classCollectionMap.set(klass.id, current);
  }

  const collectionByClass = Array.from(classCollectionMap.values())
    .map((item) => ({
      ...item,
      collectionRate: collectionRate(item.collected, item.expected),
    }))
    .filter((item) => item.expected > 0 || item.billCount > 0)
    .sort((a, b) => classSortKey(a.className) - classSortKey(b.className) || a.className.localeCompare(b.className));

  const lowCollectionClasses = collectionByClass
    .filter((item) => item.expected > 0 && item.outstanding > 0)
    .sort((a, b) => a.collectionRate - b.collectionRate || b.outstanding - a.outstanding)
    .slice(0, 5);

  const urgentIssues = [
    ...openFinanceQueries.map((query) => ({
      id: `query-${query.id}`,
      type: "query" as const,
      title: `${query.student.name} ${query.student.surname}`.trim(),
      detail: `${query.reason.replaceAll("_", " ").toLowerCase()} · ${query.status.replaceAll("_", " ").toLowerCase()}`,
      className: query.student.class?.name ?? "No class",
      href: `/list/finance/bills/${query.studentBill.id}`,
      amount: asNumber(query.studentBill.balance),
      createdAt: query.createdAt,
    })),
    ...overpaidBills.map((bill) => ({
      id: `overpaid-${bill.id}`,
      type: "overpaid" as const,
      title: `${bill.student.name} ${bill.student.surname}`.trim(),
      detail: "Overpaid bill needs review",
      className: bill.student.class?.name ?? "No class",
      href: `/list/finance/bills/${bill.id}`,
      amount: asNumber(bill.balance),
      createdAt: null,
    })),
    ...highOutstandingBills.map((bill) => ({
      id: `bill-${bill.id}`,
      type: "outstanding" as const,
      title: `${bill.student.name} ${bill.student.surname}`.trim(),
      detail: `${bill.status.toLowerCase()} bill with high balance`,
      className: bill.student.class?.name ?? "No class",
      href: `/list/finance/bills/${bill.id}`,
      amount: asNumber(bill.balance),
      createdAt: null,
    })),
  ].slice(0, 8);

  const quietFinanceDay =
    paymentsReceivedToday === 0 &&
    pendingConfirmationCount === 0 &&
    reversalsToday.length === 0 &&
    openFinanceQueries.length === 0;

  return {
    date,
    dayStart: start,
    dayEnd: end,
    isWeekend: [0, 6].includes(date.getDay()),
    quietFinanceDay,
    paymentsReceivedToday,
    amountReceivedToday,
    methodBreakdown,
    pendingConfirmations,
    pendingConfirmationCount,
    receiptsIssuedToday,
    reversalsToday,
    reversalCountToday: reversalsToday.length,
    correctionAuditsToday,
    correctionCountToday: correctionAuditsToday.length,
    lowCollectionClasses,
    collectionByClass,
    urgentIssues,
    urgentIssueCount: urgentIssues.length,
    recentPayments,
  };
}
