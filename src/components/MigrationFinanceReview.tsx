"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { getMigrationFinanceStructures, publishMigrationFeeStructure } from "@/src/lib/actions/migrationFinanceActions";

type Structures = Awaited<ReturnType<typeof getMigrationFinanceStructures>>;

export default function MigrationFinanceReview() {
  const [structures, setStructures] = useState<Structures | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    let active = true;
    getMigrationFinanceStructures().then((rows) => { if (active) setStructures(rows); }).catch(() => { if (active) setError("Fee structures could not be loaded. Reload this page to retry."); });
    return () => { active = false; };
  }, []);
  function publish(id: number) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        await publishMigrationFeeStructure(id);
        setStructures(await getMigrationFinanceStructures());
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "Publication failed. Reload and review before retrying.");
      }
    });
  }
  return (
    <details className="mt-5 min-w-0 border-t border-gray-200 pt-5">
      <summary className="cursor-pointer text-base font-bold text-gray-900">Review fee structures</summary>
      <p className="mt-1 text-sm leading-6 text-gray-500">Check standard charges and due dates, then publish before importing student opening bills. Latest 100 structures.</p>
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
      {structures === null && !error && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" />Loading fee structures</p>}
      {structures?.length === 0 && <p className="mt-3 text-sm text-gray-500">Import fee structures first.</p>}
      <div className="mt-3 divide-y divide-gray-200">
        {structures?.map((structure) => (
          <div key={structure.id} className="min-w-0 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 break-words">
                <p className="font-semibold text-gray-900">{structure.grade} · {structure.term.replaceAll("_", " ")} · {structure.academicYear}</p>
                <p className="text-sm text-gray-500">Due: {structure.dueDate ?? "Not set"}</p>
              </div>
              {structure.status === "PUBLISHED" ? <span className="flex items-center gap-1 text-sm text-emerald-700"><CheckCircle2 size={16} />Published</span> : <button type="button" disabled={pending || !structure.dueDate || structure.items.length === 0} onClick={() => publish(structure.id)} className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 size={16} />Publish fee structure</button>}
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {structure.items.map((item) => <li key={item.id} className="flex min-w-0 flex-col gap-1 border-b border-gray-100 py-2 sm:flex-row sm:justify-between"><span className="min-w-0 break-words">{item.name} · {item.category.toLowerCase()} · {item.frequency.toLowerCase()} · {item.optional ? "Optional" : "Required"}</span><span className="shrink-0 font-semibold">GHS {item.amount}</span></li>)}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
