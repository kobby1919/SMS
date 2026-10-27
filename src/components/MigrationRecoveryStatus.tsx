"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ShieldCheck } from "lucide-react";
import type { MigrationRecoveryReadiness } from "@/src/lib/migration/recovery";

const states = {
  PENDING: { title: "Recovery checks pending", description: "The Edujay platform team must verify recovery readiness before records can be imported. You can continue preparing your files and migration inventory.", tone: "border-amber-200 bg-amber-50 text-amber-950" },
  HOLD: { title: "Migration on hold", description: "The Edujay platform team has paused imports and setup completion. Contact the team before continuing.", tone: "border-rose-200 bg-rose-50 text-rose-950" },
  READY: { title: "Recovery checks ready", description: "The recorded recovery checks are current for this inventory. Continue with file validation and review; readiness is checked again when you import.", tone: "border-emerald-200 bg-emerald-50 text-emerald-950" },
};

export default function MigrationRecoveryStatus({ status }: { status: MigrationRecoveryReadiness }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const state = states[status];
  return (
    <section aria-labelledby="migration-recovery-status" className={`min-w-0 rounded-lg border p-4 ${state.tone}`}>
      <div className="flex items-start gap-3">
        <ShieldCheck size={20} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 id="migration-recovery-status" className="text-base font-bold">{state.title}</h2>
          <p className="mt-2 text-sm leading-6">{state.description}</p>
          <p className="mt-2 text-xs leading-5">Backups and technical recovery checks are managed by Edujay. No database-provider account is needed for school setup.</p>
        </div>
        <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} aria-label="Refresh recovery status" title="Refresh recovery status" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-current/20 disabled:opacity-50">
          <RefreshCw size={18} className={pending ? "animate-spin" : ""} />
        </button>
      </div>
    </section>
  );
}
