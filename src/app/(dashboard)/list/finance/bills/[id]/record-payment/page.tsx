// src/app/(dashboard)/list/finance/bills/[id]/record-payment/page.tsx
 

import { redirect, notFound } from "next/navigation";
import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import Link from "next/link";
import { ArrowLeft, Receipt } from "lucide-react";
import { formatGHS, BILL_STATUS_STYLES } from "@/src/lib/constants/finance";
import RecordPaymentForm from "@/src/components/RecordPaymentForm";

export const dynamic = "force-dynamic";

const TERM_LABELS: Record<string, string> = {
  TERM_1: "Term 1", TERM_2: "Term 2", TERM_3: "Term 3",
};

const RecordPaymentPage = async ({
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
          name:    true,
          surname: true,
          img:     true,
          class:   { select: { name: true } },
          parent:  { select: { name: true, surname: true } },
        },
      },
      feeStructure: {
        select: { title: true, term: true, academicYear: true },
      },
      lineItems: {
        include: { feeItem: { select: { name: true } } },
      },
      payments: {
        where:  { status: "CONFIRMED" },
        select: { amount: true, receiptNumber: true, paymentDate: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!bill) notFound();

  // Cannot record payments on paid or waived bills
  if (bill.status === "PAID" || bill.status === "WAIVED") {
    redirect(`/list/finance/bills/${billId}`);
  }

  const statusStyle = BILL_STATUS_STYLES[bill.status];

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4 max-w-2xl">

      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            href={`/list/finance/bills/${billId}`}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors shrink-0"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="w-11 h-11 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
            <Receipt size={20} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tight">Record Payment</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">
              {bill.student.surname} {bill.student.name} · {bill.student.class?.name}
            </p>
          </div>
        </div>
      </div>

      {/* Bill summary */}
      <div className={`rounded-2xl border p-5 ${statusStyle.bg} ${statusStyle.border}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-gray-500 mb-1">
              {bill.feeStructure.title}
            </p>
            <p className="text-sm text-gray-500">
              {TERM_LABELS[bill.feeStructure.term]} · {bill.feeStructure.academicYear}
            </p>
          </div>
          <span className={`text-xs font-black px-2.5 py-1 rounded-xl border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
            {statusStyle.label}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Bill",    value: formatGHS(bill.totalAmount), color: "text-gray-800"   },
            { label: "Amount Paid",   value: formatGHS(bill.amountPaid),  color: "text-emerald-700" },
            { label: "Balance Due",   value: formatGHS(bill.balance),     color: "text-rose-600"    },
          ].map((s) => (
            <div key={s.label} className="bg-white/70 rounded-xl p-3 text-center">
              <p className={`text-lg font-black leading-none ${s.color}`}>{s.value}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {Number(bill.totalAmount) > 0 && (
          <div className="mt-3">
            <div className="h-2 bg-white/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{
                  width: `${Math.min(
                    Math.round((Number(bill.amountPaid) / Number(bill.totalAmount)) * 100),
                    100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Line items breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">Outstanding Items</p>
        </div>
        <div className="divide-y divide-gray-50">
          {bill.lineItems
            .filter((l) => !l.isPaid)
            .map((line) => (
              <div key={line.id} className="flex items-center justify-between px-5 py-3">
                <p className="text-sm font-semibold text-gray-700">{line.feeItem.name}</p>
                <p className="text-sm font-black text-rose-600">{formatGHS(line.balance)}</p>
              </div>
            ))}
          {bill.lineItems.every((l) => l.isPaid) && (
            <div className="px-5 py-3 text-center text-xs text-gray-400">
              All line items are paid
            </div>
          )}
        </div>
      </div>

      {/* Payment form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <RecordPaymentForm
          billId={billId}
          balance={Number(bill.balance)}
          defaultPayerName={
            bill.student.parent
              ? `${bill.student.parent.name} ${bill.student.parent.surname}`
              : ""
          }
        />
      </div>

      {/* Previous payments */}
      {bill.payments.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">
              Previous Payments ({bill.payments.length})
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {bill.payments.map((p, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-xs font-bold text-gray-600">{p.receiptNumber}</p>
                  <p className="text-[10px] text-gray-400">
                    {new Date(p.paymentDate).toLocaleDateString("en-GH", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                </div>
                <p className="text-sm font-black text-emerald-700">{formatGHS(p.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordPaymentPage;
