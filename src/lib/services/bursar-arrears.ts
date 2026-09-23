import prisma from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import type { BillStatus, FeeCategory } from "@/src/generated/prisma";

export type ArrearsPriority = "Critical" | "High" | "Medium" | "Low";
export type ArrearsBillStatusFilter = "UNPAID" | "PARTIAL" | "OVERDUE";

export type BursarArrearsOptions = {
  asOf?: Date;
  limit?: number;
  criticalBalanceThreshold?: number;
  highBalanceThreshold?: number;
  classId?: number | null;
  billStatus?: ArrearsBillStatusFilter | null;
  minBalance?: number | null;
  feeCategory?: FeeCategory | null;
};

export type ArrearsParentContact = {
  parentId: string;
  name: string;
  phone: string | null;
  email: string | null;
  relationshipRole: string;
  source: "RELATIONSHIP" | "LEGACY";
};

export type BursarArrearsItem = {
  billId: number;
  studentId: string;
  studentName: string;
  classId: number | null;
  className: string | null;
  feeStructureId: number;
  feeTitle: string;
  feeType: string;
  feeCategories: FeeCategory[];
  academicYear: string;
  term: string;
  amountOwed: number;
  totalAmount: number;
  amountPaid: number;
  discountAmount: number;
  billStatus: Extract<BillStatus, "UNPAID" | "PARTIAL">;
  dueDate: Date | null;
  daysOverdue: number;
  isOverdue: boolean;
  parentContact: ArrearsParentContact | null;
  lastReminderSentAt: Date | null;
  priority: ArrearsPriority;
  priorityReason: string;
  href: string;
};

export type BursarArrearsClassSummary = {
  classId: number | null;
  className: string;
  amountOwed: number;
  billCount: number;
  studentCount: number;
  overdueAmount: number;
  criticalCount: number;
};

export type BursarArrearsSummary = {
  totalOwed: number;
  overdueAmount: number;
  criticalAmount: number;
  totalStudents: number;
  overdueStudents: number;
  partPaidStudents: number;
  noParentContact: number;
  byPriority: Record<ArrearsPriority, number>;
  byClass: BursarArrearsClassSummary[];
};

export type BursarArrearsFollowUp = {
  asOf: Date;
  sourceOfTruth: "StudentBill";
  items: BursarArrearsItem[];
  summary: BursarArrearsSummary;
};

const ARREARS_STATUSES: Array<Extract<BillStatus, "UNPAID" | "PARTIAL">> = ["UNPAID", "PARTIAL"];
const REMINDER_SOURCE_MODELS = ["FinanceReminder", "ArrearsReminder", "PaymentReminder"];

function asNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value ?? 0);
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function daysOverdue(dueDate: Date | null, asOf: Date) {
  if (!dueDate) return 0;
  const due = startOfDay(dueDate).getTime();
  const today = startOfDay(asOf).getTime();
  const diff = Math.floor((today - due) / 86_400_000);
  return Math.max(0, diff);
}

export function arrearsPriority(input: {
  amountOwed: number;
  daysOverdue: number;
  criticalBalanceThreshold?: number;
  highBalanceThreshold?: number;
}): { priority: ArrearsPriority; reason: string } {
  const criticalBalanceThreshold = input.criticalBalanceThreshold ?? 2_000;
  const highBalanceThreshold = input.highBalanceThreshold ?? 1_000;

  if (input.daysOverdue > 30) {
    return { priority: "Critical", reason: "Overdue by more than 30 days" };
  }

  if (input.amountOwed >= criticalBalanceThreshold) {
    return { priority: "Critical", reason: `Owes at least GHS ${criticalBalanceThreshold.toLocaleString("en-GH")}` };
  }

  if (input.daysOverdue >= 14) {
    return { priority: "High", reason: "Overdue by 14 to 30 days" };
  }

  if (input.amountOwed >= highBalanceThreshold) {
    return { priority: "High", reason: `Owes at least GHS ${highBalanceThreshold.toLocaleString("en-GH")}` };
  }

  if (input.daysOverdue > 0) {
    return { priority: "Medium", reason: "Recently overdue" };
  }

  return { priority: "Low", reason: "Owing but not overdue yet" };
}

function comparePriority(a: ArrearsPriority, b: ArrearsPriority) {
  const order: Record<ArrearsPriority, number> = {
    Critical: 0,
    High: 1,
    Medium: 2,
    Low: 3,
  };
  return order[a] - order[b];
}

function contactName(parent: { name: string | null; surname: string | null; username?: string | null }) {
  return `${parent.name ?? ""} ${parent.surname ?? ""}`.trim() || parent.username || "Parent";
}

export async function getBursarArrearsFollowUp(
  schoolId: string,
  options: BursarArrearsOptions = {},
): Promise<BursarArrearsFollowUp> {
  const asOf = options.asOf ?? new Date();
  const limit = Math.min(Math.max(options.limit ?? 12, 1), 100);
  const minBalance = Math.max(Number(options.minBalance ?? 0), 0);
  const statusFilter: Array<Extract<BillStatus, "UNPAID" | "PARTIAL">> =
    options.billStatus === "UNPAID"
      ? ["UNPAID"]
      : options.billStatus === "PARTIAL"
        ? ["PARTIAL"]
        : ARREARS_STATUSES;
  const studentWhere: Prisma.StudentWhereInput = {
    schoolId,
    ...(options.classId ? { classId: options.classId } : {}),
  };
  const where: Prisma.StudentBillWhereInput = {
    schoolId,
    status: { in: statusFilter },
    balance: { gt: minBalance },
    student: studentWhere,
    feeStructure: { schoolId },
    ...(options.billStatus === "OVERDUE" ? { dueDate: { lt: startOfDay(asOf) } } : {}),
    ...(options.feeCategory
      ? {
          lineItems: {
            some: {
              balance: { gt: 0 },
              feeItem: { category: options.feeCategory },
            },
          },
        }
      : {}),
  };

  const bills = await prisma.studentBill.findMany({
    where,
    include: {
      student: {
        select: {
          id: true,
          name: true,
          surname: true,
          parentId: true,
          classId: true,
          class: { select: { id: true, name: true } },
          parent: {
            select: {
              id: true,
              name: true,
              surname: true,
              username: true,
              phone: true,
              email: true,
              schoolId: true,
            },
          },
          parentRelationships: {
            where: {
              schoolId,
              status: "ACTIVE",
              canViewFees: true,
              parent: { schoolId },
            },
            select: {
              role: true,
              parent: {
                select: {
                  id: true,
                  name: true,
                  surname: true,
                  username: true,
                  phone: true,
                  email: true,
                },
              },
            },
            orderBy: [{ role: "asc" }, { updatedAt: "desc" }],
            take: 1,
          },
        },
      },
      feeStructure: {
        select: {
          id: true,
          title: true,
          academicYear: true,
          term: true,
        },
      },
      lineItems: {
        select: {
          balance: true,
          feeItem: { select: { category: true } },
        },
      },
    },
    orderBy: [{ balance: "desc" }, { dueDate: "asc" }, { updatedAt: "desc" }],
  });

  const billIds = bills.map((bill) => bill.id);
  const reminderRows = billIds.length > 0
    ? await prisma.parentNotification.findMany({
        where: {
          schoolId,
          sourceModel: { in: REMINDER_SOURCE_MODELS },
          sourceId: { in: billIds.map(String) },
        },
        select: { sourceId: true, occurredAt: true },
        orderBy: { occurredAt: "desc" },
      })
    : [];

  const lastReminderByBillId = new Map<number, Date>();
  for (const row of reminderRows) {
    const billId = Number(row.sourceId);
    if (Number.isInteger(billId) && !lastReminderByBillId.has(billId)) {
      lastReminderByBillId.set(billId, row.occurredAt);
    }
  }

  const items = bills.map((bill): BursarArrearsItem => {
    const amountOwed = asNumber(bill.balance);
    const overdueDays = daysOverdue(bill.dueDate, asOf);
    const priority = arrearsPriority({
      amountOwed,
      daysOverdue: overdueDays,
      criticalBalanceThreshold: options.criticalBalanceThreshold,
      highBalanceThreshold: options.highBalanceThreshold,
    });
    const relationship = bill.student.parentRelationships[0];
    const legacyParent = bill.student.parent?.schoolId === schoolId ? bill.student.parent : null;
    const parentContact: ArrearsParentContact | null = relationship
      ? {
          parentId: relationship.parent.id,
          name: contactName(relationship.parent),
          phone: relationship.parent.phone,
          email: relationship.parent.email,
          relationshipRole: relationship.role,
          source: "RELATIONSHIP",
        }
      : legacyParent
        ? {
            parentId: legacyParent.id,
            name: contactName(legacyParent),
            phone: legacyParent.phone,
            email: legacyParent.email,
            relationshipRole: "LEGACY_PRIMARY_GUARDIAN",
            source: "LEGACY",
          }
        : null;
    const categories = [
      ...new Set(
        bill.lineItems
          .filter((line) => asNumber(line.balance) > 0)
          .map((line) => line.feeItem.category),
      ),
    ];

    return {
      billId: bill.id,
      studentId: bill.student.id,
      studentName: `${bill.student.name} ${bill.student.surname}`,
      classId: bill.student.class?.id ?? bill.student.classId ?? null,
      className: bill.student.class?.name ?? null,
      feeStructureId: bill.feeStructure.id,
      feeTitle: bill.feeStructure.title,
      feeType: categories.length === 1 ? categories[0] : categories.length > 1 ? "Mixed fees" : "Fees",
      feeCategories: categories,
      academicYear: bill.feeStructure.academicYear,
      term: bill.feeStructure.term,
      amountOwed,
      totalAmount: asNumber(bill.totalAmount),
      amountPaid: asNumber(bill.amountPaid),
      discountAmount: asNumber(bill.discountAmount),
      billStatus: bill.status as Extract<BillStatus, "UNPAID" | "PARTIAL">,
      dueDate: bill.dueDate,
      daysOverdue: overdueDays,
      isOverdue: overdueDays > 0,
      parentContact,
      lastReminderSentAt: lastReminderByBillId.get(bill.id) ?? null,
      priority: priority.priority,
      priorityReason: priority.reason,
      href: `/list/finance/bills/${bill.id}`,
    };
  });

  items.sort((a, b) => {
    const priorityOrder = comparePriority(a.priority, b.priority);
    if (priorityOrder !== 0) return priorityOrder;
    if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
    return b.amountOwed - a.amountOwed;
  });

  const classMap = new Map<string, {
    classId: number | null;
    className: string;
    amountOwed: number;
    billCount: number;
    studentIds: Set<string>;
    overdueAmount: number;
    criticalCount: number;
  }>();

  for (const item of items) {
    const key = item.classId === null ? "NO_CLASS" : String(item.classId);
    const current = classMap.get(key) ?? {
      classId: item.classId,
      className: item.className ?? "No class",
      amountOwed: 0,
      billCount: 0,
      studentIds: new Set<string>(),
      overdueAmount: 0,
      criticalCount: 0,
    };
    current.amountOwed += item.amountOwed;
    current.billCount += 1;
    current.studentIds.add(item.studentId);
    if (item.isOverdue) current.overdueAmount += item.amountOwed;
    if (item.priority === "Critical") current.criticalCount += 1;
    classMap.set(key, current);
  }

  const limitedItems = items.slice(0, limit);
  const summary: BursarArrearsSummary = {
    totalOwed: items.reduce((sum, item) => sum + item.amountOwed, 0),
    overdueAmount: items.filter((item) => item.isOverdue).reduce((sum, item) => sum + item.amountOwed, 0),
    criticalAmount: items.filter((item) => item.priority === "Critical").reduce((sum, item) => sum + item.amountOwed, 0),
    totalStudents: new Set(items.map((item) => item.studentId)).size,
    overdueStudents: new Set(items.filter((item) => item.isOverdue).map((item) => item.studentId)).size,
    partPaidStudents: new Set(items.filter((item) => item.billStatus === "PARTIAL").map((item) => item.studentId)).size,
    noParentContact: new Set(items.filter((item) => !item.parentContact).map((item) => item.studentId)).size,
    byPriority: {
      Critical: items.filter((item) => item.priority === "Critical").length,
      High: items.filter((item) => item.priority === "High").length,
      Medium: items.filter((item) => item.priority === "Medium").length,
      Low: items.filter((item) => item.priority === "Low").length,
    },
    byClass: Array.from(classMap.values())
      .map((item) => ({
        classId: item.classId,
        className: item.className,
        amountOwed: item.amountOwed,
        billCount: item.billCount,
        studentCount: item.studentIds.size,
        overdueAmount: item.overdueAmount,
        criticalCount: item.criticalCount,
      }))
      .sort((a, b) => b.amountOwed - a.amountOwed || a.className.localeCompare(b.className)),
  };

  return {
    asOf,
    sourceOfTruth: "StudentBill",
    items: limitedItems,
    summary,
  };
}
