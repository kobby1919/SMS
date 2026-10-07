"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { acceptCollectorInviteAction } from "@/src/lib/actions/collectorInviteActions";

export default function CollectorInviteAcceptButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function acceptInvite() {
    setError(null);
    startTransition(async () => {
      const result = await acceptCollectorInviteAction({ token });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.replace("/collector");
      router.refresh();
    });
  }

  return (
    <div className="mt-8">
      {error && (
        <div className="mb-4 rounded-xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm font-semibold leading-6 text-rose-100">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={acceptInvite}
        disabled={isPending || !token}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-200 px-5 py-3 text-sm font-black text-blue-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {isPending && <Loader2 size={16} className="animate-spin" />}
        {isPending ? "Connecting account..." : "Accept collector invite"}
      </button>
    </div>
  );
}
