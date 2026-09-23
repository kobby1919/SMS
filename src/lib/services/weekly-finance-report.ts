import prisma from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import { getBursarArrearsFollowUp, type BursarArrearsFollowUp } from "@/src/lib/services/bursar-arrears";
import { getClassCollectionReport } from "@/src/lib/services/class-collection-report";

export type WeeklyMoneyDay = {
  date: Date;
  label: string;
  amount: number;
  paymentCount: number;
};

export type WeeklyClassPerformanceRow = {
  classId: number;
  className: string;
  expected: number;
  collected: number;
  outstanding: number;
  weeklyCollected: number;
  weeklyPaymentCount: number;
  collectionRate: number;
  status: "Healthy" | "Watch" | "Weak" | "Critical";
};

export type WeeklyFinanceSummary = {
  weekStart: Date;
  weekEnd: Date;
  previousWeekStart: Date;
  previousWeekEnd: Date;
  totalCollected: number;
  paymentCount: number;
  previousTotalCollected: number;
  previousPaymentCount: number;
  totalDelta: number;
  paymentDelta: number;
  dailyBreakdown: WeeklyMoneyDay[];
  strongestCollectionDay: WeeklyMoneyDay | null;
  weakestCollectionDay: WeeklyMoneyDay | null;
  classPerformance: WeeklyClassPerformanceRow[];
  topCollectingClasses: WeeklyClassPerformanceRow[];
  weakCollectionClasses: WeeklyClassPerformanceRow[];
  highOutstandingClasses: WeeklyClassPerformanceRow[];
  arrears: BursarArrearsFollowUp;
};

function asNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value ?? 0);
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

export function parseWeeklyReportDate(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function weeklyReportDateInputValue(date: Date) {
  return date.toISOString().split("T")[0];
}

export function weekBounds(date = new Date()) {
  const start = startOfDay(date);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);

  const end = endOfDay(start);
  end.setDate(start.getDate() + 6);

  return { start, end };
}

function previousWeekBounds(weekStart: Date) {
  const start = startOfDay(weekStart);
  start.setDate(start.getDate() - 7);
  const end = endOfDay(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function dayKey(date: Date) {
  return date.toISOString().split("T")[0];
}

function dayLabel(date: Date) {
  return date.toLocaleDateString("en-GH", { weekday: "short", day: "numeric", month: "short" });
}

function sevenDayRows(weekStart: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = startOfDay(weekStart);
    date.setDate(weekStart.getDate() + index);
    return {
      date,
      label: dayLabel(date),
      amount: 0,
      paymentCount: 0,
    } satisfies WeeklyMoneyDay;
  });
}

export async function getWeeklyFinanceSummary(schoolId: string, date = new Date()): Promise<WeeklyFinanceSummary> {
  const currentWeek = weekBounds(date);
  const previousWeek = previousWeekBounds(currentWeek.start);

  const [payments, previousPayments, classReport, arrears] = await Promise.all([
    prisma.payment.findMany({
      where: {
        schoolId,
        status: "CONFIRMED",
        paymentDate: { gte: currentWeek.start, lte: currentWeek.end },
        studentBill: { schoolId, student: { schoolId } },
      },
      select: {
        id: true,
        amount: true,
        paymentDate: true,
        studentBill: {
          select: {
            student: { select: { class: { select: { id: true, name: true } } } },
          },
        },
      },
    }),
    prisma.payment.findMany({
      where: {
        schoolId,
        status: "CONFIRMED",
        paymentDate: { gte: previousWeek.start, lte: previousWeek.end },
        studentBill: { schoolId, student: { schoolId } },
      },
      select: { id: true, amount: true },
    }),
    getClassCollectionReport(schoolId),
    getBursarArrearsFollowUp(schoolId, { asOf: currentWeek.end, limit: 12 }),
  ]);

  const dailyMap = new Map(sevenDayRows(currentWeek.start).map((row) => [dayKey(row.date), row]));
  const weeklyClassMap = new Map<number, { amount: number; count: number }>();

  for (const payment of payments) {
    const amount = asNumber(payment.amount);
    const day = dailyMap.get(dayKey(payment.paymentDate));
    if (day) {
      day.amount += amount;
      day.paymentCount += 1;
    }

    const klass = payment.studentBill.student.class;
    if (klass) {
      const current = weeklyClassMap.get(klass.id) ?? { amount: 0, count: 0 };
      current.amount += amount;
      current.count += 1;
      weeklyClassMap.set(klass.id, current);
    }
  }

  const dailyBreakdown = Array.from(dailyMap.values());
  const daysWithPayments = dailyBreakdown.filter((row) => row.paymentCount > 0);
  const strongestCollectionDay = daysWithPayments.length > 0
    ? [...daysWithPayments].sort((a, b) => b.amount - a.amount || b.paymentCount - a.paymentCount)[0]
    : null;
  const weakestCollectionDay = daysWithPayments.length > 0
    ? [...daysWithPayments].sort((a, b) => a.amount - b.amount || a.paymentCount - b.paymentCount)[0]
    : null;

  const classPerformance = classReport.rows.map((row) => {
    const weekly = weeklyClassMap.get(row.classId) ?? { amount: 0, count: 0 };
    return {
      classId: row.classId,
      className: row.className,
      expected: row.expected,
      collected: row.collected,
      outstanding: row.outstanding,
      weeklyCollected: weekly.amount,
      weeklyPaymentCount: weekly.count,
      collectionRate: row.collectionRate,
      status: row.risk,
    } satisfies WeeklyClassPerformanceRow;
  });

  const topCollectingClasses = [...classPerformance]
    .filter((row) => row.weeklyCollected > 0)
    .sort((a, b) => b.weeklyCollected - a.weeklyCollected || b.weeklyPaymentCount - a.weeklyPaymentCount)
    .slice(0, 5);
  const weakCollectionClasses = [...classPerformance]
    .filter((row) => row.outstanding > 0)
    .sort((a, b) => a.collectionRate - b.collectionRate || b.outstanding - a.outstanding)
    .slice(0, 5);
  const highOutstandingClasses = [...classPerformance]
    .filter((row) => row.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding || a.collectionRate - b.collectionRate)
    .slice(0, 5);

  const totalCollected = payments.reduce((sum, payment) => sum + asNumber(payment.amount), 0);
  const previousTotalCollected = previousPayments.reduce((sum, payment) => sum + asNumber(payment.amount), 0);

  return {
    weekStart: currentWeek.start,
    weekEnd: currentWeek.end,
    previousWeekStart: previousWeek.start,
    previousWeekEnd: previousWeek.end,
    totalCollected,
    paymentCount: payments.length,
    previousTotalCollected,
    previousPaymentCount: previousPayments.length,
    totalDelta: totalCollected - previousTotalCollected,
    paymentDelta: payments.length - previousPayments.length,
    dailyBreakdown,
    strongestCollectionDay,
    weakestCollectionDay,
    classPerformance,
    topCollectingClasses,
    weakCollectionClasses,
    highOutstandingClasses,
    arrears,
  };
}
