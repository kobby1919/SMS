"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { resolveFinanceQuery } from "@/src/lib/actions/parentFinanceActions";

type Props = {
  queryId: number;
};

export default function FinanceQueryResolveForm({ queryId }: Props) {
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submit = (status: "RESOLVED" | "CLOSED") => {
    setError(null);
    setSuccess(false);
    if (!response.trim()) {
      setError("Add a short response before closing this query.");
      return;
    }

    startTransition(async () => {
      try {
        await resolveFinanceQuery({ queryId, response, status });
        setResponse("");
        setSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update query.");
      }
    });
  };

  return (
    <div className="mt-3 rounded-xl bg-gray-50 p-3">
      <textarea
        value={response}
        onChange={(event) => setResponse(event.target.value)}
        rows={3}
        placeholder="Write the finance office response..."
        className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-emerald-400"
      />
      {error && <p className="mt-2 text-xs font-bold text-rose-600">{error}</p>}
      {success && (
        <p className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-700">
          <CheckCircle2 size={13} />
          Query updated.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => submit("RESOLVED")}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {isPending && <Loader2 size={13} className="animate-spin" />}
          Mark resolved
        </button>
        <button
          type="button"
          onClick={() => submit("CLOSED")}
          disabled={isPending}
          className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-black text-white hover:bg-gray-800 disabled:opacity-60"
        >
          Close query
        </button>
      </div>
    </div>
  );
}
