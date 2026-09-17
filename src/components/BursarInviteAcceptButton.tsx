"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { acceptBursarInviteAction } from "@/src/lib/actions/bursarInviteActions";

export default function BursarInviteAcceptButton({ token }: { token: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function acceptInvite() {
    setError(null);
    startTransition(async () => {
      const result = await acceptBursarInviteAction({ token });
      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.replace("/bursar");
      router.refresh();
    });
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={acceptInvite}
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 text-sm font-black text-emerald-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
      >
        {isPending ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
        {isPending ? "Connecting account..." : "Connect my bursar account"}
      </button>

      {error && (
        <p className="mt-3 max-w-xl rounded-xl border border-rose-300/25 bg-rose-300/10 px-4 py-3 text-sm font-semibold leading-6 text-rose-100">
          {error}
        </p>
      )}
    </div>
  );
}
