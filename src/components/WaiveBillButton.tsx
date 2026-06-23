"use client";

// src/components/finance/WaiveBillButton.tsx
// Waive a student bill — sets status to WAIVED and balance to 0.

import { useState, useTransition } from "react";
import { ShieldOff, AlertTriangle, Loader2, X } from "lucide-react";
import { waiveBill } from "@/src/lib/actions/billActions";
import { useRouter } from "next/navigation";

type Props = {
  billId:      number;
  studentName: string;
};

const WaiveBillButton = ({ billId, studentName }: Props) => {
  const router = useRouter();
  const [open,      setOpen]      = useState(false);
  const [reason,    setReason]    = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleWaive = () => {
    if (!reason.trim()) { setError("A reason is required to waive a bill."); return; }
    setError(null);
    startTransition(async () => {
      try {
        await waiveBill(billId, reason.trim());
        setOpen(false);
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to waive bill.");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
      >
        <ShieldOff size={15} /> Waive Bill
      </button>

      {open && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-8 flex flex-col gap-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
                    <AlertTriangle size={22} className="text-amber-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-800">Waive Bill?</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{studentName}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                  <X size={18} />
                </button>
              </div>

              <p className="text-sm text-gray-500 leading-relaxed">
                This will set the bill balance to <strong>GH₵ 0.00</strong> and mark it as
                <strong> Waived</strong>. The original amounts are preserved for audit purposes.
                This action cannot be undone.
              </p>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-gray-500">
                  Reason for Waiver *
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Full scholarship student, Staff child benefit…"
                  className="ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm text-gray-700 focus:ring-amber-400 outline-none resize-none"
                />
              </div>

              {error && (
                <p className="text-xs font-semibold text-rose-600">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleWaive}
                  disabled={isPending}
                  className="flex-1 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm shadow-lg shadow-amber-100"
                >
                  {isPending
                    ? <><Loader2 size={14} className="animate-spin" /> Waiving…</>
                    : <><ShieldOff size={14} /> Waive Bill</>
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

export default WaiveBillButton;
