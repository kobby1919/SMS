"use client";

// src/components/finance/PaymentReverseButton.tsx
// Reverse a confirmed payment. Shows a confirmation modal with reason input.
// The original payment is kept permanently — only status changes to REVERSED.

import { useState, useTransition } from "react";
import { RotateCcw, AlertTriangle, Loader2, X } from "lucide-react";
import { reversePayment } from "@/src/lib/actions/paymentActions";
import { formatGHS } from "@/src/lib/constants/finance";
import { useRouter } from "next/navigation";

type Props = {
  paymentId:     number;
  receiptNumber: string;
  amount:        number;
};

const PaymentReverseButton = ({ paymentId, receiptNumber, amount }: Props) => {
  const router = useRouter();
  const [open,      setOpen]      = useState(false);
  const [reason,    setReason]    = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleReverse = () => {
    if (!reason.trim()) { setError("A reason is required to reverse a payment."); return; }
    setError(null);
    startTransition(async () => {
      try {
        await reversePayment(paymentId, reason.trim());
        setOpen(false);
        setReason("");
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to reverse payment.");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors"
        title="Reverse payment"
      >
        <RotateCcw size={13} />
      </button>

      {open && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-8 flex flex-col gap-5">

              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center shrink-0">
                    <AlertTriangle size={22} className="text-rose-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-800">Reverse Payment?</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{receiptNumber}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setOpen(false); setReason(""); setError(null); }}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Info */}
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-rose-700 font-bold">Payment Amount</p>
                  <p className="text-base font-black text-rose-700">{formatGHS(amount)}</p>
                </div>
                <p className="text-xs text-rose-600 leading-relaxed">
                  This will <strong>void</strong> receipt {receiptNumber} and restore the
                  student&apos;s bill balance. The original payment record is kept permanently
                  for audit purposes. This action cannot be undone.
                </p>
              </div>

              {/* Reason */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-gray-500">
                  Reason for Reversal *
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Wrong amount entered, duplicate payment, payment bounced…"
                  className="ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm text-gray-700 focus:ring-rose-400 outline-none resize-none"
                />
              </div>

              {error && (
                <p className="text-xs font-semibold text-rose-600">{error}</p>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setOpen(false); setReason(""); setError(null); }}
                  disabled={isPending}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReverse}
                  disabled={isPending}
                  className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm shadow-lg shadow-rose-100"
                >
                  {isPending
                    ? <><Loader2 size={14} className="animate-spin" /> Reversing…</>
                    : <><RotateCcw size={14} /> Reverse Payment</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PaymentReverseButton;
