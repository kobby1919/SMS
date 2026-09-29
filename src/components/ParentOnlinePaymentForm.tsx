"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { CreditCard, Loader2 } from "lucide-react";
import { createParentCheckoutWithState, type ParentCheckoutActionState } from "@/src/lib/actions/paymentIntentActions";
import { formatGHS } from "@/src/lib/constants/finance";

const initialState: ParentCheckoutActionState = {
  status: "idle",
  message: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
    >
      {pending ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
      {pending ? "Preparing checkout..." : "Pay online"}
    </button>
  );
}

export default function ParentOnlinePaymentForm({
  studentBillId,
  balance,
  disabledReason,
}: {
  studentBillId: number;
  balance: number;
  disabledReason?: string;
}) {
  const [state, formAction] = useActionState(createParentCheckoutWithState, initialState);

  useEffect(() => {
    if (state.status === "success" && state.checkoutUrl) {
      window.location.assign(state.checkoutUrl);
    }
  }, [state]);

  const canPay = balance > 0 && !disabledReason;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <CreditCard size={16} className="text-slate-800" />
        <h2 className="text-sm font-black text-gray-900">Online payment</h2>
      </div>
      <p className="mt-1 text-xs font-semibold leading-5 text-gray-400">
        Pay securely through the school&apos;s approved provider. Edujay records the checkout first and confirms payment only after provider verification.
      </p>

      <form action={formAction} className="mt-4 grid gap-3">
        <input type="hidden" name="studentBillId" value={studentBillId} />
        <label className="grid gap-1">
          <span className="text-xs font-black uppercase tracking-wide text-gray-400">Amount to pay</span>
          <input
            name="amount"
            type="number"
            min="0.01"
            max={balance.toFixed(2)}
            step="0.01"
            defaultValue={balance.toFixed(2)}
            disabled={!canPay}
            className="rounded-xl border border-gray-200 px-3 py-3 text-sm font-bold text-gray-800 outline-none focus:border-amber-400 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <span className="text-xs font-semibold text-gray-400">Current balance: {formatGHS(balance)}</span>
        </label>

        {!canPay && (
          <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs font-bold text-gray-500">
            {disabledReason ?? "This bill has no outstanding balance."}
          </p>
        )}
        {state.status === "error" && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{state.message}</p>
        )}
        {state.status === "success" && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
            Redirecting to checkout{state.reference ? ` (${state.reference})` : ""}...
          </p>
        )}

        <SubmitButton />
      </form>
    </div>
  );
}