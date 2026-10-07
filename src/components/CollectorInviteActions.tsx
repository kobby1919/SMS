"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, RotateCcw, XCircle } from "lucide-react";
import {
  resendCollectorInviteAction,
  revokeCollectorInviteAction,
  type CollectorInviteActionResult,
} from "@/src/lib/actions/collectorInviteActions";

export default function CollectorInviteActions({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleResult(result: CollectorInviteActionResult, fallback: string) {
    if (!result.ok) {
      setError(result.message);
      return;
    }

    if (result.invite?.inviteUrl) {
      navigator.clipboard.writeText(result.invite.inviteUrl).catch(() => undefined);
      setMessage("Invite resent. Link copied.");
      return;
    }

    setMessage(fallback);
  }

  function resend() {
    setMessage(null);
    setError(null);
    setBusyKey("resend");
    startTransition(async () => {
      const result = await resendCollectorInviteAction({ inviteId });
      handleResult(result, "Collector invite resent.");
      setBusyKey(null);
      router.refresh();
    });
  }

  function revoke() {
    setMessage(null);
    setError(null);
    setBusyKey("revoke");
    startTransition(async () => {
      const result = await revokeCollectorInviteAction({ inviteId });
      handleResult(result, "Collector invite revoked.");
      setBusyKey(null);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      {message && <p className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{message}</p>}
      {error && <p className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={resend}
          disabled={isPending}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-2 text-[11px] font-black text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
        >
          {busyKey === "resend" ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
          Resend
        </button>
        <button
          type="button"
          onClick={revoke}
          disabled={isPending}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-rose-100 bg-white px-2 text-[11px] font-black text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
        >
          {busyKey === "revoke" ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
          Revoke
        </button>
      </div>
    </div>
  );
}
