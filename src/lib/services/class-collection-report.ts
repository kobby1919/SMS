import prisma from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma";

export type ClassCollectionReportRow = {
  classId: number;
  className: string;
  expected: number;
  collected: number;
  outstanding: number;
  discountAmount: number;
  billCount: number;
  paidBills: number;
  partialBills: number;
  unpaidBills: number;
  waivedBills: number;
  studentCount: number;
  collectionRate: number;
  risk: "Healthy" | "Watch" | "Weak" | "Critical";
};

export type ClassCollectionReport = {
  expected: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
  totalClasses: number;
  weakClassCount: number;
  rows: ClassCollectionReportRow[];
};

function asNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value ?? 0);
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

function riskFor(rate: number, outstanding: number): ClassCollectionReportRow["risk"] {
  if (outstanding <= 0 || rate >= 85) return "Healthy";
  if (rate >= 65) return "Watch";
  if (rate >= 40) return "Weak";
  return "Critical";
}

export async function getClassCollectionReport(schoolId: string): Promise<ClassCollectionReport> {
  const bills = await prisma.studentBill.findMany({
    where: {
      schoolId,
      student: { schoolId },
      feeStructure: { schoolId },
    },
    select: {
      totalAmount: true,
      amountPaid: true,
      discountAmount: true,
      balance: true,
      status: true,
      studentId: true,
      student: {
        select: {
          class: { select: { id: true, name: true } },
        },
      },
    },
  });

  const classMap = new Map<number, {
    classId: number;
    className: string;
    expected: number;
    collected: number;
    outstanding: number;
    discountAmount: number;
    billCount: number;
    paidBills: number;
    partialBills: number;
    unpaidBills: number;
    waivedBills: number;
    studentIds: Set<string>;
  }>();

  for (const bill of bills) {
    const klass = bill.student.class;
    if (!klass) continue;

    const current = classMap.get(klass.id) ?? {
      classId: klass.id,
      className: klass.name,
      expected: 0,
      collected: 0,
      outstanding: 0,
      discountAmount: 0,
      billCount: 0,
      paidBills: 0,
      partialBills: 0,
      unpaidBills: 0,
      waivedBills: 0,
      studentIds: new Set<string>(),
    };

    const discount = Math.max(0, asNumber(bill.discountAmount));
    const expected = Math.max(0, asNumber(bill.totalAmount) - discount);
    current.expected += expected;
    current.collected += Math.max(0, asNumber(bill.amountPaid));
    current.outstanding += bill.status === "WAIVED" ? 0 : Math.max(0, asNumber(bill.balance));
    current.discountAmount += discount;
    current.billCount += 1;
    current.studentIds.add(bill.studentId);
    if (bill.status === "PAID" || bill.status === "OVERPAID") current.paidBills += 1;
    if (bill.status === "PARTIAL") current.partialBills += 1;
    if (bill.status === "UNPAID") current.unpaidBills += 1;
    if (bill.status === "WAIVED") current.waivedBills += 1;
    classMap.set(klass.id, current);
  }

  const rows = Array.from(classMap.values())
    .map((item) => {
      const rate = collectionRate(item.collected, item.expected);
      return {
        classId: item.classId,
        className: item.className,
        expected: item.expected,
        collected: item.collected,
        outstanding: item.outstanding,
        discountAmount: item.discountAmount,
        billCount: item.billCount,
        paidBills: item.paidBills,
        partialBills: item.partialBills,
        unpaidBills: item.unpaidBills,
        waivedBills: item.waivedBills,
        studentCount: item.studentIds.size,
        collectionRate: rate,
        risk: riskFor(rate, item.outstanding),
      } satisfies ClassCollectionReportRow;
    })
    .sort((a, b) => classSortKey(a.className) - classSortKey(b.className) || a.className.localeCompare(b.className));

  const expected = rows.reduce((sum, row) => sum + row.expected, 0);
  const collected = rows.reduce((sum, row) => sum + row.collected, 0);
  const outstanding = rows.reduce((sum, row) => sum + row.outstanding, 0);

  return {
    expected,
    collected,
    outstanding,
    collectionRate: collectionRate(collected, expected),
    totalClasses: rows.length,
    weakClassCount: rows.filter((row) => row.risk === "Weak" || row.risk === "Critical").length,
    rows,
  };
}
