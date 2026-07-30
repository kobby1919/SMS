"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Loader2, MessageSquare } from "lucide-react";
import { openParentFinanceQuery } from "@/src/lib/actions/parentFinanceActions";

const REASONS = [
  { value: "NEED_CLARIFICATION", label: "Need clarification" },
  { value: "ALREADY_PAID", label: "I have already paid" },
  { value: "WRONG_AMOUNT", label: "Wrong amount" },
  { value: "RECEIPT_ISSUE", label: "Receipt issue" },
  { value: "OTHER", label: "Other" },
] as const;

type Props = {
  studentBillId: number;
  paymentId?: number;
};

export default function ParentFinanceQueryForm({ studentBillId, paymentId }: Props) {
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>("NEED_CLARIFICATION");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    setSuccess(false);
    if (!message.trim()) {
      setError("Please explain the issue briefly.");
      return;
    }

    startTransition(async () => {
      try {
        await openParentFinanceQuery({
          studentBillId,
          paymentId,
          reason,
          message,
        });
        setMessage("");
        setReason("NEED_CLARIFICATION");
        setSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not submit your query.");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <MessageSquare size={16} className="text-amber-600" />
        <h2 className="text-sm font-black text-gray-900">Ask the bursar</h2>
      </div>
      <p className="mt-1 text-xs font-semibold text-gray-400">
        Query this {paymentId ? "payment" : "bill"} if anything looks unclear.
      </p>

      <div className="mt-4 grid gap-3">
        <select
          value={reason}
          onChange={(event) => setReason(event.target.value as typeof reason)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-bold text-gray-700 outline-none focus:border-amber-400"
        >
          {REASONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Example: I paid by MoMo yesterday but the balance still shows unpaid."
          className="w-full resize-none rounded-xl border border-gray-200 px-3 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-amber-400"
        />

        {error && (
          <p className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
            <AlertCircle size={14} />
            {error}
          </p>
        )}
        {success && (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
            <CheckCircle2 size={14} />
            Query submitted. The finance office can now review it.
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-black text-white transition hover:bg-amber-700 disabled:opacity-60"
        >
          {isPending ? <Loader2 size={15} className="animate-spin" /> : <MessageSquare size={15} />}
          Submit query
        </button>
      </div>
    </div>
  );
}
