import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/src/lib/prisma";
import Link from "next/link";
import {
  Wallet, TrendingUp, AlertCircle, CheckCircle2,
  Clock, Users, FileText, ChevronRight, ArrowUpRight,
} from "lucide-react";
import { formatGHS, BILL_STATUS_STYLES } from "@/src/lib/constants/finance";
import WelcomeBanner from "@/src/components/WelcomeBanner";
import EventCalendar from "@/src/components/EventCalendar";
import EventList from "@/src/components/EventList";
import Announcements from "@/src/components/Announcements";

export const dynamic = "force-dynamic";

const BursarPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const { userId, sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (!userId || (role !== "admin" && role !== "bursar")) redirect("/sign-in");

  // ── Key stats ──────────────────────────────────────────────────────────────
  const [
    totalBills,
    unpaidBills,
    partialBills,
    paidBills,
    waivedBills,
    totalStructures,
    publishedStructures,
  ] = await Promise.all([
    prisma.studentBill.count(),
    prisma.studentBill.count({ where: { status: "UNPAID"  } }),
    prisma.studentBill.count({ where: { status: "PARTIAL" } }),
    prisma.studentBill.count({ where: { status: "PAID"    } }),
    prisma.studentBill.count({ where: { status: "WAIVED"  } }),
    prisma.feeStructure.count(),
    prisma.feeStructure.count({ where: { status: "PUBLISHED" } }),
  ]);

  // ── Total collected this calendar year ────────────────────────────────────
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const collectedResult = await prisma.payment.aggregate({
    _sum:  { amount: true },
    where: { status: "CONFIRMED", createdAt: { gte: yearStart } },
  });
  const totalCollected = collectedResult._sum.amount ?? 0;

  // ── Total outstanding ─────────────────────────────────────────────────────
  const outstandingResult = await prisma.studentBill.aggregate({
    _sum:  { balance: true },
    where: { status: { in: ["UNPAID", "PARTIAL"] } },
  });
  const totalOutstanding = outstandingResult._sum.balance ?? 0;

  // ── Recent payments (last 5) ──────────────────────────────────────────────
  const recentPayments = await prisma.payment.findMany({
    where:   { status: "CONFIRMED" },
    include: {
      studentBill: {
        include: {
          student: { select: { name: true, surname: true, class: { select: { name: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take:    3,
  });

  // ── Bills needing attention ───────────────────────────────────────────────
  const urgentBills = await prisma.studentBill.findMany({
    where:   { status: { in: ["UNPAID", "PARTIAL"] } },
    include: {
      student:      { select: { name: true, surname: true, class: { select: { name: true } } } },
      feeStructure: { select: { title: true, term: true, academicYear: true } },
    },
    orderBy: { balance: "desc" },
    take:    3,
  });

  // ── Draft fee structures ──────────────────────────────────────────────────
  const draftStructures = await prisma.feeStructure.findMany({
    where:   { status: "DRAFT" },
    include: { grade: { select: { level: true } } },
    orderBy: { createdAt: "desc" },
    take:    3,
  });

  const termLabels: Record<string, string> = {
    TERM_1: "Term 1", TERM_2: "Term 2", TERM_3: "Term 3",
  };

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">

      {/* ── Welcome banner (full width) ── */}
      <WelcomeBanner
        role="bursar"
        name="Bursar"
        subtitle="Finance overview — manage fees, bills, and payments"
        tag={`${new Date().getFullYear()} Financial Year`}
      />

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