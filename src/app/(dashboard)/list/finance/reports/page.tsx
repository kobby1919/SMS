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
  const report = await getDailyFinanceReport(schoolId, selectedDate);

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
              <Download size={15} /> Download PDF
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
