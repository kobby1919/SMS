import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, Download, ReceiptText } from "lucide-react";
import { requirePageSession } from "@/src/lib/authz";
import { formatGHS } from "@/src/lib/constants/finance";
import { getParentFinanceBill } from "@/src/lib/services/parent-finance";
import ParentFinanceQueryForm from "@/src/components/ParentFinanceQueryForm";

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

const QUERY_REASON_LABELS: Record<string, string> = {
  ALREADY_PAID: "Already paid",
  WRONG_AMOUNT: "Wrong amount",
  NEED_CLARIFICATION: "Needs clarification",
  RECEIPT_ISSUE: "Receipt issue",
  OTHER: "Other",
};

const ADJUSTMENT_STYLES = {
  discount: "bg-emerald-50 text-emerald-800",
  waiver: "bg-sky-50 text-sky-800",
  reversal: "bg-rose-50 text-rose-800",
};

function formatDate(date?: Date | null) {
  if (!date) return "No due date set";
  return date.toLocaleDateString("en-GH", { day: "numeric", month: "long", year: "numeric" });
}

export default async function ParentFinanceBillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId, schoolId } = await requirePageSession(["parent"]);
  const { id } = await params;
  const billId = Number(id);
  if (!Number.isInteger(billId) || billId <= 0) notFound();

  const bill = await getParentFinanceBill(userId, schoolId, billId);
  if (!bill) notFound();

  return (
    <div className="flex flex-col gap-5 p-4">
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <Link href="/parent/finance" className="inline-flex items-center gap-2 text-xs font-black text-gray-400 hover:text-amber-700">
          <ArrowLeft size={14} />
          Fees & payments
        </Link>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-gray-900">{bill.title}</h1>
              <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${STATE_STYLES[bill.state]}`}>
                {STATE_LABELS[bill.state]}
              </span>
            </div>
            <p className="mt-1 text-sm font-bold text-gray-400">
              {bill.childName} - {bill.className} - {bill.termLabel} {bill.academicYear}
            </p>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-relaxed text-gray-600">
              {bill.balanceExplanation}
            </p>
          </div>
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-800">
            <p className="text-[10px] font-black uppercase tracking-wider">Balance</p>
            <p className="mt-1 text-2xl font-black">{formatGHS(bill.balance)}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-4">
          {[
            { label: "Total bill", value: formatGHS(bill.totalAmount) },
            { label: "Paid", value: formatGHS(bill.amountPaid) },
            { label: "Discounts", value: formatGHS(bill.discountAmount) },
            { label: "Due date", value: formatDate(bill.dueDate) },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">{item.label}</p>
              <p className="mt-1 text-sm font-black text-gray-900">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-5">
          <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-gray-500">Fee Breakdown</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {bill.lineItems.map((line) => (
                <div key={line.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-gray-900">{line.name}</p>
                      {line.isOptional && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase text-amber-700">
                          Optional
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs font-semibold text-gray-400">{line.categoryLabel}</p>
                  </div>
                  <div className="grid min-w-40 grid-cols-2 gap-2 text-right">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-gray-400">Amount</p>
                      <p className="text-sm font-black text-gray-900">{formatGHS(line.amount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-gray-400">Balance</p>
                      <p className="text-sm font-black text-amber-700">{formatGHS(line.balance)}</p>
                    </div>
                  </div>
                  {line.isPaid ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Clock size={16} className="text-gray-300" />}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-gray-500">Payment Timeline</h2>
            </div>
            {bill.payments.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <ReceiptText size={26} className="mx-auto text-gray-200" />
                <p className="mt-2 text-sm font-bold text-gray-400">No payment has been recorded for this bill yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {bill.payments.map((payment) => (
                  <div key={payment.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-gray-900">{payment.receiptNumber}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                          payment.status === "CONFIRMED" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        }`}>
                          {payment.status.toLowerCase()}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-semibold text-gray-400">
                        {payment.methodLabel} - {formatDate(payment.date)}
                        {payment.referenceNo ? ` - Ref: ${payment.referenceNo}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-black text-emerald-700">{formatGHS(payment.amount)}</p>
                      {payment.status === "CONFIRMED" && (
                        <Link
                          href={payment.receiptHref}
                          className="inline-flex items-center gap-1 rounded-xl bg-gray-900 px-3 py-2 text-xs font-black text-white hover:bg-gray-800"
                        >
                          <Download size={13} />
                          Receipt
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-gray-500">Adjustments</h2>
            </div>
            {bill.adjustments.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm font-bold text-gray-400">No discounts, waivers, or reversals have been recorded for this bill.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {bill.adjustments.map((adjustment) => (
                  <div key={adjustment.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-gray-900">{adjustment.label}</p>
                        <p className="mt-0.5 text-xs font-semibold text-gray-400">
                          {formatDate(adjustment.date)}
                          {adjustment.actor ? ` - By ${adjustment.actor}` : ""}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${ADJUSTMENT_STYLES[adjustment.type]}`}>
                        {adjustment.type}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-gray-500">{adjustment.description}</p>
                    {(adjustment.amount || adjustment.percentage) && (
                      <p className="mt-2 text-xs font-black text-gray-700">
                        {adjustment.amount ? formatGHS(adjustment.amount) : `${adjustment.percentage}%`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {bill.queries.length > 0 && (
            <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="text-sm font-black uppercase tracking-wider text-gray-500">Finance Queries</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {bill.queries.map((query) => (
                  <div key={query.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-black text-gray-900">{QUERY_REASON_LABELS[query.reason] ?? query.reason}</p>
                      <span className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-black uppercase text-slate-600">
                        {query.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-gray-500">{query.message}</p>
                    {query.response && (
                      <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                        Finance response: {query.response}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-5">
          <ParentFinanceQueryForm studentBillId={bill.id} />
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">Transparency note</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-500">
              Every payment, receipt, reversal, waiver, and finance query is kept as part of the school finance record.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
