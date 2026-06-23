// src/app/(dashboard)/list/finance/bills/[id]/page.tsx


import { notFound } from "next/navigation";
import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft, CheckCircle2,
  Clock, AlertCircle, Receipt, Users,
} from "lucide-react";
import {
  formatGHS,
  BILL_STATUS_STYLES,
  FEE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/src/lib/constants/finance";
import WaiveBillButton from "@/src/components/WaiveBillButton";

export const dynamic = "force-dynamic";

const TERM_LABELS: Record<string, string> = {
  TERM_1: "Term 1", TERM_2: "Term 2", TERM_3: "Term 3",
};

const BillDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { schoolId } = await requirePageSession(["admin", "bursar"]);

  const { id } = await params;
  const billId = parseInt(id);

  const bill = await prisma.studentBill.findFirst({
    where:   { id: billId, schoolId },
    include: {
      student: {
        select: {
          id:      true,
          name:    true,
          surname: true,
          img:     true,
          class:   { select: { name: true } },
          grade:   { select: { level: true } },
          parent:  { select: { name: true, surname: true, phone: true } },
        },
      },
      feeStructure: {
        select: {
          id:          true,
          title:       true,
          term:        true,
          academicYear: true,
        },
      },
      lineItems: {
        include: {
          feeItem: {
            select: { name: true, category: true, isOptional: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        include: { reversal: true },
      },
      discounts: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!bill) notFound();

  const statusStyle    = BILL_STATUS_STYLES[bill.status];
  const canRecordPayment = bill.status !== "PAID" && bill.status !== "WAIVED";
  const confirmedPayments = bill.payments.filter((p) => p.status === "CONFIRMED");
  const reversedPayments  = bill.payments.filter((p) => p.status === "REVERSED");

  // Progress percentage
  const progressPct = Number(bill.totalAmount) > 0
    ? Math.min(Math.round((Number(bill.amountPaid) / Number(bill.totalAmount)) * 100), 100)
    : 0;

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">

      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/list/finance/bills"
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors shrink-0"
            >
              <ArrowLeft size={16} />
            </Link>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-base font-black text-indigo-600 bg-indigo-50 shrink-0 overflow-hidden">
              {bill.student.img
                ? <Image unoptimized src={bill.student.img} alt="" width={44} height={44} className="w-full h-full object-cover" />
                : `${bill.student.name[0]}${bill.student.surname[0]}`
              }
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 tracking-tight">
                {bill.student.surname} {bill.student.name}
              </h1>
              <p className="text-sm text-gray-400 mt-0.5 font-medium">
                {bill.student.class?.name} · {bill.student.grade?.level} ·{" "}
                {TERM_LABELS[bill.feeStructure.term]} {bill.feeStructure.academicYear}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Record payment button — placeholder until Step 4 */}
            {canRecordPayment && (
              <Link
                href={`/list/finance/bills/${billId}/record-payment`}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Receipt size={15} /> Record Payment
              </Link>
            )}
            {bill.status !== "PAID" && bill.status !== "WAIVED" && (
              <WaiveBillButton billId={billId} studentName={`${bill.student.name} ${bill.student.surname}`} />
            )}
          </div>
        </div>
      </div>

      {/* Status + balance hero */}
      <div className={`rounded-2xl border p-5 ${statusStyle.bg} ${statusStyle.border}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${statusStyle.text} opacity-70`}>
              Bill Status
            </span>
            <p className={`text-3xl font-black mt-1 ${statusStyle.text}`}>{statusStyle.label}</p>
            <p className={`text-sm font-semibold mt-1 ${statusStyle.text} opacity-70`}>
              Bill #{billId} · {bill.feeStructure.title}
            </p>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-[10px] text-gray-500 font-bold uppercase">Total</p>
              <p className="text-xl font-black text-gray-800">{formatGHS(bill.totalAmount)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-500 font-bold uppercase">Paid</p>
              <p className="text-xl font-black text-emerald-700">{formatGHS(bill.amountPaid)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-500 font-bold uppercase">Balance</p>
              <p className={`text-xl font-black ${statusStyle.text}`}>{formatGHS(bill.balance)}</p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-gray-500">Payment Progress</span>
            <span className="text-[10px] font-black text-gray-700">{progressPct}%</span>
          </div>
          <div className="h-2.5 bg-white/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">

        {/* Left — line items + discounts */}
        <div className="flex-1 flex flex-col gap-4">

          {/* Parent contact */}
          {bill.student.parent && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <Users size={14} className="text-gray-400 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-0.5">Parent / Guardian</p>
                <p className="text-sm font-bold text-gray-800">
                  {bill.student.parent.name} {bill.student.parent.surname}
                </p>
              </div>
              {bill.student.parent.phone && (
                <a
                  href={`tel:${bill.student.parent.phone}`}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                >
                  {bill.student.parent.phone}
                </a>
              )}
            </div>
          )}

          {/* Line items */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-xs font-black uppercase tracking-wider text-gray-400">Fee Breakdown</p>
            </div>
            <div className="divide-y divide-gray-50">
              {bill.lineItems.map((line) => (
                <div key={line.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-800">{line.feeItem.name}</p>
                      {line.feeItem.isOptional && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-md">
                          Optional
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {FEE_CATEGORY_LABELS[line.feeItem.category] ?? line.feeItem.category}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-gray-800">{formatGHS(line.amount)}</p>
                    {Number(line.amountPaid) > 0 && (
                      <p className="text-[10px] text-emerald-600 font-semibold">
                        Paid: {formatGHS(line.amountPaid)}
                      </p>
                    )}
                  </div>
                  {line.isPaid
                    ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    : <Clock size={16} className="text-gray-300 shrink-0" />
                  }
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-gray-700">Total</p>
                <p className="text-base font-black text-gray-800">{formatGHS(bill.totalAmount)}</p>
              </div>
              {Number(bill.discountAmount) > 0 && (
                <div className="flex items-center justify-between mt-1">
                  <p className="text-sm text-emerald-600 font-bold">Discount Applied</p>
                  <p className="text-sm font-black text-emerald-700">- {formatGHS(bill.discountAmount)}</p>
                </div>
              )}
              <div className="flex items-center justify-between mt-1">
                <p className="text-sm font-bold text-gray-500">Amount Paid</p>
                <p className="text-sm font-black text-emerald-700">{formatGHS(bill.amountPaid)}</p>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                <p className="text-sm font-black text-gray-800">Balance Due</p>
                <p className="text-lg font-black text-rose-600">{formatGHS(bill.balance)}</p>
              </div>
            </div>
          </div>

          {/* Discounts */}
          {bill.discounts.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs font-black uppercase tracking-wider text-gray-400">Discounts Applied</p>
              </div>
              <div className="divide-y divide-gray-50">
                {bill.discounts.map((d) => (
                  <div key={d.id} className="px-5 py-3.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-800">{d.description}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {d.type.replace("_", " ")} · Approved by {d.approvedBy}
                      </p>
                    </div>
                    <p className="text-sm font-black text-emerald-700">
                      {d.amount
                        ? `- ${formatGHS(d.amount)}`
                        : `- ${d.percentage}%`
                      }
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — payment history */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col gap-4">

          {/* Confirmed payments */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-wider text-gray-400">
                Payment History
              </p>
              <span className="text-xs font-bold text-gray-400">
                {confirmedPayments.length} payment{confirmedPayments.length !== 1 ? "s" : ""}
              </span>
            </div>

            {confirmedPayments.length === 0 ? (
              <div className="py-8 text-center">
                <AlertCircle size={20} className="text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400 font-semibold">No payments recorded yet</p>
                {canRecordPayment && (
                  <Link
                    href={`/list/finance/bills/${billId}/record-payment`}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700"
                  >
                    Record first payment →
                  </Link>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {confirmedPayments.map((p) => (
                  <div key={p.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-black text-emerald-700">{formatGHS(p.amount)}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg">
                        Confirmed
                      </span>
                    </div>
                    <p className="text-xs font-bold text-gray-600">{p.receiptNumber}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {PAYMENT_METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod} ·{" "}
                      {new Date(p.paymentDate).toLocaleDateString("en-GH", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </p>
                    <p className="text-[10px] text-gray-400">Paid by: {p.paidBy}</p>
                    {p.referenceNo && (
                      <p className="text-[10px] text-gray-400">Ref: {p.referenceNo}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reversed payments (if any) */}
          {reversedPayments.length > 0 && (
            <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-rose-100">
                <p className="text-xs font-black uppercase tracking-wider text-rose-400">
                  Reversed Payments
                </p>
              </div>
              <div className="divide-y divide-rose-50">
                {reversedPayments.map((p) => (
                  <div key={p.id} className="px-5 py-3.5 opacity-60">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-black text-rose-600 line-through">{formatGHS(p.amount)}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-50 text-rose-600 rounded-lg">
                        Reversed
                      </span>
                    </div>
                    <p className="text-xs font-bold text-gray-500">{p.receiptNumber}</p>
                    {p.reversal && (
                      <p className="text-[10px] text-rose-500 mt-0.5">
                        Reason: {p.reversal.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bill notes */}
          {bill.notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-500 mb-1">Notes</p>
              <p className="text-xs text-amber-800 leading-relaxed">{bill.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillDetailPage;
