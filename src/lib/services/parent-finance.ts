import prisma from "@/src/lib/prisma";
import { FEE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from "@/src/lib/constants/finance";
import type { BillStatus, FinanceQueryReason, FinanceQueryStatus, PaymentStatus } from "@/src/generated/prisma";

const TERM_LABELS: Record<string, string> = {
  TERM_1: "Term 1",
  TERM_2: "Term 2",
  TERM_3: "Term 3",
};

export type ParentFinanceBillState = "paid" | "waived" | "overpaid" | "overdue" | "due-soon" | "partial" | "unpaid";

export type ParentFinancePayment = {
  id: number;
  receiptNumber: string;
  amount: number;
  method: string;
  methodLabel: string;
  date: Date;
  status: PaymentStatus;
  referenceNo?: string | null;
  receiptHref: string;
};

export type ParentFinanceQuery = {
  id: number;
  reason: FinanceQueryReason;
  status: FinanceQueryStatus;
  message: string;
  response?: string | null;
  createdAt: Date;
  resolvedAt?: Date | null;
};

export type ParentFinanceAdjustment = {
  id: string;
  type: "discount" | "waiver" | "reversal";
  label: string;
  description: string;
  amount?: number | null;
  percentage?: number | null;
  actor?: string | null;
  date: Date;
};

export type ParentFinanceBill = {
  id: number;
  childId: string;
  childName: string;
  className: string;
  title: string;
  termLabel: string;
  academicYear: string;
  status: BillStatus;
  state: ParentFinanceBillState;
  totalAmount: number;
  amountPaid: number;
  discountAmount: number;
  balance: number;
  paymentRate: number;
  dueDate?: Date | null;
  daysUntilDue?: number | null;
  balanceExplanation: string;
  lineItems: {
    id: number;
    name: string;
    category: string;
    categoryLabel: string;
    amount: number;
    amountPaid: number;
    balance: number;
    isPaid: boolean;
    isOptional: boolean;
  }[];
  payments: ParentFinancePayment[];
  adjustments: ParentFinanceAdjustment[];
  queries: ParentFinanceQuery[];
};

export type ParentFinanceOverview = {
  parentId: string;
  children: {
    id: string;
    name: string;
    className: string;
    outstanding: number;
  }[];
  filters: {
    academicYears: string[];
    terms: string[];
  };
  bills: ParentFinanceBill[];
  totals: {
    totalBilled: number;
    totalPaid: number;
    totalDiscount: number;
    outstanding: number;
    paymentRate: number;
    billCount: number;
    unpaidBillCount: number;
    overdueBillCount: number;
    dueSoonBillCount: number;
    openQueryCount: number;
  };
  lastPayment?: ParentFinancePayment;
};

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function dayDiff(from: Date, to: Date) {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
}

function billState(input: {
  status: BillStatus;
  balance: number;
  dueDate?: Date | null;
  now: Date;
}): { state: ParentFinanceBillState; daysUntilDue: number | null } {
  if (input.status === "PAID") return { state: "paid", daysUntilDue: null };
  if (input.status === "WAIVED") return { state: "waived", daysUntilDue: null };
  if (input.status === "OVERPAID") return { state: "overpaid", daysUntilDue: null };

  const daysUntilDue = input.dueDate ? dayDiff(input.now, input.dueDate) : null;
  if (input.balance > 0 && daysUntilDue !== null && daysUntilDue < 0) {
    return { state: "overdue", daysUntilDue };
  }
  if (input.balance > 0 && daysUntilDue !== null && daysUntilDue <= 7) {
    return { state: "due-soon", daysUntilDue };
  }
  if (input.status === "PARTIAL") return { state: "partial", daysUntilDue };
  return { state: "unpaid", daysUntilDue };
}

function explainBalance(bill: {
  title: string;
  totalAmount: number;
  amountPaid: number;
  discountAmount: number;
  balance: number;
}) {
  const discount = bill.discountAmount > 0 ? ` Discounts/waivers applied: GHS ${bill.discountAmount.toFixed(2)}.` : "";
  return `${bill.title} is GHS ${bill.totalAmount.toFixed(2)}. You have paid GHS ${bill.amountPaid.toFixed(2)}.${discount} Balance is GHS ${bill.balance.toFixed(2)}.`;
}

function sortBillsForParents(a: ParentFinanceBill, b: ParentFinanceBill) {
  if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return b.id - a.id;
}

export async function getParentFinanceOverview(parentId: string, schoolId: string): Promise<ParentFinanceOverview> {
  const parent = await prisma.parent.findFirst({
    where: { id: parentId, schoolId },
    select: {
      id: true,
      students: {
        where: { schoolId },
        select: {
          id: true,
          name: true,
          surname: true,
          class: { select: { name: true } },
        },
      },
    },
  });
  const childIds = parent?.students.map((student) => student.id) ?? [];
  if (!parent || childIds.length === 0) {
    return {
      parentId,
      children: [],
      filters: { academicYears: [], terms: [] },
      bills: [],
      totals: {
        totalBilled: 0,
        totalPaid: 0,
        totalDiscount: 0,
        outstanding: 0,
        paymentRate: 100,
        billCount: 0,
        unpaidBillCount: 0,
        overdueBillCount: 0,
        dueSoonBillCount: 0,
        openQueryCount: 0,
      },
    };
  }

  const rawBills = await prisma.studentBill.findMany({
    where: { schoolId, studentId: { in: childIds } },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          surname: true,
          class: { select: { name: true } },
        },
      },
      feeStructure: {
        select: { title: true, term: true, academicYear: true },
      },
      lineItems: {
        include: { feeItem: { select: { name: true, category: true, isOptional: true } } },
        orderBy: { createdAt: "asc" },
      },
      payments: {
        orderBy: { paymentDate: "desc" },
        include: {
          reversal: {
            select: {
              reason: true,
              reversedBy: true,
              reversedAt: true,
            },
          },
        },
      },
      discounts: {
        orderBy: { createdAt: "desc" },
      },
      financeQueries: {
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const now = new Date();
  const bills: ParentFinanceBill[] = rawBills.map((bill) => {
    const totalAmount = toNumber(bill.totalAmount);
    const amountPaid = toNumber(bill.amountPaid);
    const discountAmount = toNumber(bill.discountAmount);
    const balance = toNumber(bill.balance);
    const state = billState({ status: bill.status, balance, dueDate: bill.dueDate, now });
    const title = bill.feeStructure.title;
    const paymentRate = totalAmount > 0 ? Math.min(Math.round((amountPaid / totalAmount) * 100), 100) : 100;

    return {
      id: bill.id,
      childId: bill.student.id,
      childName: `${bill.student.name} ${bill.student.surname}`,
      className: bill.student.class?.name ?? "",
      title,
      termLabel: TERM_LABELS[bill.feeStructure.term] ?? bill.feeStructure.term,
      academicYear: bill.feeStructure.academicYear,
      status: bill.status,
      state: state.state,
      totalAmount,
      amountPaid,
      discountAmount,
      balance,
      paymentRate,
      dueDate: bill.dueDate,
      daysUntilDue: state.daysUntilDue,
      balanceExplanation: explainBalance({ title, totalAmount, amountPaid, discountAmount, balance }),
      lineItems: bill.lineItems.map((line) => ({
        id: line.id,
        name: line.feeItem.name,
        category: line.feeItem.category,
        categoryLabel: FEE_CATEGORY_LABELS[line.feeItem.category] ?? line.feeItem.category,
        amount: toNumber(line.amount),
        amountPaid: toNumber(line.amountPaid),
        balance: toNumber(line.balance),
        isPaid: line.isPaid,
        isOptional: line.feeItem.isOptional,
      })),
      payments: bill.payments.map((payment) => ({
        id: payment.id,
        receiptNumber: payment.receiptNumber,
        amount: toNumber(payment.amount),
        method: payment.paymentMethod,
        methodLabel: PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod,
        date: payment.paymentDate,
        status: payment.status,
        referenceNo: payment.referenceNo,
        receiptHref: `/api/finance/receipt?billId=${bill.id}&receiptNumber=${encodeURIComponent(payment.receiptNumber)}`,
      })),
      adjustments: [
        ...bill.discounts.map((discount) => ({
          id: `discount:${discount.id}`,
          type: "discount" as const,
          label: discount.type.replaceAll("_", " "),
          description: discount.description,
          amount: discount.amount ? toNumber(discount.amount) : null,
          percentage: discount.percentage ? toNumber(discount.percentage) : null,
          actor: discount.approvedBy,
          date: discount.createdAt,
        })),
        ...bill.payments
          .filter((payment) => payment.status === "REVERSED" && payment.reversal)
          .map((payment) => ({
            id: `reversal:${payment.id}`,
            type: "reversal" as const,
            label: "Payment reversed",
            description: payment.reversal?.reason ?? "Payment reversal recorded.",
            amount: toNumber(payment.amount),
            percentage: null,
            actor: payment.reversal?.reversedBy ?? null,
            date: payment.reversal?.reversedAt ?? payment.paymentDate,
          })),
        ...(bill.status === "WAIVED"
          ? [{
              id: `waiver:${bill.id}`,
              type: "waiver" as const,
              label: "Bill waived",
              description: bill.notes ?? "This bill was waived by the school.",
              amount: balance > 0 ? balance : totalAmount,
              percentage: null,
              actor: null,
              date: bill.dueDate ?? now,
            }]
          : []),
      ].sort((a, b) => b.date.getTime() - a.date.getTime()),
      queries: bill.financeQueries.map((query) => ({
        id: query.id,
        reason: query.reason,
        status: query.status,
        message: query.message,
        response: query.response,
        createdAt: query.createdAt,
        resolvedAt: query.resolvedAt,
      })),
    };
  });

  bills.sort(sortBillsForParents);

  const totalBilled = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
  const totalPaid = bills.reduce((sum, bill) => sum + bill.amountPaid, 0);
  const totalDiscount = bills.reduce((sum, bill) => sum + bill.discountAmount, 0);
  const outstanding = bills.reduce((sum, bill) => sum + bill.balance, 0);
  const allPayments = bills.flatMap((bill) => bill.payments).sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    parentId,
    children: parent.students.map((child) => {
      const childBill = bills.find((bill) => bill.childId === child.id);
      const childBills = bills.filter((bill) => bill.childId === child.id);
      return {
        id: child.id,
        name: childBill?.childName ?? `${child.name} ${child.surname}`,
        className: childBill?.className ?? child.class?.name ?? "",
        outstanding: childBills.reduce((sum, bill) => sum + bill.balance, 0),
      };
    }),
    filters: {
      academicYears: [...new Set(bills.map((bill) => bill.academicYear))].sort().reverse(),
      terms: [...new Set(bills.map((bill) => bill.termLabel))],
    },
    bills,
    totals: {
      totalBilled,
      totalPaid,
      totalDiscount,
      outstanding,
      paymentRate: totalBilled > 0 ? Math.min(Math.round((totalPaid / totalBilled) * 100), 100) : 100,
      billCount: bills.length,
      unpaidBillCount: bills.filter((bill) => bill.balance > 0).length,
      overdueBillCount: bills.filter((bill) => bill.state === "overdue").length,
      dueSoonBillCount: bills.filter((bill) => bill.state === "due-soon").length,
      openQueryCount: bills.flatMap((bill) => bill.queries).filter((query) => query.status === "OPEN" || query.status === "IN_REVIEW").length,
    },
    lastPayment: allPayments[0],
  };
}

export async function getParentFinanceBill(parentId: string, schoolId: string, billId: number) {
  const overview = await getParentFinanceOverview(parentId, schoolId);
  return overview.bills.find((bill) => bill.id === billId) ?? null;
}
