"use client";

// src/components/finance/RecordPaymentForm.tsx
// The form bursar uses to record a payment against a student bill.
// On success: shows the generated receipt number and offers to print.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Receipt, Loader2, AlertCircle, CheckCircle2,
  Printer,
} from "lucide-react";
import { recordPayment } from "@/src/lib/actions/paymentActions";
import type { PaymentMethod } from "@/src/generated/prisma";
import { PAYMENT_METHOD_LABELS, formatGHS } from "@/src/lib/constants/finance";

type Props = {
  billId:           number;
  balance:          number;  // current outstanding balance
  defaultPayerName: string;  // pre-filled from parent name
};

type SuccessData = {
  receiptNumber: string;
  amount:        number;
  method:        string;
  paidBy:        string;
};

const RecordPaymentForm = ({ billId, balance, defaultPayerName }: Props) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  // Form state
  const [amount,        setAmount]        = useState(balance.toFixed(2));
  const [method,        setMethod]        = useState("CASH");
  const [paymentDate,   setPaymentDate]   = useState(
    new Date().toISOString().split("T")[0]   // today in YYYY-MM-DD
  );
  const [paidBy,        setPaidBy]        = useState(defaultPayerName);
  const [referenceNo,   setReferenceNo]   = useState("");
  const [notes,         setNotes]         = useState("");
  const [error,         setError]         = useState<string | null>(null);
  const [success,       setSuccess]       = useState<SuccessData | null>(null);

  // Show reference field for non-cash methods
  const needsReference = method !== "CASH";

  const handleSubmit = () => {
    setError(null);

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid amount greater than zero.");
      return;
    }
    if (!paidBy.trim()) {
      setError("Payer name is required.");
      return;
    }
    if (needsReference && !referenceNo.trim()) {
      setError(`A reference number is required for ${PAYMENT_METHOD_LABELS[method]} payments.`);
      return;
    }

    startTransition(async () => {
      try {
        const payment = await recordPayment({
          studentBillId: billId,
          amount:        amountNum,
          paymentMethod: method as PaymentMethod,
          paymentDate,
          paidBy:        paidBy.trim(),
          referenceNo:   referenceNo.trim() || undefined,
          idempotencyKey,
          notes:         notes.trim() || undefined,
        });

        setSuccess({
          receiptNumber: payment.receiptNumber,
          amount:        amountNum,
          method,
          paidBy:        paidBy.trim(),
        });
        setIdempotencyKey(crypto.randomUUID());
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to record payment. Please try again.");
      }
    });
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="flex flex-col items-center gap-5 py-4">
        {/* Receipt icon */}
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center">
          <CheckCircle2 size={32} className="text-emerald-500" />
        </div>

        <div className="text-center">
          <h2 className="text-xl font-black text-gray-800">Payment Recorded</h2>
          <p className="text-sm text-gray-400 mt-1">Receipt has been generated successfully</p>
        </div>

        {/* Receipt card */}
        <div className="w-full max-w-sm border-2 border-dashed border-emerald-200 rounded-2xl p-5 bg-emerald-50/40">
          <div className="text-center mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">
              Official Receipt
            </p>
            <p className="text-2xl font-black text-emerald-700">{success.receiptNumber}</p>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Amount</span>
              <span className="font-black text-gray-800">{formatGHS(success.amount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Method</span>
              <span className="font-bold text-gray-700">{PAYMENT_METHOD_LABELS[success.method]}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Paid by</span>
              <span className="font-bold text-gray-700">{success.paidBy}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Date</span>
              <span className="font-bold text-gray-700">
                {new Date().toLocaleDateString("en-GH", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 w-full">
          <a
            href={`/api/finance/receipt?billId=${billId}&receiptNumber=${encodeURIComponent(success.receiptNumber)}`}
            target="_blank"
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-800 text-white rounded-xl text-sm font-bold hover:bg-gray-900 transition-colors"
          >
            <Printer size={15} /> Print Receipt
          </a>
          <button
            type="button"
            onClick={() => router.push(`/list/finance/bills/${billId}`)}
            className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors"
          >
            Back to Bill
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setSuccess(null);
            setAmount(Math.max(balance - success.amount, 0).toFixed(2));
            setReferenceNo("");
            setNotes("");
          }}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
        >
          Record another payment
        </button>
      </div>
    );
  }

  // ── Payment form ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center">
          <Receipt size={15} className="text-emerald-600" />
        </div>
        <h2 className="text-base font-black text-gray-800">Payment Details</h2>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-rose-700">{error}</p>
        </div>
      )}

      {/* Amount */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-black uppercase tracking-wider text-gray-500">
          Amount (GH₵) *
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">
            GH₵
          </span>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full pl-12 pr-4 py-3 ring-[1.5px] ring-gray-200 rounded-xl text-xl font-black text-gray-800 focus:ring-emerald-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <p className="text-[10px] text-gray-400 font-semibold">
            Outstanding balance: <span className="font-black text-rose-600">{formatGHS(balance)}</span>
          </p>
          <button
            type="button"
            onClick={() => setAmount(balance.toFixed(2))}
            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700"
          >
            Pay full balance
          </button>
        </div>
      </div>

      {/* Payment method */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-black uppercase tracking-wider text-gray-500">
          Payment Method *
        </label>
        {/* Method pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(PAYMENT_METHOD_LABELS).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setMethod(val)}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition-all text-left
                ${method === val
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Reference number (for non-cash) */}
      {needsReference && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-gray-500">
            Reference Number *
            <span className="font-normal normal-case text-gray-400 ml-1">
              (MoMo transaction ID / Cheque no. / Bank ref)
            </span>
          </label>
          <input
            type="text"
            value={referenceNo}
            onChange={(e) => setReferenceNo(e.target.value)}
            placeholder={
              method === "MTN_MOMO" || method === "VODAFONE_CASH" || method === "AIRTELTIGO_MONEY"
                ? "e.g. MTN-1234567890"
                : method === "CHEQUE"
                ? "e.g. CHQ-001234"
                : "Bank reference number"
            }
            className="ring-[1.5px] ring-gray-200 px-3 py-3 rounded-xl text-sm font-semibold text-gray-700 focus:ring-emerald-500 outline-none"
          />
        </div>
      )}

      {/* Payment date */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-black uppercase tracking-wider text-gray-500">
          Payment Date *
        </label>
        <input
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          className="ring-[1.5px] ring-gray-200 px-3 py-3 rounded-xl text-sm font-semibold text-gray-700 focus:ring-emerald-500 outline-none"
        />
      </div>

      {/* Paid by */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-black uppercase tracking-wider text-gray-500">
          Paid By (Name of Payer) *
        </label>
        <input
          type="text"
          value={paidBy}
          onChange={(e) => setPaidBy(e.target.value)}
          placeholder="Full name of the person making the payment"
          className="ring-[1.5px] ring-gray-200 px-3 py-3 rounded-xl text-sm font-semibold text-gray-700 focus:ring-emerald-500 outline-none"
        />
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-black uppercase tracking-wider text-gray-500">
          Notes <span className="font-normal normal-case text-gray-300">(optional)</span>
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional notes about this payment…"
          className="ring-[1.5px] ring-gray-200 px-3 py-3 rounded-xl text-sm text-gray-700 focus:ring-emerald-500 outline-none resize-none"
        />
      </div>

      {/* Info */}
      <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
        <p className="text-[10px] text-indigo-700 font-semibold leading-relaxed">
          A receipt number will be auto-generated in the format{" "}
          <span className="font-black">RCP-{new Date().getFullYear()}-XXX</span> after you confirm.
          This payment cannot be edited once recorded — use the reversal feature if a correction
          is needed.
        </p>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full py-3.5 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base shadow-lg shadow-emerald-100"
      >
        {isPending
          ? <><Loader2 size={16} className="animate-spin" /> Recording Payment…</>
          : <><Receipt size={16} /> Record Payment · {amount ? formatGHS(parseFloat(amount) || 0) : "GH₵ 0.00"}</>
        }
      </button>
    </div>
  );
};

export default RecordPaymentForm;
