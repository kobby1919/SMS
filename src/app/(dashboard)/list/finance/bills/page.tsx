// src/app/(dashboard)/list/finance/bills/page.tsx

import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronRight,
  FileText,
  Phone,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  formatGHS,
  BILL_STATUS_STYLES,
} from "@/src/lib/constants/finance";
import { ITEM_PER_PAGE } from "@/src/lib/settings";
import Pagination from "@/src/components/pagination";
import { Prisma } from "@/src/generated/prisma";
import type { BillStatus, Term } from "@/src/generated/prisma";

export const dynamic = "force-dynamic";

const TERM_LABELS: Record<string, string> = {
  TERM_1: "Term 1",
  TERM_2: "Term 2",
  TERM_3: "Term 3",
};

const BILL_STATUSES = ["UNPAID", "PARTIAL", "PAID", "OVERPAID", "WAIVED"] as const;
const TERMS = ["TERM_1", "TERM_2", "TERM_3"] as const;
const FEE_STATUS_FILTERS = ["UNPAID", "PARTIAL", "PAID", "OVERPAID", "WAIVED", "DISCOUNT", "ISSUE"] as const;
const BALANCE_FILTERS = ["OUTSTANDING", "SETTLED", "OVERPAID"] as const;

type FeeStatusFilter = (typeof FEE_STATUS_FILTERS)[number];
type BalanceFilter = (typeof BALANCE_FILTERS)[number];

type FeeStatusMeta = {
  label: string;
  tone: string;
  dot: string;
};

function parseBillStatus(value: string | undefined): BillStatus | undefined {
  return BILL_STATUSES.includes(value as BillStatus) ? (value as BillStatus) : undefined;
}

function parseFeeStatus(value: string | undefined): FeeStatusFilter | undefined {
  return FEE_STATUS_FILTERS.includes(value as FeeStatusFilter) ? (value as FeeStatusFilter) : undefined;
}

function parseBalanceFilter(value: string | undefined): BalanceFilter | undefined {
  return BALANCE_FILTERS.includes(value as BalanceFilter) ? (value as BalanceFilter) : undefined;
}

function parseTerm(value: string | undefined): Term | undefined {
  return TERMS.includes(value as Term) ? (value as Term) : undefined;
}

function parsePositiveInt(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function cleanSearch(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 80) : undefined;
}

function statusMeta(input: {
  status: BillStatus;
  hasActiveDiscount: boolean;
  hasOpenIssue: boolean;
}): FeeStatusMeta {
  if (input.hasOpenIssue) {
    return {
      label: "Payment issue",
      tone: "bg-rose-50 text-rose-700 border-rose-200",
      dot: "bg-rose-500",
    };
  }

  if (input.hasActiveDiscount) {
    return {
      label: "Scholarship/Discount",
      tone: "bg-blue-50 text-blue-700 border-blue-200",
      dot: "bg-blue-500",
    };
  }

  if (input.status === "PARTIAL") {
    return {
      label: "Part paid",
      tone: "bg-amber-50 text-amber-700 border-amber-200",
      dot: "bg-amber-500",
    };
  }

  const style = BILL_STATUS_STYLES[input.status];
  return {
    label: style.label,
    tone: `${style.bg} ${style.text} ${style.border}`,
    dot: input.status === "PAID" ? "bg-emerald-500" : input.status === "OVERPAID" ? "bg-blue-500" : "bg-gray-400",
  };
}

function classSortKey(name: string) {
  const normalized = name.trim().toLowerCase();
  if (normalized.includes("nursery")) return 10;
  if (normalized.includes("kg") || normalized.includes("kindergarten")) return 20 + Number(normalized.match(/\d+/)?.[0] ?? 0);
  if (normalized.includes("class")) return 40 + Number(normalized.match(/\d+/)?.[0] ?? 0);
  if (normalized.includes("jhs")) return 70 + Number(normalized.match(/\d+/)?.[0] ?? 0);
  return 999;
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `/list/finance/bills?${text}` : "/list/finance/bills";
}

function formatDate(date: Date | null | undefined) {
  if (!date) return "No payment yet";
  return date.toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" });
}

const BillsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { schoolId } = await requirePageSession(["admin", "bursar"]);

  const sp = await searchParams;
  const page = parsePositiveInt(sp.page) ?? 1;
  const filterStatus = parseFeeStatus(sp.status);
  const filterClass = parsePositiveInt(sp.classId);
  const filterStructure = parsePositiveInt(sp.structureId);
  const filterYear = sp.year?.trim() || undefined;
  const filterTerm = parseTerm(sp.term);
  const filterBalance = parseBalanceFilter(sp.balance);
  const search = cleanSearch(sp.search);

  const where: Prisma.StudentBillWhereInput = { schoolId };
  const studentWhere: Prisma.StudentWhereInput = {};

  const directStatus = parseBillStatus(filterStatus);
  if (directStatus) where.status = directStatus;
  if (filterStatus === "ISSUE") {
    where.financeQueries = { some: { status: { in: ["OPEN", "IN_REVIEW"] } } };
  }
  if (filterStatus === "DISCOUNT") {
    where.discounts = { some: { status: "ACTIVE" } };
  }

  if (filterBalance && !directStatus) {
    if (filterBalance === "OUTSTANDING") where.status = { in: ["UNPAID", "PARTIAL"] };
    if (filterBalance === "SETTLED") where.status = { in: ["PAID", "WAIVED"] };
    if (filterBalance === "OVERPAID") where.status = "OVERPAID";
  }

  if (filterStructure) where.feeStructureId = filterStructure;
  if (filterYear || filterTerm) {
    where.feeStructure = {};
    if (filterYear) where.feeStructure.academicYear = filterYear;
    if (filterTerm) where.feeStructure.term = filterTerm;
  }
  if (filterClass) studentWhere.classId = filterClass;
  if (search) {
    studentWhere.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { surname: { contains: search, mode: "insensitive" } },
      { parent: { is: { name: { contains: search, mode: "insensitive" } } } },
      { parent: { is: { surname: { contains: search, mode: "insensitive" } } } },
      { parent: { is: { phone: { contains: search, mode: "insensitive" } } } },
    ];
  }
  if (Object.keys(studentWhere).length > 0) where.student = { is: studentWhere };

  const [bills, count, classes, academicYears, statusCounts, discountCount, issueCount, outstandingAggregate] = await Promise.all([
    prisma.studentBill.findMany({
      where,
      include: {
        student: {
          select: {
            name: true,
            surname: true,
            img: true,
            class: { select: { id: true, name: true } },
            parent: { select: { name: true, surname: true, phone: true, email: true } },
          },
        },
        feeStructure: {
          select: { id: true, title: true, term: true, academicYear: true },
        },
        payments: {
          where: { status: "CONFIRMED" },
          orderBy: { paymentDate: "desc" },
          take: 1,
          select: { paymentDate: true, amount: true, receiptNumber: true },
        },
        discounts: {
          where: { status: "ACTIVE" },
          select: { id: true, type: true, description: true },
          take: 1,
        },
        financeQueries: {
          where: { status: { in: ["OPEN", "IN_REVIEW"] } },
          select: { id: true, reason: true, status: true },
          take: 1,
        },
      },
      orderBy: [
        { status: "asc" },
        { balance: "desc" },
        { updatedAt: "desc" },
      ],
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (page - 1),
    }),
    prisma.studentBill.count({ where }),
    prisma.class.findMany({ where: { schoolId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.feeStructure.findMany({
      where: { schoolId },
      distinct: ["academicYear"],
      orderBy: { academicYear: "desc" },
      select: { academicYear: true },
    }),
    prisma.studentBill.groupBy({
      by: ["status"],
      where: { schoolId },
      _count: { _all: true },
    }),
    prisma.studentBill.count({
      where: { schoolId, discounts: { some: { status: "ACTIVE" } } },
    }),
    prisma.studentBill.count({
      where: { schoolId, financeQueries: { some: { status: { in: ["OPEN", "IN_REVIEW"] } } } },
    }),
    prisma.studentBill.aggregate({
      where: { schoolId, status: { in: ["UNPAID", "PARTIAL"] } },
      _sum: { balance: true },
    }),
  ]);

  const sortedClasses = classes.sort((a, b) => classSortKey(a.name) - classSortKey(b.name) || a.name.localeCompare(b.name));
  const statusCountMap = Object.fromEntries(statusCounts.map((row) => [row.status, row._count._all])) as Record<string, number>;
  const totalOutstanding = outstandingAggregate._sum.balance ?? 0;

  const baseParams = {
    search,
    classId: filterClass,
    term: filterTerm,
    year: filterYear,
    balance: filterBalance,
    structureId: filterStructure,
  };

  const statusCards = [
    { label: "Unpaid", count: statusCountMap.UNPAID ?? 0, status: "UNPAID", tone: BILL_STATUS_STYLES.UNPAID },
    { label: "Part paid", count: statusCountMap.PARTIAL ?? 0, status: "PARTIAL", tone: BILL_STATUS_STYLES.PARTIAL },
    { label: "Paid", count: statusCountMap.PAID ?? 0, status: "PAID", tone: BILL_STATUS_STYLES.PAID },
    { label: "Overpaid", count: statusCountMap.OVERPAID ?? 0, status: "OVERPAID", tone: BILL_STATUS_STYLES.OVERPAID },
    { label: "Waived", count: statusCountMap.WAIVED ?? 0, status: "WAIVED", tone: BILL_STATUS_STYLES.WAIVED },
    { label: "Discount", count: discountCount, status: "DISCOUNT", tone: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" } },
    { label: "Payment issue", count: issueCount, status: "ISSUE", tone: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" } },
  ];

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50">
              <FileText size={20} className="text-emerald-700" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Student fee status</p>
              <h1 className="mt-1 text-xl font-black tracking-tight text-gray-900">Bursar student collection list</h1>
              <p className="mt-1 max-w-2xl text-sm font-semibold text-gray-500">
                Search every student bill, see parent contacts, last payment, payment state, and the next action without leaving the finance source of truth.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[360px]">
            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Filtered records</p>
              <p className="mt-1 text-2xl font-black text-gray-900">{count}</p>
            </div>
            <div className="rounded-2xl bg-rose-50 p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-rose-500">Outstanding</p>
              <p className="mt-1 text-lg font-black text-rose-700">{formatGHS(totalOutstanding)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {statusCards.map((card) => (
          <Link
            key={card.status}
            href={buildQuery({ ...baseParams, status: card.status })}
            className={`rounded-2xl border p-4 text-center transition hover:shadow-sm ${card.tone.bg} ${card.tone.border} ${filterStatus === card.status ? "ring-2 ring-emerald-400" : ""}`}
          >
            <p className={`text-2xl font-black leading-none ${card.tone.text}`}>{card.count}</p>
            <p className={`mt-1 text-[10px] font-black uppercase tracking-wider ${card.tone.text} opacity-75`}>{card.label}</p>
          </Link>
        ))}
        <Link
          href={buildQuery({ ...baseParams, status: undefined })}
          className={`rounded-2xl border border-gray-100 bg-white p-4 text-center transition hover:shadow-sm ${!filterStatus ? "ring-2 ring-emerald-400" : ""}`}
        >
          <p className="text-2xl font-black leading-none text-gray-900">{Object.values(statusCountMap).reduce((sum, item) => sum + item, 0)}</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-gray-400">All</p>
        </Link>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-gray-400">
          <SlidersHorizontal size={14} /> Search and filter
        </div>
        <form className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
          <div className="relative xl:col-span-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              name="search"
              defaultValue={search ?? ""}
              placeholder="Search student, parent, phone..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm font-semibold text-gray-700 outline-none transition focus:border-emerald-400"
            />
          </div>

          <select name="status" defaultValue={filterStatus ?? ""} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-600 outline-none focus:border-emerald-400">
            <option value="">All statuses</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIAL">Part paid</option>
            <option value="PAID">Paid</option>
            <option value="OVERPAID">Overpaid</option>
            <option value="DISCOUNT">Scholarship/Discount</option>
            <option value="ISSUE">Payment issue</option>
            <option value="WAIVED">Waived</option>
          </select>

          <select name="classId" defaultValue={filterClass ?? ""} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-600 outline-none focus:border-emerald-400">
            <option value="">All classes</option>
            {sortedClasses.map((klass) => <option key={klass.id} value={klass.id}>{klass.name}</option>)}
          </select>

          <select name="term" defaultValue={filterTerm ?? ""} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-600 outline-none focus:border-emerald-400">
            <option value="">All terms</option>
            {TERMS.map((term) => <option key={term} value={term}>{TERM_LABELS[term]}</option>)}
          </select>

          <select name="year" defaultValue={filterYear ?? ""} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-600 outline-none focus:border-emerald-400">
            <option value="">All years</option>
            {academicYears.map((item) => <option key={item.academicYear} value={item.academicYear}>{item.academicYear}</option>)}
          </select>

          <select name="balance" defaultValue={filterBalance ?? ""} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-600 outline-none focus:border-emerald-400">
            <option value="">Any balance</option>
            <option value="OUTSTANDING">Has balance</option>
            <option value="SETTLED">Settled / waived</option>
            <option value="OVERPAID">Overpaid</option>
          </select>

          {filterStructure && <input type="hidden" name="structureId" value={filterStructure} />}

          <div className="flex gap-2 xl:col-span-7">
            <button type="submit" className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-800">
              Apply filters
            </button>
            <Link href="/list/finance/bills" className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-black text-gray-600 transition hover:bg-gray-200">
              Clear
            </Link>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">Student fee records</p>
            <p className="mt-0.5 text-sm font-semibold text-gray-500">{count} result{count === 1 ? "" : "s"} in the current view</p>
          </div>
          <Link href="/list/finance/payments" className="text-sm font-black text-emerald-700 hover:text-emerald-900">
            View payments
          </Link>
        </div>

        {bills.length === 0 ? (
          <div className="py-16 text-center">
            <FileText size={28} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-bold text-gray-400">No student fee record matches these filters.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[1120px]">
                <thead className="bg-gray-50/80">
                  <tr>
                    {[
                      "Student",
                      "Class / term",
                      "Total bill",
                      "Paid",
                      "Balance",
                      "Last payment",
                      "Parent / guardian",
                      "Status",
                      "Action",
                    ].map((heading) => (
                      <th key={heading} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-gray-400">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {bills.map((bill) => {
                    const hasOpenIssue = bill.financeQueries.length > 0;
                    const hasActiveDiscount = bill.discounts.length > 0;
                    const meta = statusMeta({ status: bill.status, hasActiveDiscount, hasOpenIssue });
                    const lastPayment = bill.payments[0];
                    const parent = bill.student.parent;
                    const canRecordPayment = bill.status !== "PAID" && bill.status !== "WAIVED";

                    return (
                      <tr key={bill.id} className="hover:bg-emerald-50/30">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-50 text-sm font-black text-emerald-700">
                              {bill.student.img ? (
                                <Image unoptimized src={bill.student.img} alt="" width={40} height={40} className="h-full w-full object-cover" />
                              ) : `${bill.student.name[0] ?? ""}${bill.student.surname[0] ?? ""}`}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-gray-900">{bill.student.surname} {bill.student.name}</p>
                              <p className="truncate text-xs font-semibold text-gray-400">{bill.feeStructure.title}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm font-bold text-gray-600">
                          <p>{bill.student.class?.name ?? "No class"}</p>
                          <p className="text-xs font-semibold text-gray-400">{TERM_LABELS[bill.feeStructure.term]} · {bill.feeStructure.academicYear}</p>
                        </td>
                        <td className="px-4 py-4 text-sm font-black text-gray-800">{formatGHS(bill.totalAmount)}</td>
                        <td className="px-4 py-4 text-sm font-black text-emerald-700">{formatGHS(bill.amountPaid)}</td>
                        <td className="px-4 py-4 text-sm font-black text-rose-600">{formatGHS(bill.balance)}</td>
                        <td className="px-4 py-4 text-sm font-bold text-gray-600">
                          <p>{formatDate(lastPayment?.paymentDate)}</p>
                          {lastPayment && <p className="text-xs font-semibold text-gray-400">{formatGHS(lastPayment.amount)}</p>}
                        </td>
                        <td className="px-4 py-4 text-sm font-bold text-gray-600">
                          {parent ? (
                            <div>
                              <p>{parent.name} {parent.surname}</p>
                              <p className="text-xs font-semibold text-gray-400">{parent.phone || parent.email || "No contact saved"}</p>
                            </div>
                          ) : <span className="text-xs font-black text-rose-500">No guardian linked</span>}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${meta.tone}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Link href={`/list/finance/bills/${bill.id}`} className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 hover:bg-gray-50">
                              Open
                            </Link>
                            {canRecordPayment && (
                              <Link href={`/list/finance/bills/${bill.id}/record-payment`} className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white hover:bg-emerald-800">
                                Pay
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-gray-50 xl:hidden">
              {bills.map((bill) => {
                const hasOpenIssue = bill.financeQueries.length > 0;
                const hasActiveDiscount = bill.discounts.length > 0;
                const meta = statusMeta({ status: bill.status, hasActiveDiscount, hasOpenIssue });
                const lastPayment = bill.payments[0];
                const parent = bill.student.parent;
                const canRecordPayment = bill.status !== "PAID" && bill.status !== "WAIVED";

                return (
                  <div key={bill.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-50 text-sm font-black text-emerald-700">
                        {bill.student.img ? (
                          <Image unoptimized src={bill.student.img} alt="" width={44} height={44} className="h-full w-full object-cover" />
                        ) : `${bill.student.name[0] ?? ""}${bill.student.surname[0] ?? ""}`}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-black text-gray-900">{bill.student.surname} {bill.student.name}</p>
                            <p className="text-xs font-semibold text-gray-400">{bill.student.class?.name ?? "No class"} · {TERM_LABELS[bill.feeStructure.term]} {bill.feeStructure.academicYear}</p>
                          </div>
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${meta.tone}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-semibold text-gray-500">{bill.feeStructure.title}</p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-[11px] font-black uppercase text-gray-400">Total</p>
                        <p className="mt-1 text-sm font-black text-gray-900">{formatGHS(bill.totalAmount)}</p>
                      </div>
                      <div className="rounded-xl bg-emerald-50 p-3">
                        <p className="text-[11px] font-black uppercase text-emerald-500">Paid</p>
                        <p className="mt-1 text-sm font-black text-emerald-700">{formatGHS(bill.amountPaid)}</p>
                      </div>
                      <div className="rounded-xl bg-rose-50 p-3">
                        <p className="text-[11px] font-black uppercase text-rose-500">Balance</p>
                        <p className="mt-1 text-sm font-black text-rose-700">{formatGHS(bill.balance)}</p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border border-gray-100 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Parent / guardian</p>
                          {parent ? (
                            <p className="mt-0.5 text-sm font-bold text-gray-700">{parent.name} {parent.surname}</p>
                          ) : <p className="mt-0.5 text-sm font-bold text-rose-600">No guardian linked</p>}
                        </div>
                        {parent?.phone && (
                          <a href={`tel:${parent.phone}`} className="inline-flex items-center gap-1 text-xs font-black text-emerald-700">
                            <Phone size={13} /> {parent.phone}
                          </a>
                        )}
                      </div>
                      <div className="mt-3 flex flex-col gap-1 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs font-semibold text-gray-500">Last payment: <span className="font-black text-gray-700">{formatDate(lastPayment?.paymentDate)}</span></p>
                        {lastPayment && <p className="text-xs font-black text-emerald-700">{formatGHS(lastPayment.amount)}</p>}
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <Link href={`/list/finance/bills/${bill.id}`} className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-black text-gray-700 hover:bg-gray-50">
                        Open <ChevronRight size={13} />
                      </Link>
                      {canRecordPayment && (
                        <Link href={`/list/finance/bills/${bill.id}/record-payment`} className="flex flex-1 items-center justify-center rounded-xl bg-emerald-700 px-3 py-2.5 text-xs font-black text-white hover:bg-emerald-800">
                          Record payment
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="border-t border-gray-100">
          <Pagination page={page} count={count} />
        </div>
      </div>
    </div>
  );
};

export default BillsPage;
