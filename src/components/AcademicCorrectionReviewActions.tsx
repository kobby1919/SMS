"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { reviewAcademicCorrectionRequest } from "@/src/lib/actions/caActions";

export default function AcademicCorrectionReviewActions({
  requestId,
}: {
  requestId: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<"APPROVE" | "REJECT" | null>(null);
  const [isPending, startTransition] = useTransition();

  const review = (action: "APPROVE" | "REJECT") => {
    setMessage(null);
    setError(null);
    setActiveAction(action);

    startTransition(async () => {
      try {
        const result = await reviewAcademicCorrectionRequest({
          requestId,
          action,
          note,
        });
        setMessage(result.message);
        setNote("");
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not review academic correction.");
      } finally {
        setActiveAction(null);
      }
    });
  };

  return (
    <div className="mt-3 rounded-xl border border-slate-100 bg-white p-3">
      <label className="text-xs font-black uppercase text-slate-400">
        Admin review note
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          placeholder="Required when rejecting. Optional when approving."
          className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold normal-case text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
        />
      </label>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => review("REJECT")}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {activeAction === "REJECT" ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
          Reject
        </button>
        <button
          type="button"
          onClick={() => review("APPROVE")}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {activeAction === "APPROVE" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          Approve change
        </button>
      </div>
      {message ? <p className="mt-2 text-xs font-bold text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-2 text-xs font-bold text-rose-700">{error}</p> : null}
    </div>
  );
}
