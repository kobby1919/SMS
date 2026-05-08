// src/app/(dashboard)/list/finance/payments/page.tsx
 

import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import Link from "next/link";
import {
  Receipt,
  Search,
  TrendingUp,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Download,
  CalendarDays,
} from "lucide-react";
import { formatGHS, PAYMENT_METHOD_LABELS } from "@/src/lib/constants/finance";
import { ITEM_PER_PAGE } from "@/src/lib/settings";
import Pagination from "@/src/components/pagination";
import PaymentReverseButton from "@/src/components/PaymentReverseButton";
import { Prisma } from "@/src/generated/prisma";
import type { PaymentMethod, PaymentStatus } from "@/src/generated/prisma";

export const dynamic = "force-dynamic";

const TERM_LABELS: Record<string, string> = {
  TERM_1: "Term 1",
  TERM_2: "Term 2",
  TERM_3: "Term 3",
};
const PAYMENT_STATUSES = ["CONFIRMED", "REVERSED"] as const;
const PAYMENT_METHODS = [
  "CASH",
  "MTN_MOMO",
  "VODAFONE_CASH",
  "AIRTELTIGO_MONEY",
  "BANK_TRANSFER",
  "CHEQUE",
  "OTHER",
] as const;

function parsePaymentStatus(value: string | undefined): PaymentStatus | undefined {
  return PAYMENT_STATUSES.includes(value as PaymentStatus)
    ? (value as PaymentStatus)
    : undefined;
}

function parsePaymentMethod(value: string | undefined): PaymentMethod | undefined {
  return PAYMENT_METHODS.includes(value as PaymentMethod)
    ? (value as PaymentMethod)
    : undefined;
}

const PaymentsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { schoolId } = await requirePageSession(["admin", "bursar"]);

  const sp = await searchParams;
  const page = sp.page ? parseInt(sp.page) : 1;
  const search = sp.search as string | undefined;
  const filterMethod = parsePaymentMethod(sp.method);
  const filterStatus = parsePaymentStatus(sp.status);
  const dateFrom = sp.from as string | undefined;
  const dateTo = sp.to as string | undefined;

  // ── Build query ────────────────────────────────────────────────────────────
  const where: Prisma.PaymentWhereInput = { schoolId };
  if (filterStatus) where.status = filterStatus;
  if (filterMethod) where.paymentMethod = filterMethod;
  if (dateFrom || dateTo) {
    where.paymentDate = {};
    if (dateFrom) where.paymentDate.gte = new Date(dateFrom);
    if (dateTo) where.paymentDate.lte = new Date(dateTo + "T23:59:59");
  }
  if (search) {
    where.OR = [
      { receiptNumber: { contains: search, mode: "insensitive" } },
      { paidBy: { contains: search, mode: "insensitive" } },
      { referenceNo: { contains: search, mode: "insensitive" } },
      {
        studentBill: {
          student: { name: { contains: search, mode: "insensitive" } },
        },
      },
      {
        studentBill: {
          student: { surname: { contains: search, mode: "insensitive" } },
        },
      },
    ];
  }

  // ── Paginated payments ─────────────────────────────────────────────────────
  const [payments, count] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        studentBill: {
          include: {
            student: {
              select: {
                name: true,
                surname: true,
                class: { select: { name: true } },
              },
            },
            feeStructure: {
              select: { term: true, academicYear: true },
            },
          },
        },
        reversal: {
          select: { reason: true, reversedAt: true, reversedBy: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (page - 1),
    }),
    prisma.payment.count({ where }),
  ]);

  // ── Today's collection ─────────────────────────────────────────────────────
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todayByMethod = await prisma.payment.groupBy({
    by: ["paymentMethod"],
    where: {
      schoolId,
      status: "CONFIRMED",
      paymentDate: { gte: todayStart, lte: todayEnd },
    },
    _count: { _all: true },
    _sum: { amount: true },
  });

  // ── This year's total ──────────────────────────────────────────────────────
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const yearlyByStatus = await prisma.payment.groupBy({
    by: ["status"],
    where: { schoolId, createdAt: { gte: yearStart } },
    _sum: { amount: true },
  });

  const todayCount = todayByMethod.reduce((sum, row) => sum + row._count._all, 0);
  const todayCollected = todayByMethod.reduce(
    (sum, row) => sum + Number(row._sum.amount ?? 0),
    0,
  );
  const todayCashAmt = todayByMethod
    .filter((row) => row.paymentMethod === "CASH")
    .reduce((sum, row) => sum + Number(row._sum.amount ?? 0), 0);
  const todayMomoAmt = todayByMethod
    .filter((row) => ["MTN_MOMO", "VODAFONE_CASH", "AIRTELTIGO_MONEY"].includes(row.paymentMethod))
    .reduce((sum, row) => sum + Number(row._sum.amount ?? 0), 0);
  const todayBankAmt = todayByMethod
    .filter((row) => ["BANK_TRANSFER", "CHEQUE"].includes(row.paymentMethod))
    .reduce((sum, row) => sum + Number(row._sum.amount ?? 0), 0);
  const yearCollected = Number(
    yearlyByStatus.find((row) => row.status === "CONFIRMED")?._sum.amount ?? 0,
  );
  const yearReversed = Number(
    yearlyByStatus.find((row) => row.status === "REVERSED")?._sum.amount ?? 0,
  );

  const today = new Date().toLocaleDateString("en-GH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
              <Receipt size={20} className="text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 tracking-tight">
                Payments
              </h1>
              <p className="text-sm text-gray-400 mt-0.5 font-medium">
                {count} records · {formatGHS(yearCollected)} collected this year
              </p>
            </div>
          </div>
          {/* Export daily report link */}
          <a
            href={`/api/finance/reports/daily?date=${new Date().toISOString().split("T")[0]}`}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 text-white rounded-xl text-sm font-bold hover:bg-gray-900 transition-colors shrink-0"
          >
            <Download size={15} /> Daily Report PDF
          </a>
        </div>
      </div>

      {/* ── Today's Collection Card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <CalendarDays size={16} className="text-emerald-500" />
          <div>
            <h2 className="text-sm font-black text-gray-800">
              Today&apos;s Collection
            </h2>
            <p className="text-[10px] text-gray-400 font-medium">{today}</p>
          </div>
        </div>

        <div className="p-5">
          {/* Big total */}
          <div className="flex items-end gap-3 mb-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                Total Collected Today
              </p>
              <p className="text-4xl font-black text-emerald-700 leading-none">
                {formatGHS(todayCollected)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {todayCount} payment{todayCount !== 1 ? "s" : ""} recorded
              </p>
            </div>
          </div>

          {/* Breakdown by method */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "Cash",
                amount: todayCashAmt,
                color: "bg-emerald-50 text-emerald-700",
                border: "border-emerald-100",
              },
              {
                label: "Mobile Money",
                amount: todayMomoAmt,
                color: "bg-amber-50 text-amber-700",
                border: "border-amber-100",
              },
              {
                label: "Bank / Cheque",
                amount: todayBankAmt,
                color: "bg-indigo-50 text-indigo-700",
                border: "border-indigo-100",
              },
            ].map((s) => (
              <div
                key={s.label}
                className={`rounded-xl p-3 border ${s.color} ${s.border}`}
              >
                <p className="text-base font-black leading-none">
                  {formatGHS(s.amount)}
                </p>
                <p className="text-[9px] font-bold uppercase tracking-wider mt-1 opacity-70">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {/* Bar visualisation */}
          {todayCollected > 0 && (
            <div className="flex h-2 rounded-full overflow-hidden mt-4 gap-0.5">
              {todayCashAmt > 0 && (
                <div
                  className="bg-emerald-400 h-full rounded-full"
                  style={{ flex: todayCashAmt }}
                />
              )}
              {todayMomoAmt > 0 && (
                <div
                  className="bg-amber-400 h-full rounded-full"
                  style={{ flex: todayMomoAmt }}
                />
              )}
              {todayBankAmt > 0 && (
                <div
                  className="bg-indigo-400 h-full rounded-full"
                  style={{ flex: todayBankAmt }}
                />
              )}
            </div>
          )}
          {todayCollected === 0 && (
            <p className="text-xs text-gray-400 text-center pt-2">
              No payments recorded today yet
            </p>
          )}
        </div>
      </div>

      {/* Year stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          {
            label: "Total This Year",
            value: formatGHS(yearCollected),
            sub: `${new Date().getFullYear()} financial year`,
            color: "bg-emerald-50 text-emerald-600",
            icon: <TrendingUp size={16} />,
          },
          {
            label: "Total Reversed",
            value: formatGHS(yearReversed),
            sub: "Voided payments",
            color: "bg-rose-50 text-rose-600",
            icon: <XCircle size={16} />,
          },
          {
            label: "Net Collected",
            value: formatGHS(yearCollected - yearReversed),
            sub: "After reversals",
            color: "bg-indigo-50 text-indigo-600",
            icon: <CheckCircle2 size={16} />,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3"
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}
            >
              {s.icon}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-black text-gray-800 leading-none truncate">
                {s.value}
              </p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                {s.label}
              </p>
              <p className="text-[10px] text-gray-300">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <form className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              name="search"
              defaultValue={search ?? ""}
              placeholder="Receipt no., student, payer…"
              className="pl-8 pr-3 py-2 ring-[1.5px] ring-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:ring-emerald-500 outline-none w-52"
            />
          </div>

          {/* Status */}
          <select
            name="status"
            defaultValue={filterStatus ?? ""}
            className="appearance-none ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 outline-none bg-white"
          >
            <option value="">All Status</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="REVERSED">Reversed</option>
          </select>

          {/* Method */}
          <select
            name="method"
            defaultValue={filterMethod ?? ""}
            className="appearance-none ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 outline-none bg-white"
          >
            <option value="">All Methods</option>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          {/* Date range */}
          <input
            type="date"
            name="from"
            defaultValue={dateFrom ?? ""}
            className="ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 outline-none"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            name="to"
            defaultValue={dateTo ?? ""}
            className="ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 outline-none"
          />

          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors"
          >
            Apply
          </button>
          <Link
            href="/list/finance/payments"
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
          >
            Clear
          </Link>
        </form>
      </div>

      {/* Payments table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">
            {count} payment{count !== 1 ? "s" : ""} found
          </p>
          {search && (
            <p className="text-xs text-gray-400 font-semibold">
              Searching: &ldquo;{search}&rdquo;
            </p>
          )}
        </div>

        {payments.length === 0 ? (
          <div className="py-16 text-center">
            <Receipt size={28} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-400">No payments found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {payments.map((p) => {
              const isReversed = p.status === "REVERSED";
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-4 px-5 py-4 transition-colors
                    ${isReversed ? "bg-rose-50/30" : "hover:bg-gray-50/60"}`}
                >
                  {/* Status icon */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                    ${isReversed ? "bg-rose-100" : "bg-emerald-100"}`}
                  >
                    {isReversed ? (
                      <XCircle size={16} className="text-rose-500" />
                    ) : (
                      <CheckCircle2 size={16} className="text-emerald-600" />
                    )}
                  </div>

                  {/* Receipt + student */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-gray-800">
                        {p.receiptNumber}
                      </p>
                      {isReversed && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 bg-rose-100 text-rose-600 rounded-md">
                          REVERSED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {p.studentBill.student?.surname}{" "}
                      {p.studentBill.student?.name}
                      {" · "}
                      {p.studentBill.student?.class?.name}
                      {" · "}
                      {TERM_LABELS[p.studentBill.feeStructure.term]}{" "}
                      {p.studentBill.feeStructure.academicYear}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Paid by: {p.paidBy}
                      {p.referenceNo && ` · Ref: ${p.referenceNo}`}
                    </p>
                    {isReversed && p.reversal && (
                      <p className="text-[10px] text-rose-500 font-semibold mt-0.5">
                        Reversed: {p.reversal.reason}
                      </p>
                    )}
                  </div>

                  {/* Method */}
                  <div className="hidden sm:block shrink-0 text-right">
                    <p className="text-[10px] text-gray-400 font-semibold">
                      Method
                    </p>
                    <p className="text-xs font-bold text-gray-600">
                      {PAYMENT_METHOD_LABELS[p.paymentMethod] ??
                        p.paymentMethod}
                    </p>
                  </div>

                  {/* Date */}
                  <div className="hidden md:block shrink-0 text-right">
                    <p className="text-[10px] text-gray-400 font-semibold">
                      Date
                    </p>
                    <p className="text-xs font-bold text-gray-600">
                      {new Date(p.paymentDate).toLocaleDateString("en-GH", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-base font-black ${isReversed ? "text-rose-400 line-through" : "text-emerald-700"}`}
                    >
                      {formatGHS(p.amount)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Receipt PDF link */}
                    {!isReversed && (
                      <a
                        href={`/api/finance/receipt?billId=${p.studentBillId}&receiptNumber=${encodeURIComponent(p.receiptNumber)}`}
                        target="_blank"
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                        title="Download receipt"
                      >
                        <Download size={13} />
                      </a>
                    )}

                    {/* Reverse button (admin/bursar, confirmed only) */}
                    {!isReversed && (
                      <PaymentReverseButton
                        paymentId={p.id}
                        receiptNumber={p.receiptNumber}
                        amount={Number(p.amount)}
                      />
                    )}

                    {/* View bill */}
                    <Link
                      href={`/list/finance/bills/${p.studentBillId}`}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                      title="View bill"
                    >
                      <ChevronRight size={13} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="border-t border-gray-100">
          <Pagination page={page} count={count} />
        </div>
      </div>
    </div>
  );
};

export default PaymentsPage;
