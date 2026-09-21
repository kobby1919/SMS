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

export async function getBursarMoneyPulse(schoolId: string, date = new Date()) {
  const { start, end } = dayBounds(date);
  const weekStart = new Date(start);
  weekStart.setDate(weekStart.getDate() - 7);

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
    classes,
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
        paymentDate: { gte: start, lte: end },
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
        action: { in: ["DISCOUNT_APPLIED", "DISCOUNT_REMOVED", "PAYMENT_REVERSED"] },
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
    prisma.class.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        students: {
          select: {
            bills: {
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
                  select: {
                    amount: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.payment.findMany({
      where: {
        schoolId,
        paymentDate: { gte: start, lte: end },
      },
      select: {
        id: true,
        receiptNumber: true,
        amount: true,
        status: true,
        paymentMethod: true,
        paymentDate: true,
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
      orderBy: { paymentDate: "desc" },
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

  const lowCollectionClasses = classes
    .map((klass) => {
      const bills = klass.students.flatMap((student) => student.bills);
      const expected = bills.reduce(
        (sum, bill) => sum + asNumber(bill.totalAmount) - asNumber(bill.discountAmount),
        0,
      );
      const collected = bills.reduce((sum, bill) => sum + asNumber(bill.amountPaid), 0);
      const outstanding = bills.reduce((sum, bill) => sum + asNumber(bill.balance), 0);
      const collectedToday = bills.reduce(
        (sum, bill) => sum + bill.payments.reduce((paymentSum, payment) => paymentSum + asNumber(payment.amount), 0),
        0,
      );
      const unpaidBills = bills.filter((bill) => bill.status === "UNPAID" || bill.status === "PARTIAL").length;

      return {
        classId: klass.id,
        className: klass.name,
        expected,
        collected,
        outstanding,
        collectedToday,
        unpaidBills,
        collectionRate: collectionRate(collected, expected),
      };
    })
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
    pendingConfirmations.length === 0 &&
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
    urgentIssues,
    urgentIssueCount: urgentIssues.length,
    recentPayments,
  };
}

