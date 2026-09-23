import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  Mail,
  Phone,
  Receipt,
  RotateCcw,
  ShieldAlert,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { FEE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS, formatGHS } from "@/src/lib/constants/finance";
import WelcomeBanner from "@/src/components/WelcomeBanner";
import { formatTitledFirstName } from "@/src/lib/format-role-name";
import { getBursarMoneyPulse } from "@/src/lib/services/bursar-money-pulse";
import {
  type ArrearsBillStatusFilter,
  type ArrearsPriority,
  getBursarArrearsFollowUp,
} from "@/src/lib/services/bursar-arrears";
import type { FeeCategory } from "@/src/generated/prisma";

export const dynamic = "force-dynamic";

const FEE_CATEGORIES = [
  "TUITION",
  "LEVY",
  "EXAM",
  "FEEDING",
  "TRANSPORT",
  "UNIFORM",
  "LIBRARY",
  "SPORTS",
  "OTHER",
] as const satisfies readonly FeeCategory[];

const priorityStyles: Record<ArrearsPriority, string> = {
  Critical: "bg-rose-50 text-rose-700 border-rose-200",
  High: "bg-amber-50 text-amber-700 border-amber-200",
  Medium: "bg-blue-50 text-blue-700 border-blue-200",
  Low: "bg-gray-50 text-gray-600 border-gray-200",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseClassId(value: string | string[] | undefined) {
  const parsed = Number(firstParam(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseMinimumBalance(value: string | string[] | undefined) {
  const parsed = Number(firstParam(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseStatus(value: string | string[] | undefined): ArrearsBillStatusFilter | null {
  const status = firstParam(value);
  return status === "UNPAID" || status === "PARTIAL" || status === "OVERDUE" ? status : null;
}

function parseFeeCategory(value: string | string[] | undefined): FeeCategory | null {
  const category = firstParam(value);
  return FEE_CATEGORIES.includes(category as FeeCategory) ? (category as FeeCategory) : null;
}

function shortDate(date: Date | null) {
  if (!date) return "No date set";
  return date.toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" });
}

const BursarPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) => {
  const { userId, role, schoolId } = await requirePageSession(["admin", "bursar"]);
  const bursarProfile = role === "bursar"
    ? await prisma.bursar.findFirst({
        where: { id: userId, schoolId, status: "ACTIVE" },
        select: { name: true, surname: true, sex: true },
      })
    : null;
  const bursarGreetingName = formatTitledFirstName(bursarProfile, role === "bursar" ? "Bursar" : "Admin");
  const arrearsClassId = parseClassId(searchParams.arrearsClassId);
  const arrearsStatus = parseStatus(searchParams.arrearsStatus);
  const arrearsMinBalance = parseMinimumBalance(searchParams.arrearsMinBalance);
  const arrearsFeeCategory = parseFeeCategory(searchParams.arrearsFeeCategory);

  const [moneyPulse, arrears] = await Promise.all([
    getBursarMoneyPulse(schoolId),
    getBursarArrearsFollowUp(schoolId, {
      limit: 12,
      classId: arrearsClassId,
      billStatus: arrearsStatus,
      minBalance: arrearsMinBalance,
      feeCategory: arrearsFeeCategory,
    }),
  ]);

  const todayLabel = moneyPulse.date.toLocaleDateString("en-GH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const classOptions = moneyPulse.collectionByClass.filter((item) => item.billCount > 0 || item.outstanding > 0);
  const selectedClassOption = classOptions.find((item) => item.classId === arrearsClassId);
  const activeFilterCount = [arrearsClassId, arrearsStatus, arrearsMinBalance, arrearsFeeCategory].filter(Boolean).length;
  const moneyPulseCards = [
    {
      label: "Received today",
      value: formatGHS(moneyPulse.amountReceivedToday),
      sub: `${moneyPulse.paymentsReceivedToday} confirmed payment${moneyPulse.paymentsReceivedToday === 1 ? "" : "s"}`,
      href: "/list/finance/payments?status=CONFIRMED",
      icon: <TrendingUp size={18} />,
      color: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Pending confirmations",
      value: moneyPulse.pendingConfirmationCount,
      sub: "Transfers or proof needing review",
      href: "/list/finance/payments?status=PENDING",
      icon: <Clock size={18} />,
      color: "bg-amber-50 text-amber-700",
    },
    {
      label: "Receipts issued",
      value: moneyPulse.receiptsIssuedToday,
      sub: "Confirmed receipts today",
      href: "/list/finance/payments?status=CONFIRMED",
      icon: <Receipt size={18} />,
      color: "bg-blue-50 text-blue-700",
    },
    {
      label: "Corrections / reversals",
      value: moneyPulse.reversalCountToday + moneyPulse.correctionCountToday,
      sub: `${moneyPulse.reversalCountToday} reversal${moneyPulse.reversalCountToday === 1 ? "" : "s"} - ${moneyPulse.correctionCountToday} correction${moneyPulse.correctionCountToday === 1 ? "" : "s"}`,
      href: "/list/finance/corrections",
      icon: <RotateCcw size={18} />,
      color: "bg-rose-50 text-rose-700",
    },
  ];
  const arrearsCards = [
    {
      label: "Total owing",
      value: formatGHS(arrears.summary.totalOwed),
      sub: `${arrears.summary.totalStudents} student${arrears.summary.totalStudents === 1 ? "" : "s"} owing`,
      tone: "bg-slate-50 text-slate-800",
    },
    {
      label: "Overdue students",
      value: arrears.summary.overdueStudents,
      sub: "Bills past due date",
      tone: "bg-rose-50 text-rose-700",
    },
    {
      label: "Critical follow-ups",
      value: arrears.summary.byPriority.Critical,
      sub: "High risk arrears",
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Part-paid students",
      value: arrears.summary.partPaidStudents,
      sub: "Paid some, still owing",
      tone: "bg-blue-50 text-blue-700",
    },
  ];

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">
      <WelcomeBanner
        role="bursar"
        name={bursarGreetingName}
        subtitle="Finance overview - manage fees, bills, payments, and arrears follow-up"
        tag={`${new Date().getFullYear()} Financial Year`}
      />

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Today&apos;s money pulse</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-gray-900">{todayLabel}</h2>
            <p className="mt-1 max-w-2xl text-sm font-semibold text-gray-500">
              Daily finance control for collections, receipts, corrections, and parent payment issues.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={`/api/finance/reports/daily?date=${moneyPulse.date.toISOString().split("T")[0]}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800"
            >
              <FileText size={15} /> Daily report
            </a>
            <a
              href={`/api/finance/reports/weekly?date=${moneyPulse.date.toISOString().split("T")[0]}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-800 transition hover:bg-slate-50"
            >
              <FileText size={15} /> Weekly summary
            </a>
          </div>
        </div>

        {(moneyPulse.quietFinanceDay || moneyPulse.isWeekend) && (
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
            {moneyPulse.isWeekend
              ? "Weekend finance activity may be quiet. Use the term collection sections below for the full picture."
              : "No payment activity has been recorded today yet. Edujay will surface confirmations and urgent issues here once they appear."}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {moneyPulseCards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="group rounded-2xl border border-gray-100 bg-gray-50/60 p-4 transition hover:border-gray-200 hover:bg-white hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wide text-gray-400">{card.label}</p>
                  <p className="mt-2 truncate text-2xl font-black leading-none text-gray-900">{card.value}</p>
                  <p className="mt-1 text-xs font-semibold text-gray-500">{card.sub}</p>
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.color}`}>
                  {card.icon}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {moneyPulse.methodBreakdown.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {moneyPulse.methodBreakdown.map((method) => (
              <span key={method.method} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
                {PAYMENT_METHOD_LABELS[method.method] ?? method.method}: {formatGHS(method.amount)} - {method.count}
              </span>
            ))}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-gray-900">Low collection classes</h3>
                <p className="text-xs font-semibold text-gray-400">Classes needing fee follow-up.</p>
              </div>
              <ShieldAlert size={18} className="text-amber-500" />
            </div>
            <div className="mt-3 space-y-2">
              {moneyPulse.lowCollectionClasses.length === 0 ? (
                <p className="rounded-xl bg-gray-50 p-4 text-sm font-semibold text-gray-400">No class collection concern yet.</p>
              ) : moneyPulse.lowCollectionClasses.map((item) => (
                <Link key={item.classId} href={`/list/finance/bills?classId=${item.classId}`} className="block rounded-xl border border-gray-100 p-3 transition hover:bg-amber-50/50">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-gray-800">{item.className}</p>
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">{item.collectionRate}%</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-gray-500">
                    {formatGHS(item.outstanding)} outstanding - {formatGHS(item.collectedToday)} today
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-gray-900">Urgent payment issues</h3>
                <p className="text-xs font-semibold text-gray-400">Queries, overpayments, and highest balances.</p>
              </div>
              <AlertCircle size={18} className="text-rose-500" />
            </div>
            <div className="mt-3 space-y-2">
              {moneyPulse.urgentIssues.length === 0 ? (
                <p className="rounded-xl bg-gray-50 p-4 text-sm font-semibold text-gray-400">No urgent payment issue waiting.</p>
              ) : moneyPulse.urgentIssues.slice(0, 5).map((issue) => (
                <Link key={issue.id} href={issue.href} className="block rounded-xl border border-gray-100 p-3 transition hover:bg-rose-50/50">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-black text-gray-800">{issue.title}</p>
                    <span className="shrink-0 text-xs font-black text-rose-600">{formatGHS(Math.abs(issue.amount))}</span>
                  </div>
                  <p className="mt-1 truncate text-xs font-semibold text-gray-500">{issue.className} - {issue.detail}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-gray-900">Recent activity today</h3>
                <p className="text-xs font-semibold text-gray-400">Latest payments and status changes.</p>
              </div>
              <Wallet size={18} className="text-emerald-600" />
            </div>
            <div className="mt-3 space-y-2">
              {moneyPulse.recentPayments.length === 0 ? (
                <p className="rounded-xl bg-gray-50 p-4 text-sm font-semibold text-gray-400">No payment activity today.</p>
              ) : moneyPulse.recentPayments.map((payment) => (
                <Link key={payment.id} href={`/list/finance/receipts?search=${encodeURIComponent(payment.receiptNumber)}`} className="block rounded-xl border border-gray-100 p-3 transition hover:bg-emerald-50/50">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-black text-gray-800">
                      {payment.studentBill.student.name} {payment.studentBill.student.surname}
                    </p>
                    <span className="shrink-0 text-xs font-black text-emerald-700">{formatGHS(payment.amount)}</span>
                  </div>
                  <p className="mt-1 truncate text-xs font-semibold text-gray-500">
                    {payment.receiptNumber} - {PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod} - {payment.status.toLowerCase()}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Fee collection by class</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-gray-900">Class collection health</h2>
            <p className="mt-1 max-w-2xl text-sm font-semibold text-gray-500">
              See expected fees, collected money, outstanding balances, and collection rate for each class.
            </p>
          </div>
          <Link
            href="/list/finance/bills"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-black text-gray-700 transition hover:bg-gray-50"
          >
            View all bills <ChevronRight size={15} />
          </Link>
        </div>

        {moneyPulse.collectionByClass.length === 0 ? (
          <div className="mt-4 rounded-xl bg-gray-50 p-5 text-sm font-semibold text-gray-500">
            No generated class bills yet. Publish fee structures and generate student bills to see collection health here.
          </div>
        ) : (
          <>
            <div className="mt-4 hidden overflow-hidden rounded-2xl border border-gray-100 md:block">
              <table className="w-full min-w-[760px]">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-gray-400">Class</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-gray-400">Expected</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-gray-400">Collected</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-gray-400">Outstanding</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-gray-400">Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-gray-400">Follow-up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {moneyPulse.collectionByClass.map((item) => {
                    const weak = item.collectionRate < 50 && item.outstanding > 0;
                    const healthy = item.collectionRate >= 80;
                    return (
                      <tr key={item.classId} className="hover:bg-blue-50/30">
                        <td className="px-4 py-3">
                          <p className="text-sm font-black text-gray-800">{item.className}</p>
                          <p className="text-xs font-semibold text-gray-400">{item.billCount} bill{item.billCount === 1 ? "" : "s"} - {item.unpaidBills} pending</p>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-700">{formatGHS(item.expected)}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-emerald-700">{formatGHS(item.collected)}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-rose-600">{formatGHS(item.outstanding)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-black ${weak ? "bg-rose-50 text-rose-700" : healthy ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {item.collectionRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/list/finance/bills?classId=${item.classId}`} className="text-xs font-black text-blue-700 hover:text-blue-900">
                            Review
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:hidden">
              {moneyPulse.collectionByClass.map((item) => {
                const weak = item.collectionRate < 50 && item.outstanding > 0;
                const healthy = item.collectionRate >= 80;
                return (
                  <Link key={item.classId} href={`/list/finance/bills?classId=${item.classId}`} className="rounded-2xl border border-gray-100 p-4 transition hover:bg-blue-50/40">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-gray-900">{item.className}</p>
                        <p className="mt-0.5 text-xs font-semibold text-gray-400">{item.billCount} bills - {item.unpaidBills} pending</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${weak ? "bg-rose-50 text-rose-700" : healthy ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {item.collectionRate}%
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Expected</p>
                        <p className="mt-1 text-sm font-black text-gray-800">{formatGHS(item.expected)}</p>
                      </div>
                      <div className="rounded-xl bg-emerald-50 p-3">
                        <p className="text-[11px] font-black uppercase tracking-wide text-emerald-500">Collected</p>
                        <p className="mt-1 text-sm font-black text-emerald-700">{formatGHS(item.collected)}</p>
                      </div>
                      <div className="rounded-xl bg-rose-50 p-3">
                        <p className="text-[11px] font-black uppercase tracking-wide text-rose-500">Outstanding</p>
                        <p className="mt-1 text-sm font-black text-rose-700">{formatGHS(item.outstanding)}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-600">Arrears and follow-up</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-gray-900">Who needs payment follow-up today</h2>
            <p className="mt-1 max-w-2xl text-sm font-semibold text-gray-500">
              Built from unpaid and part-paid student bills only. Paid, waived, and zero-balance bills are excluded.
            </p>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
            {activeFilterCount > 0 ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active` : "Showing highest priority first"}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {arrearsCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-gray-400">{card.label}</p>
              <p className="mt-2 truncate text-2xl font-black leading-none text-gray-900">{card.value}</p>
              <p className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-black ${card.tone}`}>{card.sub}</p>
            </div>
          ))}
        </div>

        <form className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-3" action="/bursar">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-gray-400">
            <Filter size={14} /> Simple filters
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-black text-gray-500">Class</span>
              <select name="arrearsClassId" defaultValue={arrearsClassId ?? ""} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 outline-none focus:border-blue-400">
                <option value="">All classes</option>
                {classOptions.map((item) => (
                  <option key={item.classId} value={item.classId}>{item.className}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-black text-gray-500">Status</span>
              <select name="arrearsStatus" defaultValue={arrearsStatus ?? ""} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 outline-none focus:border-blue-400">
                <option value="">Unpaid and part-paid</option>
                <option value="UNPAID">Unpaid only</option>
                <option value="PARTIAL">Part-paid only</option>
                <option value="OVERDUE">Overdue only</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-black text-gray-500">Minimum balance</span>
              <input
                type="number"
                min="0"
                step="0.01"
                name="arrearsMinBalance"
                defaultValue={arrearsMinBalance ?? ""}
                placeholder="Any amount"
                className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 outline-none focus:border-blue-400"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-black text-gray-500">Fee type</span>
              <select name="arrearsFeeCategory" defaultValue={arrearsFeeCategory ?? ""} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 outline-none focus:border-blue-400">
                <option value="">All fee types</option>
                {FEE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{FEE_CATEGORY_LABELS[category]}</option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button type="submit" className="h-11 flex-1 rounded-xl bg-slate-900 px-4 text-sm font-black text-white transition hover:bg-slate-800">
                Apply
              </button>
              <Link href="/bursar" className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 px-4 text-sm font-black text-gray-600 transition hover:bg-white">
                Clear
              </Link>
            </div>
          </div>
          {(selectedClassOption || arrearsStatus || arrearsMinBalance || arrearsFeeCategory) && (
            <p className="mt-3 text-xs font-semibold text-gray-500">
              Current view: {selectedClassOption?.className ?? "all classes"} - {arrearsStatus ? arrearsStatus.toLowerCase().replace("_", " ") : "all owing bills"} - {arrearsFeeCategory ? FEE_CATEGORY_LABELS[arrearsFeeCategory] : "all fee types"}
            </p>
          )}
        </form>

        {arrears.items.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
            <p className="text-sm font-black text-gray-700">No arrears match this view.</p>
            <p className="mt-1 text-sm font-semibold text-gray-400">Paid, waived, and zero-balance bills are intentionally hidden from follow-up.</p>
          </div>
        ) : (
          <>
            <div className="mt-4 hidden overflow-hidden rounded-2xl border border-gray-100 lg:block">
              <table className="w-full min-w-[980px]">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-gray-400">Student</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-gray-400">Bill</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-gray-400">Owing</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-gray-400">Overdue</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-gray-400">Parent contact</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-gray-400">Last reminder</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-gray-400">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {arrears.items.map((item) => (
                    <tr key={item.billId} className="hover:bg-rose-50/30">
                      <td className="px-4 py-3">
                        <p className="text-sm font-black text-gray-900">{item.studentName}</p>
                        <p className="text-xs font-semibold text-gray-400">{item.className ?? "No class"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-gray-700">{item.feeTitle}</p>
                        <p className="text-xs font-semibold text-gray-400">{item.feeType} - Due {shortDate(item.dueDate)}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-sm font-black text-rose-700">{formatGHS(item.amountOwed)}</p>
                        <p className="text-xs font-semibold text-gray-400">{item.billStatus === "PARTIAL" ? "Part-paid" : "Unpaid"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${priorityStyles[item.priority]}`}>
                          {item.priority}
                        </span>
                        <p className="mt-1 text-xs font-semibold text-gray-500">
                          {item.isOverdue ? `${item.daysOverdue} day${item.daysOverdue === 1 ? "" : "s"} overdue` : "Not overdue yet"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {item.parentContact ? (
                          <div>
                            <p className="text-sm font-black text-gray-800">{item.parentContact.name}</p>
                            <div className="mt-1 flex flex-col gap-0.5 text-xs font-semibold text-gray-500">
                              {item.parentContact.phone && <span className="inline-flex items-center gap-1"><Phone size={12} /> {item.parentContact.phone}</span>}
                              {item.parentContact.email && <span className="inline-flex items-center gap-1"><Mail size={12} /> {item.parentContact.email}</span>}
                              {!item.parentContact.phone && !item.parentContact.email && <span>No phone or email saved</span>}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm font-bold text-gray-400">No contact saved</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-500">
                        {item.lastReminderSentAt ? shortDate(item.lastReminderSentAt) : "No reminder sent"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={item.href} className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-800">
                          Review bill <ChevronRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 lg:hidden">
              {arrears.items.map((item) => (
                <div key={item.billId} className="rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-gray-900">{item.studentName}</p>
                      <p className="text-xs font-semibold text-gray-400">{item.className ?? "No class"} - {item.feeType}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-black ${priorityStyles[item.priority]}`}>
                      {item.priority}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 min-[430px]:grid-cols-2">
                    <div className="rounded-xl bg-rose-50 p-3">
                      <p className="text-[11px] font-black uppercase tracking-wide text-rose-500">Amount owed</p>
                      <p className="mt-1 text-sm font-black text-rose-700">{formatGHS(item.amountOwed)}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Due status</p>
                      <p className="mt-1 text-sm font-black text-gray-700">
                        {item.isOverdue ? `${item.daysOverdue} day${item.daysOverdue === 1 ? "" : "s"} overdue` : "Not overdue yet"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl bg-gray-50 p-3">
                    <p className="text-xs font-black text-gray-500">Parent contact</p>
                    {item.parentContact ? (
                      <div className="mt-1 text-xs font-semibold text-gray-500">
                        <p className="font-black text-gray-800">{item.parentContact.name}</p>
                        <p>{item.parentContact.phone || item.parentContact.email || "No phone or email saved"}</p>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs font-semibold text-gray-400">No contact saved</p>
                    )}
                  </div>
                  <div className="mt-3 flex flex-col gap-2 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between">
                    <p className="text-xs font-semibold text-gray-400">Last reminder: {item.lastReminderSentAt ? shortDate(item.lastReminderSentAt) : "No reminder sent"}</p>
                    <Link href={item.href} className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-800">
                      Review bill <ChevronRight size={13} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">Quick finance actions</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-gray-900">Move straight to the work</h2>
          </div>
          <p className="text-sm font-semibold text-gray-400">Compact links only. The dashboard stays focused.</p>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "New fee structure", href: "/list/finance/fee-structures/new", icon: <FileText size={16} />, color: "bg-violet-50 text-violet-700 hover:bg-violet-100" },
            { label: "All bills", href: "/list/finance/bills", icon: <Users size={16} />, color: "bg-blue-50 text-blue-700 hover:bg-blue-100" },
            { label: "Receipts", href: "/list/finance/receipts", icon: <Receipt size={16} />, color: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
            { label: "Corrections", href: "/list/finance/corrections", icon: <RotateCcw size={16} />, color: "bg-rose-50 text-rose-700 hover:bg-rose-100" },
            { label: "Reports", href: "/list/finance/reports", icon: <ArrowUpRight size={16} />, color: "bg-amber-50 text-amber-700 hover:bg-amber-100" },
          ].map((action) => (
            <Link key={action.label} href={action.href} className={`inline-flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-black transition ${action.color}`}>
              <span className="inline-flex items-center gap-2">{action.icon}{action.label}</span>
              <ChevronRight size={14} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default BursarPage;
