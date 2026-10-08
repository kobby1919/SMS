import type { PaymentIntentStatus, Prisma } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { getDailyCollectionReport } from "@/src/lib/services/daily-collection-report";
import { getReceiptIntegrityReport } from "@/src/lib/services/receipt-integrity-report";

const OPEN_BILL_STATUSES = ["UNPAID", "PARTIAL"] as const;
const BILL_POSITION_FREQUENCIES = ["TERM", "MONTHLY", "WEEKLY", "ONE_TIME"] as const;
const ACTIVE_ONLINE_INTENT_STATUSES: PaymentIntentStatus[] = [
  "PENDING",
  "PENDING_PROVIDER",
  "CHECKOUT_CREATED",
];

export type AdminFinanceSnapshot = Awaited<ReturnType<typeof getAdminFinanceSnapshot>>;

function asNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value.toNumber();
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

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.min(100, Math.round((numerator / denominator) * 1000) / 10);
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

function startOfDate(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function daysOverdue(dueDate: Date | null, asOf: Date) {
  if (!dueDate) return 0;
  const diff = Math.floor((startOfDate(asOf).getTime() - startOfDate(dueDate).getTime()) / 86_400_000);
  return Math.max(0, diff);
}

function priorityForOwing(amountOwed: number, overdueDays: number) {
  if (overdueDays > 30 || amountOwed >= 2_000) return "Critical";
  if (overdueDays >= 14 || amountOwed >= 1_000) return "High";
  if (overdueDays > 0) return "Medium";
  return "Low";
}

function comparePriority(a: string, b: string) {
  const order: Record<string, number> = {
    Critical: 0,
    High: 1,
    Medium: 2,
    Low: 3,
  };
  return (order[a] ?? 99) - (order[b] ?? 99);
}

function contactStatus(input: {
  relationship?: { parent: { email: string | null; phone: string | null } } | null;
  legacyParent?: { email: string | null; phone: string | null; schoolId: string | null } | null;
  schoolId: string;
}) {
  const relationshipParent = input.relationship?.parent;
  if (relationshipParent) {
    return relationshipParent.email || relationshipParent.phone
      ? "Contact saved"
      : "Parent profile missing phone/email";
  }

  if (input.legacyParent?.schoolId === input.schoolId) {
    return input.legacyParent.email || input.legacyParent.phone
      ? "Legacy contact saved"
      : "Legacy parent missing phone/email";
  }

  return "No contact saved";
}

function buildDuplicateReferenceCount(
  rows: {
    paymentMethod: string;
    referenceNo: string | null;
    externalProvider: string | null;
    externalReference: string | null;
    recordedBy: string;
  }[],
) {
  const groups = new Map<string, number>();

  for (const row of rows) {
    const onlineVerified = Boolean(
      row.externalProvider &&
        row.externalReference &&
        row.recordedBy === "system:webhook",
    );
    const reference = (onlineVerified ? row.externalReference : row.referenceNo)?.trim();
    if (!reference) continue;

    const method = onlineVerified
      ? `ONLINE:${row.externalProvider}`
      : row.paymentMethod;
    const key = `${method}:${reference.toLowerCase()}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }

  return Array.from(groups.values()).filter((count) => count > 1).length;
}

function discountShare({
  billDiscount,
  includedLineTotal,
  allLineTotal,
}: {
  billDiscount: number;
  includedLineTotal: number;
  allLineTotal: number;
}) {
  if (billDiscount <= 0 || includedLineTotal <= 0 || allLineTotal <= 0) return 0;
  return Math.min(includedLineTotal, (billDiscount * includedLineTotal) / allLineTotal);
}

function buildBillMoneyPosition(
  bills: {
    id: number;
    schoolId: string;
    studentId: string;
    status: string;
    dueDate: Date | null;
    discountAmount: Prisma.Decimal;
    student: {
      name: string;
      surname: string;
      class: { id: number; name: string } | null;
      parent: { email: string | null; phone: string | null; schoolId: string | null } | null;
      parentRelationships: {
        parent: { email: string | null; phone: string | null };
      }[];
    };
    lineItems: {
      id: number;
      amount: Prisma.Decimal;
      amountPaid: Prisma.Decimal;
      balance: Prisma.Decimal;
      feeItem: { name: string; category: string; billingFrequency: string };
    }[];
  }[],
  asOf: Date,
) {
  let expectedFees = 0;
  let collectedFees = 0;
  let outstandingBalance = 0;
  let billCount = 0;
  let dailyLineItemCountExcluded = 0;
  const studentsWithBills = new Set<string>();
  const owingStudentIds = new Set<string>();
  const classMap = new Map<
    number,
    {
      classId: number;
      className: string;
      expected: number;
      collected: number;
      outstanding: number;
      billCount: number;
      paidBills: number;
      partialBills: number;
      unpaidBills: number;
      waivedBills: number;
      studentIds: Set<string>;
    }
  >();
  const owingItems: {
    studentId: string;
    billId: number;
    studentName: string;
    className: string;
    amountOwed: number;
    daysOverdue: number;
    priority: string;
    parentContactStatus: string;
    href: string;
  }[] = [];
  const feeItemMap = new Map<
    string,
    {
      name: string;
      category: string;
      billingFrequency: string;
      expected: number;
      collected: number;
      outstanding: number;
      lineItemIds: Set<number>;
      studentIds: Set<string>;
    }
  >();

  for (const bill of bills) {
    const includedLines = bill.lineItems.filter((line) =>
      BILL_POSITION_FREQUENCIES.includes(
        line.feeItem.billingFrequency as (typeof BILL_POSITION_FREQUENCIES)[number],
      ),
    );

    dailyLineItemCountExcluded += bill.lineItems.length - includedLines.length;
    if (includedLines.length === 0) continue;

    const allLineTotal = bill.lineItems.reduce((sum, line) => sum + Math.max(0, asNumber(line.amount)), 0);
    const includedLineTotal = includedLines.reduce((sum, line) => sum + Math.max(0, asNumber(line.amount)), 0);
    const includedPaid = includedLines.reduce((sum, line) => sum + Math.max(0, asNumber(line.amountPaid)), 0);
    const includedRawBalance = includedLines.reduce((sum, line) => sum + Math.max(0, asNumber(line.balance)), 0);
    const includedDiscount = discountShare({
      billDiscount: Math.max(0, asNumber(bill.discountAmount)),
      includedLineTotal,
      allLineTotal,
    });
    const expected = Math.max(0, includedLineTotal - includedDiscount);
    const outstanding = bill.status === "WAIVED"
      ? 0
      : Math.max(0, expected - includedPaid, includedRawBalance - includedDiscount);

    expectedFees += expected;
    collectedFees += includedPaid;
    outstandingBalance += outstanding;
    billCount += 1;
    studentsWithBills.add(bill.studentId);

    if (bill.student.class) {
      const currentClass = classMap.get(bill.student.class.id) ?? {
        classId: bill.student.class.id,
        className: bill.student.class.name,
        expected: 0,
        collected: 0,
        outstanding: 0,
        billCount: 0,
        paidBills: 0,
        partialBills: 0,
        unpaidBills: 0,
        waivedBills: 0,
        studentIds: new Set<string>(),
      };
      currentClass.expected += expected;
      currentClass.collected += includedPaid;
      currentClass.outstanding += outstanding;
      currentClass.billCount += 1;
      currentClass.studentIds.add(bill.studentId);
      if (bill.status === "WAIVED") {
        currentClass.waivedBills += 1;
      } else if (outstanding <= 0) {
        currentClass.paidBills += 1;
      } else if (includedPaid > 0) {
        currentClass.partialBills += 1;
      } else {
        currentClass.unpaidBills += 1;
      }
      classMap.set(bill.student.class.id, currentClass);
    }

    for (const line of includedLines) {
      const lineAmount = Math.max(0, asNumber(line.amount));
      const linePaid = Math.max(0, asNumber(line.amountPaid));
      const lineDiscount = includedLineTotal > 0
        ? Math.min(lineAmount, (includedDiscount * lineAmount) / includedLineTotal)
        : 0;
      const lineExpected = Math.max(0, lineAmount - lineDiscount);
      const lineOutstanding = bill.status === "WAIVED"
        ? 0
        : Math.max(0, lineExpected - linePaid, Math.max(0, asNumber(line.balance)) - lineDiscount);
      const key = `${line.feeItem.category}:${line.feeItem.name}:${line.feeItem.billingFrequency}`;
      const current = feeItemMap.get(key) ?? {
        name: line.feeItem.name,
        category: line.feeItem.category,
        billingFrequency: line.feeItem.billingFrequency,
        expected: 0,
        collected: 0,
        outstanding: 0,
        lineItemIds: new Set<number>(),
        studentIds: new Set<string>(),
      };

      current.expected += lineExpected;
      current.collected += linePaid;
      current.outstanding += lineOutstanding;
      current.lineItemIds.add(line.id);
      current.studentIds.add(bill.studentId);
      feeItemMap.set(key, current);
    }

    if (
      outstanding > 0 &&
      OPEN_BILL_STATUSES.includes(bill.status as (typeof OPEN_BILL_STATUSES)[number])
    ) {
      owingStudentIds.add(bill.studentId);
      const overdueDays = daysOverdue(bill.dueDate, asOf);
      owingItems.push({
        studentId: bill.studentId,
        billId: bill.id,
        studentName: `${bill.student.name} ${bill.student.surname}`.trim(),
        className: bill.student.class?.name ?? "No class",
        amountOwed: outstanding,
        daysOverdue: overdueDays,
        priority: priorityForOwing(outstanding, overdueDays),
        parentContactStatus: contactStatus({
          relationship: bill.student.parentRelationships.find(({ parent }) => parent.email || parent.phone) ?? bill.student.parentRelationships[0] ?? null,
          schoolId: bill.schoolId,
        }),
        href: `/list/finance/bills/${bill.id}`,
      });
    }
  }

  return {
    expectedFees,
    collectedFees,
    outstandingBalance,
    collectionRate: percentage(collectedFees, expectedFees),
    paidStudents: Array.from(studentsWithBills).filter((studentId) => !owingStudentIds.has(studentId)).length,
    owingStudents: owingStudentIds.size,
    studentCountWithBills: studentsWithBills.size,
    billCount,
    dailyLineItemCountExcluded,
    weakClasses: Array.from(classMap.values())
      .map((item) => ({
        classId: item.classId,
        className: item.className,
        expected: item.expected,
        collected: item.collected,
        outstanding: item.outstanding,
        billCount: item.billCount,
        paidBills: item.paidBills,
        partialBills: item.partialBills,
        unpaidBills: item.unpaidBills,
        waivedBills: item.waivedBills,
        studentCount: item.studentIds.size,
        collectionRate: percentage(item.collected, item.expected),
      }))
      .filter((row) => row.outstanding > 0)
      .sort((a, b) => a.collectionRate - b.collectionRate || b.outstanding - a.outstanding || classSortKey(a.className) - classSortKey(b.className))
      .slice(0, 5),
    highRiskOwingStudents: owingItems
      .sort((a, b) => comparePriority(a.priority, b.priority) || b.amountOwed - a.amountOwed || b.daysOverdue - a.daysOverdue)
      .filter((item, index, rows) => rows.findIndex((row) => row.studentId === item.studentId) === index)
      .slice(0, 5),
    feeItemBreakdown: Array.from(feeItemMap.values())
      .map((item) => ({
        name: item.name,
        category: item.category,
        billingFrequency: item.billingFrequency,
        expected: item.expected,
        collected: item.collected,
        outstanding: item.outstanding,
        collectionRate: percentage(item.collected, item.expected),
        lineItemCount: item.lineItemIds.size,
        studentCount: item.studentIds.size,
      }))
      .sort((a, b) => b.outstanding - a.outstanding || b.expected - a.expected || a.name.localeCompare(b.name)),
  };
}

export async function getAdminFinanceSnapshot(schoolId: string, now = new Date()) {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [
    dailyCollections,
    receiptIntegrity,
    confirmedPaymentTotals,
    todayPaymentTotals,
    receiptsIssuedToday,
    onlinePaymentsConfirmedToday,
    pendingOnlinePayments,
    lastPayment,
    pendingCorrectionRequests,
    approvedReversalsToday,
    failedOnlineAttempts,
    activeReferenceRows,
    billMoneyRows,
    activeStudentsWithoutBills,
  ] = await Promise.all([
    getDailyCollectionReport(schoolId, now),
    getReceiptIntegrityReport(schoolId),
    prisma.payment.aggregate({
      where: {
        schoolId,
        status: "CONFIRMED",
        studentBill: { schoolId, student: { schoolId, status: "ACTIVE" } },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payment.aggregate({
      where: {
        schoolId,
        status: "CONFIRMED",
        paymentDate: { gte: todayStart, lte: todayEnd },
        studentBill: { schoolId, student: { schoolId, status: "ACTIVE" } },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payment.count({
      where: {
        schoolId,
        status: "CONFIRMED",
        createdAt: { gte: todayStart, lte: todayEnd },
        studentBill: { schoolId, student: { schoolId, status: "ACTIVE" } },
      },
    }),
    prisma.payment.count({
      where: {
        schoolId,
        status: "CONFIRMED",
        externalProvider: { not: null },
        externalReference: { not: null },
        recordedBy: "system:webhook",
        paymentDate: { gte: todayStart, lte: todayEnd },
        studentBill: { schoolId, student: { schoolId, status: "ACTIVE" } },
      },
    }),
    prisma.paymentIntent.count({
      where: {
        schoolId,
        status: { in: ACTIVE_ONLINE_INTENT_STATUSES },
        student: { schoolId, status: "ACTIVE" },
      },
    }),
    prisma.payment.findFirst({
      where: {
        schoolId,
        status: "CONFIRMED",
        studentBill: { schoolId, student: { schoolId, status: "ACTIVE" } },
      },
      select: { paymentDate: true, receiptNumber: true, amount: true },
      orderBy: { paymentDate: "desc" },
    }),
    prisma.paymentCorrectionRequest.count({
      where: {
        schoolId,
        status: "PENDING_REVIEW",
        studentBill: { schoolId, student: { schoolId, status: "ACTIVE" } },
      },
    }),
    prisma.paymentReversal.count({
      where: {
        schoolId,
        reversedAt: { gte: todayStart, lte: todayEnd },
        payment: { schoolId, studentBill: { schoolId, student: { schoolId, status: "ACTIVE" } } },
      },
    }),
    prisma.paymentIntent.count({
      where: {
        schoolId,
        status: { in: ["FAILED", "EXPIRED", "CANCELLED"] },
        updatedAt: { gte: todayStart, lte: todayEnd },
        student: { schoolId, status: "ACTIVE" },
      },
    }),
    prisma.payment.findMany({
      where: {
        schoolId,
        status: { notIn: ["FAILED", "REVERSED"] },
        studentBill: { schoolId, student: { schoolId, status: "ACTIVE" } },
        OR: [
          { referenceNo: { not: null } },
          { externalReference: { not: null } },
        ],
      },
      select: {
        paymentMethod: true,
        referenceNo: true,
        externalProvider: true,
        externalReference: true,
        recordedBy: true,
      },
    }),
    prisma.studentBill.findMany({
      where: {
        schoolId,
        student: { schoolId, status: "ACTIVE" },
        feeStructure: { schoolId },
      },
      select: {
        id: true,
        schoolId: true,
        studentId: true,
        status: true,
        dueDate: true,
        discountAmount: true,
        student: {
          select: {
            name: true,
            surname: true,
            class: { select: { id: true, name: true } },
            parent: { select: { email: true, phone: true, schoolId: true } },
            parentRelationships: {
              where: {
                schoolId,
                status: "ACTIVE",
                canViewFees: true,
                parent: { schoolId },
              },
              select: {
                parent: { select: { email: true, phone: true } },
              },
              orderBy: [{ role: "asc" }, { updatedAt: "desc" }],
            },
          },
        },
        lineItems: {
          select: {
            id: true,
            amount: true,
            amountPaid: true,
            balance: true,
            feeItem: { select: { name: true, category: true, billingFrequency: true } },
          },
        },
      },
    }),
    prisma.student.count({
      where: {
        schoolId,
        status: "ACTIVE",
        bills: { none: { schoolId } },
      },
    }),
  ]);

  const confirmedPaymentAmount = asNumber(confirmedPaymentTotals._sum.amount);
  const billPosition = buildBillMoneyPosition(billMoneyRows, now);

  const duplicateReferenceWarnings = buildDuplicateReferenceCount(activeReferenceRows);
  const integrityAlerts = [
    {
      id: "pending-corrections",
      label: "Pending correction requests",
      value: pendingCorrectionRequests,
      tone: pendingCorrectionRequests > 0 ? "warning" : "ok",
      href: "/list/finance/corrections?status=PENDING_REVIEW",
    },
    {
      id: "reversals-today",
      label: "Approved reversals today",
      value: approvedReversalsToday,
      tone: approvedReversalsToday > 0 ? "warning" : "ok",
      href: "/list/finance/receipts",
    },
    {
      id: "voided-receipts",
      label: "Voided receipts",
      value: receiptIntegrity.voidedReceipts,
      tone: receiptIntegrity.voidedReceipts > 0 ? "warning" : "ok",
      href: "/list/finance/receipts?status=REVERSED",
    },
    {
      id: "duplicate-references",
      label: "Duplicate reference warnings",
      value: Math.max(duplicateReferenceWarnings, receiptIntegrity.duplicateReferenceCount),
      tone: Math.max(duplicateReferenceWarnings, receiptIntegrity.duplicateReferenceCount) > 0 ? "risk" : "ok",
      href: "/list/finance/payments",
    },
    {
      id: "online-pending-failed",
      label: "Pending/failed online payments",
      value: pendingOnlinePayments + failedOnlineAttempts,
      tone: pendingOnlinePayments + failedOnlineAttempts > 0 ? "warning" : "ok",
      href: "/list/finance/payments?source=online",
    },
    {
      id: "daily-awaiting-confirmation",
      label: "Daily collections awaiting confirmation",
      value: dailyCollections.confirmationStatus.pendingReviewSessions,
      tone: dailyCollections.confirmationStatus.pendingReviewSessions > 0 ? "warning" : "ok",
      href: "/list/finance/daily-collections",
    },
    {
      id: "daily-mismatches",
      label: "Flagged collection mismatches",
      value: dailyCollections.confirmationStatus.flaggedSessions,
      tone: dailyCollections.confirmationStatus.flaggedSessions > 0 ? "risk" : "ok",
      href: "/list/finance/daily-collections",
    },
    {
      id: "students-without-bills",
      label: "Active students without bills",
      value: activeStudentsWithoutBills,
      tone: activeStudentsWithoutBills > 0 ? "warning" : "ok",
      href: "/list/finance/bills",
    },
  ] as const;

  return {
    generatedAt: now,
    hasFeeRecords: billMoneyRows.length > 0,
    hasBillPositionRecords: billPosition.billCount > 0,
    sourceOfTruth: {
      billPosition: "StudentBill line items with TERM, MONTHLY, WEEKLY, or ONE_TIME billing frequency.",
      weakClassesAndTopOwing: "Derived from the same non-daily StudentBill line-item calculation as the bill position cards.",
      dailyCollections: "DailyCollectionSession confirmedAmount records. Kept separate from bill position.",
      confirmedPayments: "Payment records with CONFIRMED status. Used for activity and receipt trust.",
      excludedFromBillPosition: {
        dailyLineItemCount: billPosition.dailyLineItemCountExcluded,
      },
    },
    moneyPosition: {
      expectedFees: billPosition.expectedFees,
      collectedFees: billPosition.collectedFees,
      outstandingBalance: billPosition.outstandingBalance,
      collectionRate: billPosition.collectionRate,
      paidStudents: billPosition.paidStudents,
      owingStudents: billPosition.owingStudents,
      billCount: billPosition.billCount,
      studentCountWithBills: billPosition.studentCountWithBills,
      confirmedPaymentCount: confirmedPaymentTotals._count._all,
      confirmedPaymentAmount,
      importedOrOpeningPaidAmount: billPosition.dailyLineItemCountExcluded > 0
        ? null
        : Math.max(0, billPosition.collectedFees - confirmedPaymentAmount),
      dailyLineItemCountExcluded: billPosition.dailyLineItemCountExcluded,
    },
    feeItemBreakdown: billPosition.feeItemBreakdown,
    todayActivity: {
      paymentsRecordedToday: todayPaymentTotals._count._all,
      billPaymentsRecordedToday: todayPaymentTotals._count._all,
      billPaymentAmountToday: asNumber(todayPaymentTotals._sum.amount),
      amountCollectedToday: asNumber(todayPaymentTotals._sum.amount),
      trustedMoneyToday: asNumber(todayPaymentTotals._sum.amount) + dailyCollections.summary.confirmedAmount,
      receiptsIssuedToday,
      onlinePaymentsConfirmedToday,
      pendingOnlinePayments,
      lastPaymentRecordedAt: lastPayment?.paymentDate ?? null,
      lastPaymentReceiptNumber: lastPayment?.receiptNumber ?? null,
      lastPaymentAmount: asNumber(lastPayment?.amount),
      dailyCollectionsConfirmedToday: dailyCollections.summary.confirmedAmount,
      dailyCollectionConfirmedSessions: dailyCollections.confirmationStatus.confirmedSessions,
      dailyCollectionPendingReviewSessions: dailyCollections.confirmationStatus.pendingReviewSessions,
      dailyCollectionPendingReviewAmount: dailyCollections.confirmationStatus.pendingReviewAmount,
      dailyCollectionFlaggedSessions: dailyCollections.confirmationStatus.flaggedSessions,
      dailyCollectionFlaggedAmount: dailyCollections.confirmationStatus.flaggedAmount,
    },
    weakClasses: billPosition.weakClasses,
    highRiskOwingStudents: billPosition.highRiskOwingStudents,
    integrityAlerts,
    receiptIntegrity,
  };
}
