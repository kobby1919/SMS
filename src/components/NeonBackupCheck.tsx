"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { checkNeonBackupCatalog } from "@/src/lib/actions/neonBackupActions";

type Result = Awaited<ReturnType<typeof checkNeonBackupCatalog>>;

export default function NeonBackupCheck({ schoolId }: { schoolId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  return (
    <div className="mt-4 min-w-0 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h3 className="text-sm font-bold text-gray-900">Neon snapshot catalog</h3>
      <p className="mt-2 text-sm leading-6 text-gray-600">Read-only provider check for this deployment. Snapshot creation dates are not verified recovery cutoffs; this check cannot certify restore success or key recovery and never marks a school ready.</p>
      <button type="button" disabled={pending} onClick={() => startTransition(async () => {
        setResult(null);
        try { setResult(await checkNeonBackupCatalog(schoolId)); }
        catch { setResult({ ok: false, error: "Unable to check backups. No recovery readiness was changed." }); }
      })} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold disabled:opacity-50">
        <RefreshCw size={16} className={pending ? "animate-spin" : ""} />{pending ? "Checking..." : "Check Neon snapshots"}
      </button>
      {result && <div role="status" className="mt-3 break-words text-sm leading-6 text-gray-700">
        {!result.ok ? <p>{result.error}</p> : <>
          <p>{result.catalog.snapshotCount} matching, unexpired snapshot entries found.</p>
          {result.catalog.latest && <p>Latest catalog entry: {result.catalog.latest.id}. Created {result.catalog.latest.createdAt}. {result.catalog.latest.scheduled ? "Scheduled" : "Manual"} snapshot.</p>}
          <p>Catalog checked {result.catalog.checkedAt}. Record verified backup cutoff and restore evidence separately below.</p>
        </>}
      </div>}
    </div>
  );
}
