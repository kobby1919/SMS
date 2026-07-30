import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, HelpCircle, ReceiptText, WalletCards } from "lucide-react";
import { requirePageSession } from "@/src/lib/authz";
import { formatGHS } from "@/src/lib/constants/finance";
import { getParentFinanceOverview } from "@/src/lib/services/parent-finance";
import { getSchoolBranding } from "@/src/lib/services/school-branding";

export const dynamic = "force-dynamic";

const STATE_STYLES = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-100",
  waived: "bg-gray-50 text-gray-600 border-gray-100",
  overpaid: "bg-blue-50 text-blue-700 border-blue-100",
  overdue: "bg-rose-50 text-rose-700 border-rose-100",
  "due-soon": "bg-amber-50 text-amber-700 border-amber-100",
  partial: "bg-sky-50 text-sky-700 border-sky-100",
  unpaid: "bg-slate-50 text-slate-700 border-slate-100",
};

const STATE_LABELS = {
  paid: "Paid",
  waived: "Waived",
  overpaid: "Overpaid",
  overdue: "Overdue",
  "due-soon": "Due soon",
  partial: "Part payment",
  unpaid: "Unpaid",
};

function formatDate(date?: Date | null) {
  if (!date) return "No due date set";
  return date.toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" });
}

export default async function ParentFinancePage() {
  const { userId, schoolId } = await requirePageSession(["parent"]);
  const [finance, branding] = await Promise.all([
    getParentFinanceOverview(userId, schoolId),
    getSchoolBranding(schoolId),
  ]);

  return (
    <div className="flex flex-col gap-5 p-4">
      <section className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-amber-300">
              {branding.displayName} Fee Transparency
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Fees & Payments</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-300">
              See each bill, what has been paid, what is left, receipts, and any open finance queries in one place.
            </p>
          </div>
          <div className="rounded-2xl bg-white/[0.06] px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Outstanding</p>
            <p className="mt-1 text-2xl font-black">{formatGHS(finance.totals.outstanding)}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-2 sm:grid-cols-4">
          {[
            { label: "Total billed", value: formatGHS(finance.totals.totalBilled), icon: <WalletCards size={16} /> },
            { label: "Paid", value: formatGHS(finance.totals.totalPaid), icon: <CheckCircle2 size={16} /> },
            { label: "Due soon", value: String(finance.totals.dueSoonBillCount), icon: <CalendarClock size={16} /> },
            { label: "Open queries", value: String(finance.totals.openQueryCount), icon: <HelpCircle size={16} /> },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-white/[0.06] p-3">
              <div className="flex items-center justify-between text-amber-200">
                {item.icon}
                <span className="text-lg font-black text-white">{item.value}</span>
              </div>
              <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {finance.bills.length === 0 ? (
        <section className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <ReceiptText size={28} className="mx-auto text-gray-200" />
          <p className="mt-3 text-sm font-black text-gray-500">No fee bills have been published yet.</p>
          <p className="mt-1 text-xs font-semibold text-gray-400">When the school generates a bill, it will appear here.</p>
        </section>
      ) : (
        <section className="grid gap-3">
          {finance.bills.map((bill) => (
            <Link
              key={bill.id}
              href={`/parent/finance/bills/${bill.id}`}
              className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-amber-200 hover:bg-amber-50/30"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-black text-gray-900">{bill.title}</h2>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${STATE_STYLES[bill.state]}`}>
                      {STATE_LABELS[bill.state]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-gray-400">
                    {bill.childName} - {bill.className} - {bill.termLabel} {bill.academicYear}
                  </p>
                  <p className="mt-3 max-w-3xl text-sm font-semibold leading-relaxed text-gray-500">
                    {bill.balanceExplanation}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-right sm:min-w-72">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-gray-400">Bill</p>
                    <p className="text-sm font-black text-gray-900">{formatGHS(bill.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-gray-400">Paid</p>
                    <p className="text-sm font-black text-emerald-700">{formatGHS(bill.amountPaid)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-gray-400">Balance</p>
                    <p className="text-sm font-black text-amber-700">{formatGHS(bill.balance)}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                <p className="text-xs font-bold text-gray-400">Due: {formatDate(bill.dueDate)}</p>
                <span className="inline-flex items-center gap-1 text-xs font-black text-amber-700">
                  Open bill <ArrowRight size={13} />
                </span>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
