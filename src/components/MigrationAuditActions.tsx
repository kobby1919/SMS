"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, Loader2 } from "lucide-react";

export default function MigrationAuditActions({
  auditLogId,
  hasErrors,
  isProblematic,
}: {
  auditLogId: number;
  hasErrors: boolean;
  isProblematic: boolean;
}) {
  const router = useRouter();
  const [isMarking, setIsMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markProblematic() {
    if (isProblematic || isMarking) return;

    const note = window.prompt(
      "Why should this import batch be reviewed?",
      "Marked for admin review after migration check.",
    );
    if (note === null) return;

    setError(null);
    setIsMarking(true);
    try {
      const response = await fetch(`/api/admin/data-migration/audit/${auditLogId}/problematic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error ?? "Could not mark this batch for review.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not mark this batch for review. Check your connection and try again.");
    } finally {
      setIsMarking(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <a
          href={`/api/admin/data-migration/audit/${auditLogId}/error-report`}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[11px] font-black transition ${
            hasErrors
              ? "bg-white text-blue-700 ring-1 ring-blue-100 hover:bg-blue-50"
              : "pointer-events-none bg-white text-gray-400 ring-1 ring-gray-100"
          }`}
          aria-disabled={!hasErrors}
        >
          <Download size={13} />
          Error report
        </a>
        <button
          type="button"
          onClick={() => void markProblematic()}
          disabled={isProblematic || isMarking}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-[11px] font-black text-amber-700 ring-1 ring-amber-100 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:ring-gray-100"
        >
          {isMarking ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />}
          {isProblematic ? "Under review" : "Mark problematic"}
        </button>
      </div>
      {error ? <p className="text-xs font-bold text-rose-700">{error}</p> : null}
    </div>
  );
}
