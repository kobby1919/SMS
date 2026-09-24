"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Send } from "lucide-react";
import { pushWeeklyFinanceSummaryToAdminsWithState, type WeeklyFinanceSummaryPushState } from "@/src/lib/actions/financeActions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
    >
      <Send size={15} />
      {pending ? "Pushing..." : "Push weekly summary"}
    </button>
  );
}

export default function WeeklyFinanceSummaryPushForm({ date }: { date: string }) {
  const initialState: WeeklyFinanceSummaryPushState = { ok: false, message: null };
  const [state, formAction] = useActionState(pushWeeklyFinanceSummaryToAdminsWithState, initialState);

  return (
    <form action={formAction} className="flex w-full flex-col gap-2 sm:w-auto">
      <input type="hidden" name="date" value={date} />
      <SubmitButton />
      {state.message && (
        <p className={`max-w-sm text-xs font-bold ${state.ok ? "text-emerald-700" : "text-rose-600"}`}>
          {state.message}
        </p>
      )}
      {state.ok && typeof state.emailDeliveryCount === "number" && state.skippedEmailCount ? (
        <p className="max-w-sm text-[11px] font-bold text-amber-700">
          {state.skippedEmailCount} admin email delivery{state.skippedEmailCount === 1 ? "" : "ies"} skipped because no Clerk email was found.
        </p>
      ) : null}
    </form>
  );
}