import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import Link from "next/link";
import {
  Wallet, TrendingUp, AlertCircle, CheckCircle2,
  Clock, Users, FileText, ChevronRight, ArrowUpRight,
  Receipt, RotateCcw, ShieldAlert,
} from "lucide-react";
import { formatGHS, BILL_STATUS_STYLES, PAYMENT_METHOD_LABELS } from "@/src/lib/constants/finance";
import WelcomeBanner from "@/src/components/WelcomeBanner";
import EventCalendar from "@/src/components/EventCalendar";
import EventList from "@/src/components/EventList";
import Announcements from "@/src/components/Announcements";
import { formatTitledFirstName } from "@/src/lib/format-role-name";
import { getBursarMoneyPulse } from "@/src/lib/services/bursar-money-pulse";

export const dynamic = "force-dynamic";

const BursarPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const { userId, role, schoolId } = await requirePageSession(["admin", "bursar"]);
  const bursarProfile = role === "bursar"
    ? await prisma.bursar.findFirst({
        where: { id: userId, schoolId, status: "ACTIVE" },
        select: { name: true, surname: true, sex: true },
      })
    : null;
  const bursarGreetingName = formatTitledFirstName(bursarProfile, role === "bursar" ? "Bursar" : "Admin");
  const moneyPulse = await getBursarMoneyPulse(schoolId);

  // ── Key stats ──────────────────────────────────────────────────────────────
  const [billStatusCounts, structureStatusCounts] = await Promise.all([
    prisma.studentBill.groupBy({
      by: ["status"],
      where: { schoolId },
      _count: { _all: true },
    }),
    prisma.feeStructure.groupBy({
      by: ["status"],
      where: { schoolId },
      _count: { _all: true },
    }),
  ]);
  const billCountByStatus = Object.fromEntries(
    billStatusCounts.map((row) => [row.status, row._count._all]),
  ) as Record<string, number>;
  const structureCountByStatus = Object.fromEntries(
    structureStatusCounts.map((row) => [row.status, row._count._all]),
  ) as Record<string, number>;
  const unpaidBills = billCountByStatus.UNPAID ?? 0;
  const partialBills = billCountByStatus.PARTIAL ?? 0;
  const paidBills = billCountByStatus.PAID ?? 0;
  const waivedBills = billCountByStatus.WAIVED ?? 0;
  const totalBills = billStatusCounts.reduce((sum, row) => sum + row._count._all, 0);
  const publishedStructures = structureCountByStatus.PUBLISHED ?? 0;
  const totalStructures = structureStatusCounts.reduce((sum, row) => sum + row._count._all, 0);

  // ── Total collected this calendar year ────────────────────────────────────
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const collectedResult = await prisma.payment.aggregate({
    _sum:  { amount: true },
    where: { schoolId, status: "CONFIRMED", createdAt: { gte: yearStart } },
  });
  const totalCollected = collectedResult._sum.amount ?? 0;

  // ── Total outstanding ─────────────────────────────────────────────────────
  const outstandingResult = await prisma.studentBill.aggregate({
    _sum:  { balance: true },
    where: { schoolId, status: { in: ["UNPAID", "PARTIAL"] } },
  });
  const totalOutstanding = outstandingResult._sum.balance ?? 0;

  // ── Recent payments (last 5) ──────────────────────────────────────────────
  const recentPayments = await prisma.payment.findMany({
    where:   { schoolId, status: "CONFIRMED" },
    select: {
      id: true,
      receiptNumber: true,
      amount: true,
      createdAt: true,
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
    take:    3,
  });

  // ── Bills needing attention ───────────────────────────────────────────────
  const urgentBills = await prisma.studentBill.findMany({
    where:   { schoolId, status: { in: ["UNPAID", "PARTIAL"] } },
    select: {
      id: true,
      balance: true,
      status: true,
      student:      { select: { name: true, surname: true, class: { select: { name: true } } } },
      feeStructure: { select: { title: true, term: true, academicYear: true } },
    },
    orderBy: { balance: "desc" },
    take:    3,
  });

  // ── Draft fee structures ──────────────────────────────────────────────────
  const draftStructures = await prisma.feeStructure.findMany({
    where:   { schoolId, status: "DRAFT" },
    select: {
      id: true,
      title: true,
      term: true,
      academicYear: true,
      grade: { select: { level: true } },
    },
    orderBy: { createdAt: "desc" },
    take:    3,
  });

  const termLabels: Record<string, string> = {
    TERM_1: "Term 1", TERM_2: "Term 2", TERM_3: "Term 3",
  };
  const todayLabel = moneyPulse.date.toLocaleDateString("en-GH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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
      sub: `${moneyPulse.reversalCountToday} reversal${moneyPulse.reversalCountToday === 1 ? "" : "s"} · ${moneyPulse.correctionCountToday} correction${moneyPulse.correctionCountToday === 1 ? "" : "s"}`,
      href: "/list/finance/payments?status=REVERSED",
      icon: <RotateCcw size={18} />,
      color: "bg-rose-50 text-rose-700",
    },
  ];

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">

      {/* ── Welcome banner (full width) ── */}
      <WelcomeBanner
        role="bursar"
        name={bursarGreetingName}
        subtitle="Finance overview — manage fees, bills, and payments"
        tag={`${new Date().getFullYear()} Financial Year`}
      />

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Today&apos;s money pulse</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-gray-900">{todayLabel}</h2>
            <p className="mt-1 max-w-2xl text-sm font-semibold text-gray-500">
              Daily finance control for collections, receipts, corrections, and parent payment issues.
            </p>
          </div>
          <a
            href={`/api/finance/reports/daily?date=${moneyPulse.date.toISOString().split("T")[0]}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800"
          >
            <FileText size={15} /> Daily report
          </a>
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
                {PAYMENT_METHOD_LABELS[method.method] ?? method.method}: {formatGHS(method.amount)} · {method.count}
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
                    {formatGHS(item.outstanding)} outstanding · {formatGHS(item.collectedToday)} today
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
                  <p className="mt-1 truncate text-xs font-semibold text-gray-500">{issue.className} · {issue.detail}</p>
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
                <Link key={payment.id} href={`/list/finance/payments?search=${encodeURIComponent(payment.receiptNumber)}`} className="block rounded-xl border border-gray-100 p-3 transition hover:bg-emerald-50/50">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-black text-gray-800">
                      {payment.studentBill.student.name} {payment.studentBill.student.surname}
                    </p>
                    <span className="shrink-0 text-xs font-black text-emerald-700">{formatGHS(payment.amount)}</span>
                  </div>
                  <p className="mt-1 truncate text-xs font-semibold text-gray-500">
                    {payment.receiptNumber} · {PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod} · {payment.status.toLowerCase()}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
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
                          <p className="text-xs font-semibold text-gray-400">{item.billCount} bill{item.billCount === 1 ? "" : "s"} · {item.unpaidBills} pending</p>
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
                        <p className="mt-0.5 text-xs font-semibold text-gray-400">{item.billCount} bills · {item.unpaidBills} pending</p>
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

      {/* ── Outer two-column layout: main content | sidebar ── */}
      <div className="flex flex-col xl:flex-row gap-4">

        {/* ── LEFT / MAIN COLUMN ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Total Collected",
                value: formatGHS(totalCollected),
                sub:   "This calendar year",
                icon:  <TrendingUp size={18} />,
                color: "bg-emerald-50 text-emerald-600",
                href:  "/list/finance/payments",
              },
              {
                label: "Outstanding",
                value: formatGHS(totalOutstanding),
                sub:   `${unpaidBills + partialBills} bills pending`,
                icon:  <AlertCircle size={18} />,
                color: "bg-rose-50 text-rose-600",
                href:  "/list/finance/bills",
              },
              {
                label: "Bills Paid",
                value: paidBills,
                sub:   `of ${totalBills} total bills`,
                icon:  <CheckCircle2 size={18} />,
                color: "bg-blue-50 text-blue-600",
                href:  "/list/finance/bills",
              },
              {
                label: "Fee Structures",
                value: publishedStructures,
                sub:   `${totalStructures - publishedStructures} still in draft`,
                icon:  <FileText size={18} />,
                color: "bg-violet-50 text-violet-600",
                href:  "/list/finance/fee-structures",
              },
            ].map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow group"
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
                  {s.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-black text-gray-800 leading-none truncate">{s.value}</p>
                  <p className="text-xs text-gray-400 font-medium mt-0.5">{s.label}</p>
                  <p className="text-[10px] text-gray-300 mt-0.5">{s.sub}</p>
                </div>
                <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" />
              </Link>
            ))}
          </div>

          {/* Bill status breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-gray-800">Bill Status Overview</h2>
              <Link href="/list/finance/bills" className="text-xs font-bold text-violet-600 hover:text-violet-700">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { status: "UNPAID",  count: unpaidBills  },
                { status: "PARTIAL", count: partialBills },
                { status: "PAID",    count: paidBills    },
                { status: "WAIVED",  count: waivedBills  },
              ].map(({ status, count }) => {
                const style = BILL_STATUS_STYLES[status];
                return (
                  <div key={status} className={`rounded-xl p-4 border text-center ${style.bg} ${style.border}`}>
                    <p className={`text-2xl font-black leading-none ${style.text}`}>{count}</p>
                    <p className={`text-[10px] font-black uppercase tracking-wider mt-1 ${style.text} opacity-70`}>
                      {style.label}
                    </p>
                  </div>
                );
              })}
            </div>
            {totalBills > 0 && (
              <div className="flex h-2 rounded-full overflow-hidden mt-4 gap-0.5">
                {[
                  { count: unpaidBills,  color: "bg-rose-400"    },
                  { count: partialBills, color: "bg-amber-400"   },
                  { count: paidBills,    color: "bg-emerald-400" },
                  { count: waivedBills,  color: "bg-gray-300"    },
                ].map((s, i) =>
                  s.count > 0 ? (
                    <div key={i} className={`${s.color} h-full rounded-full`} style={{ flex: s.count }} />
                  ) : null
                )}
              </div>
            )}
          </div>

          {/* Recent payments + Urgent bills (two columns on lg+) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Recent payments */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-black text-gray-800">Recent Payments</h2>
                <Link href="/list/finance/payments" className="text-xs font-bold text-violet-600 hover:text-violet-700">
                  View all →
                </Link>
              </div>
              {recentPayments.length === 0 ? (
                <div className="py-10 text-center text-gray-300 font-semibold text-sm">No payments yet</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentPayments.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">
                          {p.studentBill.student?.name} {p.studentBill.student?.surname}
                        </p>
                        <p className="text-[10px] text-gray-400 font-medium">
                          {p.receiptNumber} · {p.studentBill.student?.class?.name}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-emerald-700">{formatGHS(p.amount)}</p>
                        <p className="text-[10px] text-gray-400">
                          {new Date(p.createdAt).toLocaleDateString("en-GH", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Urgent bills + Draft structures */}
            <div className="flex flex-col gap-4">

              {/* Urgent bills */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={14} className="text-rose-500" />
                    <h2 className="text-sm font-black text-gray-800">Highest Outstanding</h2>
                  </div>
                  <Link href="/list/finance/bills?status=UNPAID" className="text-xs font-bold text-rose-500 hover:text-rose-700">
                    View all →
                  </Link>
                </div>
                {urgentBills.length === 0 ? (
                  <div className="py-8 text-center">
                    <CheckCircle2 size={20} className="text-emerald-400 mx-auto mb-1" />
                    <p className="text-xs text-gray-400 font-semibold">All bills are settled</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {urgentBills.map((bill) => (
                      <Link
                        key={bill.id}
                        href={`/list/finance/bills/${bill.id}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-rose-50/40 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800 truncate">
                            {bill.student.name} {bill.student.surname}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {bill.student.class?.name} · {termLabels[bill.feeStructure.term]} {bill.feeStructure.academicYear}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black text-rose-600">{formatGHS(bill.balance)}</p>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg ${BILL_STATUS_STYLES[bill.status].bg} ${BILL_STATUS_STYLES[bill.status].text}`}>
                            {BILL_STATUS_STYLES[bill.status].label}
                          </span>
                        </div>
                        <ChevronRight size={13} className="text-gray-200 group-hover:text-rose-400 transition-colors" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Draft fee structures */}
              {draftStructures.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3.5 border-b border-amber-100">
                    <Clock size={14} className="text-amber-600" />
                    <h2 className="text-sm font-black text-amber-800">Unpublished Fee Structures</h2>
                  </div>
                  <div className="divide-y divide-amber-100">
                    {draftStructures.map((fs) => (
                      <Link
                        key={fs.id}
                        href={`/list/finance/fee-structures/${fs.id}`}
                        className="flex items-center justify-between px-5 py-3 hover:bg-amber-100/50 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-bold text-amber-900">{fs.title}</p>
                          <p className="text-[10px] text-amber-600 font-medium">
                            {fs.grade.level} · {termLabels[fs.term]} · {fs.academicYear}
                          </p>
                        </div>
                        <span className="text-[10px] font-black px-2 py-1 bg-amber-200 text-amber-800 rounded-lg">
                          DRAFT
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">Quick Actions</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "New Fee Structure", href: "/list/finance/fee-structures/new", icon: <FileText size={16} />,     color: "bg-violet-50 text-violet-600 hover:bg-violet-100"   },
                { label: "View All Bills",    href: "/list/finance/bills",              icon: <Users size={16} />,         color: "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"   },
                { label: "All Payments",      href: "/list/finance/payments",           icon: <Wallet size={16} />,        color: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" },
                { label: "Finance Reports",   href: "/list/finance/reports",            icon: <ArrowUpRight size={16} />,  color: "bg-amber-50 text-amber-600 hover:bg-amber-100"      },
              ].map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${a.color}`}
                >
                  {a.icon}
                  {a.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT / SIDEBAR COLUMN ── */}
        <div className="w-full xl:w-80 shrink-0 flex flex-col gap-4">
          <EventCalendar />
          <EventList dateParam={searchParams.date} />
          <Announcements />
        </div>

      </div>
    </div>
  );
};

export default BursarPage;
