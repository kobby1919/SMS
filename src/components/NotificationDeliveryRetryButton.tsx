"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { RefreshCcw } from "lucide-react";
import {
  retryNotificationDeliveryWithState,
  type NotificationRetryState,
} from "@/src/lib/actions/notificationMonitorActions";

function RetrySubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      <RefreshCcw size={13} />
      {pending ? "Retrying..." : "Retry"}
    </button>
  );
}

export default function NotificationDeliveryRetryButton({ deliveryId }: { deliveryId: string }) {
  const initialState: NotificationRetryState = { ok: false, message: null };
  const [state, formAction] = useActionState(retryNotificationDeliveryWithState, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="deliveryId" value={deliveryId} />
      <RetrySubmitButton />
      {state.message && (
        <p className={`max-w-[220px] text-[11px] font-bold ${state.ok ? "text-emerald-700" : "text-rose-600"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
