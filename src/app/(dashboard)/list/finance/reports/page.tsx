import { requirePageSession } from "@/src/lib/authz";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Receipt,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { formatGHS } from "@/src/lib/constants/finance";
import {
  dailyReportDateInputValue,
  getDailyFinanceReport,
  parseDailyReportDate,
} from "@/src/lib/services/daily-finance-report";
import { getBursarArrearsFollowUp } from "@/src/lib/services/bursar-arrears";
import { getClassCollectionReport } from "@/src/lib/services/class-collection-report";
import { getReceiptIntegrityReport } from "@/src/lib/services/receipt-integrity-report";
import { getCorrectionReversalReport } from "@/src/lib/services/correction-reversal-report";

export const dynamic = "force-dynamic";

const issueTone = {
  rose: "border-rose-100 bg-rose-50 text-rose-700",
  amber: "border-amber-100 bg-amber-50 text-amber-700",
  blue: "border-blue-100 bg-blue-50 text-blue-700",
  gray: "border-gray-100 bg-gray-50 text-gray-600",
};

function dateLabel(date: Date) {
  return date.toLocaleDateString("en-GH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function timeLabel(date: Date) {
  return date.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" });
}

function deltaLabel(value: number, money = false) {
  if (value === 0) return "No change from yesterday";
  const prefix = value > 0 ? "+" : "-";
  const display = money ? formatGHS(Math.abs(value)) : Math.abs(value).toLocaleString("en-GH");
  return `${prefix}${display} vs yesterday`;
}

const FinanceReportsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { schoolId } = await requirePageSession(["admin", "bursar"]);
  const params = await searchParams;
  const selectedDate = parseDailyReportDate(params.date);
  const selectedDateValue = dailyReportDateInputValue(selectedDate);
  const [report, arrearsReport, classCollectionReport, receiptIntegrityReport, correctionReversalReport] = await Promise.all([
    getDailyFinanceReport(schoolId, selectedDate),
    getBursarArrearsFollowUp(schoolId, { asOf: selectedDate, limit: 10 }),
    getClassCollectionReport(schoolId),
    getReceiptIntegrityReport(schoolId),
    getCorrectionReversalReport(schoolId),
  ]);

  const cards = [
    {
      label: "Received today",
      value: formatGHS(report.totalReceived),
      sub: deltaLabel(report.totalDelta, true),
      icon: <Banknote size={18} />,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Confirmed payments",
      value: report.paymentCount,
      sub: deltaLabel(report.paymentDelta),
      icon: <Receipt size={18} />,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      label: "Pending confirmations",
      value: report.pendingConfirmationCount,
      sub: "Needs bursar/admin review",
      icon: <Clock size={18} />,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Corrections and reversals",
      value: report.correctionRequestCount + report.reversalCount,
      sub: `${report.correctionRequestCount} correction${report.correctionRequestCount === 1 ? "" : "s"} - ${report.reversalCount} reversal${report.reversalCount === 1 ? "" : "s"}`,
      icon: <RotateCcw size={18} />,
      tone: "bg-rose-50 text-rose-700",
    },
  ];
  const arrearsCards = [
    {
      label: "Total arrears",
      value: formatGHS(arrearsReport.summary.totalOwed),
      sub: `${arrearsReport.summary.totalStudents} student${arrearsReport.summary.totalStudents === 1 ? "" : "s"} owing`,
      tone: "bg-slate-50 text-slate-800",
    },
    {
      label: "Overdue amount",
      value: formatGHS(arrearsReport.summary.overdueAmount),
      sub: `${arrearsReport.summary.overdueStudents} overdue student${arrearsReport.summary.overdueStudents === 1 ? "" : "s"}`,
      tone: "bg-rose-50 text-rose-700",
    },
    {
      label: "Critical risk",
      value: formatGHS(arrearsReport.summary.criticalAmount),
      sub: `${arrearsReport.summary.byPriority.Critical} critical bill${arrearsReport.summary.byPriority.Critical === 1 ? "" : "s"}`,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "No parent contact",
      value: arrearsReport.summary.noParentContact,
      sub: "Follow-up blocked by missing contact",
      tone: "bg-blue-50 text-blue-700",
    },
  ];
  const topArrearsClasses = arrearsReport.summary.byClass.slice(0, 5);

  return (
    <div className="m-4 mt-0 flex flex-col gap-4">
      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Finance reports</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-gray-900">Daily money report</h1>
            <p className="mt-1 max-w-2xl text-sm font-semibold text-gray-500">
              Owner-ready daily summary of collections, confirmations, receipts, corrections, and finance issues worth attention.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <form action="/list/finance/reports" className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 p-2">
              <CalendarDays size={16} className="text-gray-400" />
              <input
                type="date"
                name="date"
                defaultValue={selectedDateValue}
                className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 outline-none focus:border-blue-400"
              />
              <button type="submit" className="h-9 rounded-lg bg-slate-900 px-3 text-xs font-black text-white transition hover:bg-slate-800">
                View
              </button>
            </form>
            <a
              href={`/api/finance/reports/daily?date=${selectedDateValue}`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white transition hover:bg-blue-800"
            >
              <Download size={15} /> Daily PDF
            </a>
            <a
              href={`/api/finance/reports/weekly?date=${selectedDateValue}`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-white px-4 text-sm font-black text-blue-700 transition hover:bg-blue-50"
            >
              <Download size={15} /> Weekly summary
            </a>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-blue-900">{dateLabel(report.date)}</p>
              <p className="mt-1 text-xs font-semibold text-blue-700">
                This report only highlights finance matters that owners usually need to know. Small noise stays out.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-black text-blue-700">
              <ShieldCheck size={14} /> Same-school finance data only
            </span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const isPositive = card.sub.startsWith("+");
          const isNegative = card.sub.startsWith("-");
          return (
            <div key={card.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wide text-gray-400">{card.label}</p>
                  <p className="mt-2 truncate text-2xl font-black leading-none text-gray-900">{card.value}</p>
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.tone}`}>{card.icon}</div>
              </div>
              <p className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${isPositive ? "bg-emerald-50 text-emerald-700" : isNegative ? "bg-rose-50 text-rose-700" : "bg-gray-50 text-gray-500"}`}>
                {isPositive && <ArrowUpRight size={13} />}
                {isNegative && <ArrowDownRight size={13} />}
                {card.sub}
              </p>
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-600">Arrears report</p>
            <h2 className="mt-1 text-lg font-black text-gray-900">Who is owing and where follow-up must happen</h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-gray-500">
              Built from StudentBill only: unpaid and part-paid bills with balance above zero. Paid, waived, and settled bills are excluded.
            </p>
          </div>
          <Link href="/list/finance/bills" className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-black text-gray-700 transition hover:bg-gray-50">
            Open bill register <ChevronRight size={15} />
          </Link>
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

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.35fr]">
          <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-gray-900">Weakest classes by arrears</h3>
                <p className="mt-1 text-xs font-semibold text-gray-500">Owners can see where collection follow-up is weakest.</p>
              </div>
              <AlertTriangle size={18} className="shrink-0 text-rose-500" />
            </div>
            <div className="mt-3 space-y-2">
              {topArrearsClasses.length === 0 ? (
                <div className="rounded-xl bg-white p-4 text-sm font-bold text-gray-400">No class arrears to report.</div>
              ) : topArrearsClasses.map((klass) => (
                <Link
                  key={klass.classId ?? "NO_CLASS"}
                  href={klass.classId ? `/list/finance/bills?classId=${klass.classId}` : "/list/finance/bills"}
                  className="block rounded-xl border border-gray-100 bg-white p-3 transition hover:bg-rose-50/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-gray-900">{klass.className}</p>
                      <p className="mt-1 text-xs font-semibold text-gray-400">
                        {klass.studentCount} student{klass.studentCount === 1 ? "" : "s"} - {klass.billCount} bill{klass.billCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-black text-rose-700">{formatGHS(klass.amountOwed)}</span>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-gray-500">
                    {formatGHS(klass.overdueAmount)} overdue - {klass.criticalCount} critical bill{klass.criticalCount === 1 ? "" : "s"}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white">
            <div className="border-b border-gray-100 p-4">
              <h3 className="text-sm font-black text-gray-900">Highest priority student follow-ups</h3>
              <p className="mt-1 text-xs font-semibold text-gray-500">Sorted by risk first, then overdue days and amount owed.</p>
            </div>
            {arrearsReport.items.length === 0 ? (
              <div className="p-6 text-center text-sm font-bold text-gray-400">No student arrears need follow-up.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {arrearsReport.items.map((item) => (
                  <Link key={item.billId} href={item.href} className="block p-4 transition hover:bg-gray-50/70">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-gray-900">{item.studentName}</p>
                        <p className="mt-1 text-xs font-semibold text-gray-400">{item.className ?? "No class"} - {item.feeTitle}</p>
                        <p className="mt-1 text-xs font-semibold text-gray-500">
                          {item.parentContact ? `${item.parentContact.name} - ${item.parentContact.phone || item.parentContact.email || "No phone or email saved"}` : "No contact saved"}
                        </p>
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <p className="text-sm font-black text-rose-700">{formatGHS(item.amountOwed)}</p>
                        <p className="mt-1 text-xs font-black text-gray-500">{item.priority} - {item.isOverdue ? `${item.daysOverdue} day${item.daysOverdue === 1 ? "" : "s"} overdue` : "Not overdue"}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Class collection report</p>
            <h2 className="mt-1 text-lg font-black text-gray-900">Which classes are financially healthy</h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-gray-500">
              Class-level view of expected fees, collected amount, outstanding balance, collection rate, and follow-up risk.
            </p>
          </div>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">
            {classCollectionReport.totalClasses} class{classCollectionReport.totalClasses === 1 ? "" : "es"} with bills - {classCollectionReport.weakClassCount} weak
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Expected", value: formatGHS(classCollectionReport.expected), sub: "Total billable fees", tone: "bg-slate-50 text-slate-800" },
            { label: "Collected", value: formatGHS(classCollectionReport.collected), sub: `${classCollectionReport.collectionRate}% collection rate`, tone: "bg-emerald-50 text-emerald-700" },
            { label: "Outstanding", value: formatGHS(classCollectionReport.outstanding), sub: "Still to collect", tone: "bg-rose-50 text-rose-700" },
            { label: "Weak classes", value: classCollectionReport.weakClassCount, sub: "Need owner follow-up", tone: "bg-amber-50 text-amber-700" },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-gray-400">{card.label}</p>
              <p className="mt-2 truncate text-2xl font-black leading-none text-gray-900">{card.value}</p>
              <p className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-black ${card.tone}`}>{card.sub}</p>
            </div>
          ))}
        </div>

        {classCollectionReport.rows.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
            <p className="text-sm font-black text-gray-700">No class collection report yet.</p>
            <p className="mt-1 text-sm font-semibold text-gray-400">Generate student bills first, then Edujay can compare classes properly.</p>
          </div>
        ) : (
          <>
            <div className="mt-4 hidden overflow-hidden rounded-2xl border border-gray-100 lg:block">
              <table className="w-full min-w-[980px]">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-gray-400">Class</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-gray-400">Expected</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-gray-400">Collected</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-gray-400">Outstanding</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-gray-400">Rate</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-gray-400">Risk</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-gray-400">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {classCollectionReport.rows.map((row) => {
                    const riskTone = row.risk === "Critical" ? "bg-rose-50 text-rose-700" : row.risk === "Weak" ? "bg-amber-50 text-amber-700" : row.risk === "Watch" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700";
                    return (
                      <tr key={row.classId} className="hover:bg-indigo-50/30">
                        <td className="px-4 py-3">
                          <p className="text-sm font-black text-gray-900">{row.className}</p>
                          <p className="text-xs font-semibold text-gray-400">{row.studentCount} student{row.studentCount === 1 ? "" : "s"} - {row.billCount} bill{row.billCount === 1 ? "" : "s"}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-700">{formatGHS(row.expected)}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-emerald-700">{formatGHS(row.collected)}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-rose-600">{formatGHS(row.outstanding)}</td>
                        <td className="px-4 py-3 text-right text-sm font-black text-gray-800">{row.collectionRate}%</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-black ${riskTone}`}>{row.risk}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/list/finance/bills?classId=${row.classId}`} className="text-xs font-black text-indigo-700 hover:text-indigo-900">Review bills</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 lg:hidden">
              {classCollectionReport.rows.map((row) => {
                const riskTone = row.risk === "Critical" ? "bg-rose-50 text-rose-700" : row.risk === "Weak" ? "bg-amber-50 text-amber-700" : row.risk === "Watch" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700";
                return (
                  <Link key={row.classId} href={`/list/finance/bills?classId=${row.classId}`} className="rounded-2xl border border-gray-100 p-4 transition hover:bg-indigo-50/40">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-gray-900">{row.className}</p>
                        <p className="mt-1 text-xs font-semibold text-gray-400">{row.studentCount} students - {row.billCount} bills</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${riskTone}`}>{row.risk}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 min-[430px]:grid-cols-3">
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Expected</p>
                        <p className="mt-1 text-sm font-black text-gray-800">{formatGHS(row.expected)}</p>
                      </div>
                      <div className="rounded-xl bg-emerald-50 p-3">
                        <p className="text-[11px] font-black uppercase tracking-wide text-emerald-500">Collected</p>
                        <p className="mt-1 text-sm font-black text-emerald-700">{formatGHS(row.collected)}</p>
                      </div>
                      <div className="rounded-xl bg-rose-50 p-3">
                        <p className="text-[11px] font-black uppercase tracking-wide text-rose-500">Outstanding</p>
                        <p className="mt-1 text-sm font-black text-rose-700">{formatGHS(row.outstanding)}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs font-black text-gray-500">Collection rate: {row.collectionRate}%</p>
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
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">Receipt integrity report</p>
            <h2 className="mt-1 text-lg font-black text-gray-900">Can the school trust the receipts?</h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-gray-500">
              Tracks confirmed receipts, voided receipts, corrected receipts, unconfirmed records, duplicate-looking references, and receipt sequence gaps.
            </p>
          </div>
          <Link href="/list/finance/receipts" className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-black text-gray-700 transition hover:bg-gray-50">
            Open receipt register <ChevronRight size={15} />
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Confirmed receipts", value: receiptIntegrityReport.confirmedReceipts, sub: `${receiptIntegrityReport.totalReceipts} total receipt records`, tone: "bg-emerald-50 text-emerald-700" },
            { label: "Voided receipts", value: receiptIntegrityReport.voidedReceipts, sub: "Not valid proof of payment", tone: "bg-rose-50 text-rose-700" },
            { label: "Corrected receipts", value: receiptIntegrityReport.correctedReceipts, sub: `${receiptIntegrityReport.correctionLinkedReceipts} correction-linked`, tone: "bg-blue-50 text-blue-700" },
            { label: "Integrity flags", value: receiptIntegrityReport.duplicateReferenceCount + receiptIntegrityReport.receiptGapCount + receiptIntegrityReport.pendingReceipts + receiptIntegrityReport.failedReceipts, sub: "Duplicates, gaps, pending, failed", tone: "bg-amber-50 text-amber-700" },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-gray-400">{card.label}</p>
              <p className="mt-2 truncate text-2xl font-black leading-none text-gray-900">{card.value}</p>
              <p className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-black ${card.tone}`}>{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
            <h3 className="text-sm font-black text-gray-900">Integrity checklist</h3>
            <div className="mt-3 space-y-2">
              {[
                { label: "Pending receipts", value: receiptIntegrityReport.pendingReceipts, tone: receiptIntegrityReport.pendingReceipts > 0 ? "text-amber-700" : "text-emerald-700" },
                { label: "Failed receipt records", value: receiptIntegrityReport.failedReceipts, tone: receiptIntegrityReport.failedReceipts > 0 ? "text-rose-700" : "text-emerald-700" },
                { label: "Duplicate references", value: receiptIntegrityReport.duplicateReferenceCount, tone: receiptIntegrityReport.duplicateReferenceCount > 0 ? "text-rose-700" : "text-emerald-700" },
                { label: "Receipt number gaps", value: receiptIntegrityReport.receiptGapCount, tone: receiptIntegrityReport.receiptGapCount > 0 ? "text-amber-700" : "text-emerald-700" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3">
                  <p className="text-sm font-bold text-gray-700">{item.label}</p>
                  <p className={`text-sm font-black ${item.tone}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white">
            <div className="border-b border-gray-100 p-4">
              <h3 className="text-sm font-black text-gray-900">Receipt issues to review</h3>
              <p className="mt-1 text-xs font-semibold text-gray-500">Owners see only items that can create payment confusion or trust concerns.</p>
            </div>
            {receiptIntegrityReport.issues.length === 0 ? (
              <div className="p-6 text-center text-sm font-bold text-emerald-700">No receipt integrity issue found.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {receiptIntegrityReport.issues.map((issue) => {
                  const riskTone = issue.risk === "Risk" ? "bg-rose-50 text-rose-700" : issue.risk === "Watch" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700";
                  return (
                    <Link key={issue.id} href={issue.href} className="block p-4 transition hover:bg-gray-50/70">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-gray-900">{issue.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs font-semibold text-gray-500">{issue.detail}</p>
                        </div>
                        <div className="shrink-0 text-left sm:text-right">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${riskTone}`}>{issue.risk}</span>
                          {issue.amount !== null && <p className="mt-1 text-sm font-black text-gray-800">{formatGHS(issue.amount)}</p>}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-600">Corrections and reversals report</p>
            <h2 className="mt-1 text-lg font-black text-gray-900">Money mistakes handled without deleting history</h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-gray-500">
              Shows pending correction reviews, approved corrections waiting to be applied, reversals, corrected receipts, and high-risk correction paths.
            </p>
          </div>
          <Link href="/list/finance/corrections" className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-black text-gray-700 transition hover:bg-gray-50">
            Open correction queue <ChevronRight size={15} />
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Pending review", value: correctionReversalReport.pendingReview, sub: formatGHS(correctionReversalReport.pendingAffectedAmount), tone: "bg-amber-50 text-amber-700" },
            { label: "Approved not applied", value: correctionReversalReport.approvedWaitingApplication, sub: "Admin must apply safely", tone: "bg-blue-50 text-blue-700" },
            { label: "Reversed payments", value: correctionReversalReport.reversedPayments, sub: "Voided receipt trail", tone: "bg-rose-50 text-rose-700" },
            { label: "High-risk issues", value: correctionReversalReport.riskyIssueCount, sub: `${correctionReversalReport.oldestPendingDays} oldest pending day${correctionReversalReport.oldestPendingDays === 1 ? "" : "s"}`, tone: "bg-slate-50 text-slate-800" },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-gray-400">{card.label}</p>
              <p className="mt-2 truncate text-2xl font-black leading-none text-gray-900">{card.value}</p>
              <p className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-black ${card.tone}`}>{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.2fr]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
              <h3 className="text-sm font-black text-gray-900">Correction types</h3>
              <div className="mt-3 space-y-2">
                {correctionReversalReport.byType.length === 0 ? (
                  <div className="rounded-xl bg-white p-4 text-sm font-bold text-gray-400">No correction type history yet.</div>
                ) : correctionReversalReport.byType.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3">
                    <p className="text-sm font-bold text-gray-700">{item.label}</p>
                    <p className="text-sm font-black text-gray-900">{item.count}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
              <h3 className="text-sm font-black text-gray-900">Requested actions</h3>
              <div className="mt-3 space-y-2">
                {correctionReversalReport.byAction.length === 0 ? (
                  <div className="rounded-xl bg-white p-4 text-sm font-bold text-gray-400">No requested action history yet.</div>
                ) : correctionReversalReport.byAction.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3">
                    <p className="text-sm font-bold text-gray-700">{item.label}</p>
                    <p className="text-sm font-black text-gray-900">{item.count}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white">
            <div className="border-b border-gray-100 p-4">
              <h3 className="text-sm font-black text-gray-900">Correction issues to review</h3>
              <p className="mt-1 text-xs font-semibold text-gray-500">Only items that can affect money trust, parent confidence, or receipt history are surfaced here.</p>
            </div>
            {correctionReversalReport.issues.length === 0 ? (
              <div className="p-6 text-center text-sm font-bold text-emerald-700">No correction or reversal issue needs attention.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {correctionReversalReport.issues.map((issue) => {
                  const riskTone = issue.risk === "Critical" ? "bg-rose-50 text-rose-700" : issue.risk === "High" ? "bg-amber-50 text-amber-700" : issue.risk === "Watch" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700";
                  return (
                    <Link key={issue.id} href={issue.href} className="block p-4 transition hover:bg-gray-50/70">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-gray-900">{issue.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs font-semibold text-gray-500">{issue.detail}</p>
                        </div>
                        <div className="shrink-0 text-left sm:text-right">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${riskTone}`}>{issue.risk}</span>
                          {issue.amount !== null && <p className="mt-1 text-sm font-black text-gray-800">{formatGHS(issue.amount)}</p>}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
          No correction is treated as final money movement until it is reviewed and safely applied. Original receipts remain traceable for audit.
        </div>
      </section>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Collection breakdown</p>
              <h2 className="mt-1 text-lg font-black text-gray-900">Payment methods</h2>
            </div>
            <p className="text-sm font-bold text-gray-400">{report.receiptCount} receipt{report.receiptCount === 1 ? "" : "s"} issued today</p>
          </div>

          {report.methodBreakdown.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
              <p className="text-sm font-black text-gray-700">No confirmed payments for this date.</p>
              <p className="mt-1 text-sm font-semibold text-gray-400">The report will fill automatically once payments are recorded.</p>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {report.methodBreakdown.map((method) => (
                <div key={method.method} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                  <p className="text-sm font-black text-gray-900">{method.label}</p>
                  <p className="mt-2 text-xl font-black text-emerald-700">{formatGHS(method.amount)}</p>
                  <p className="mt-1 text-xs font-semibold text-gray-400">{method.count} payment{method.count === 1 ? "" : "s"}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-600">Owner updates</p>
            <h2 className="mt-1 text-lg font-black text-gray-900">What needs attention</h2>
            <p className="mt-1 text-sm font-semibold text-gray-500">Important matters only: pending confirmations, corrections, reversals, open queries, and high outstanding bills.</p>
          </div>
          <div className="mt-4 space-y-2">
            {report.ownerUpdates.length === 0 ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                No finance issue needs owner attention for this date.
              </div>
            ) : report.ownerUpdates.map((issue) => (
              <Link key={issue.id} href={issue.href} className={`block rounded-2xl border p-3 transition hover:shadow-sm ${issueTone[issue.tone]}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{issue.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold opacity-80">{issue.detail}</p>
                  </div>
                  {issue.amount !== null && <span className="shrink-0 text-xs font-black">{formatGHS(issue.amount)}</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">Receipt trail</p>
            <h2 className="mt-1 text-lg font-black text-gray-900">Confirmed payments for the day</h2>
          </div>
          <Link href="/list/finance/payments?status=CONFIRMED" className="inline-flex items-center gap-2 text-sm font-black text-blue-700 hover:text-blue-900">
            View payment register <ChevronRight size={15} />
          </Link>
        </div>

        {report.recentPayments.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
            <FileText size={24} className="mx-auto text-gray-300" />
            <p className="mt-2 text-sm font-black text-gray-700">No receipt trail for this date.</p>
          </div>
        ) : (
          <>
            <div className="mt-4 hidden overflow-hidden rounded-2xl border border-gray-100 lg:block">
              <table className="w-full min-w-[880px]">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-gray-400">Receipt</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-gray-400">Student</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-gray-400">Method</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-gray-400">Reference</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-gray-400">Time</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-gray-400">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {report.recentPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 text-sm font-black text-gray-900">{payment.receiptNumber}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-gray-800">{payment.studentName}</p>
                        <p className="text-xs font-semibold text-gray-400">{payment.className} - {payment.billTitle}</p>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-600">{payment.paymentMethodLabel}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-400">{payment.referenceNo ?? "No reference"}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-500">{timeLabel(payment.paymentDate)}</td>
                      <td className="px-4 py-3 text-right text-sm font-black text-emerald-700">{formatGHS(payment.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 lg:hidden">
              {report.recentPayments.map((payment) => (
                <div key={payment.id} className="rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-gray-900">{payment.studentName}</p>
                      <p className="mt-1 text-xs font-semibold text-gray-400">{payment.className} - {payment.receiptNumber}</p>
                    </div>
                    <span className="shrink-0 text-sm font-black text-emerald-700">{formatGHS(payment.amount)}</span>
                  </div>
                  <p className="mt-3 text-xs font-semibold text-gray-500">{payment.paymentMethodLabel} - {payment.referenceNo ?? "No reference"} - {timeLabel(payment.paymentDate)}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
        <div className="flex gap-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>
            Daily report push is intentionally not sending messages yet. This page prepares the exact owner summary we can later schedule for daily delivery when the notification/provider stage is ready.
          </p>
        </div>
      </section>
    </div>
  );
};

export default FinanceReportsPage;
