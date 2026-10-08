"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import type { getMigrationRecovery } from "@/src/lib/services/migration-recovery";
import { recordMigrationRecovery } from "@/src/lib/actions/migrationRecoveryActions";
import { recoveryBlockers } from "@/src/lib/migration/recovery";

type Current = Awaited<ReturnType<typeof getMigrationRecovery>>;
export default function MigrationRecoveryPanel({ initial, inventoryVersion, production, databaseReference }: { initial: Current; inventoryVersion: number; production: boolean; databaseReference: string | null }) {
  const router = useRouter();
  const [current, setCurrent] = useState(initial);
  const [status, setStatus] = useState<"READY" | "HOLD">(initial?.plan.status ?? "READY");
  const [decisionOwner, setOwner] = useState(initial?.plan.decisionOwner ?? "");
  const [point, setPoint] = useState(String(initial?.plan.recoveryPointMinutes ?? 60));
  const [time, setTime] = useState(String(initial?.plan.recoveryTimeMinutes ?? 240));
  const [cutoverNote, setNote] = useState(initial?.plan.cutoverNote ?? "");
  const [holdReason, setReason] = useState(initial?.plan.holdReason ?? "");
  const [hasEvidence, setHasEvidence] = useState(!!initial?.plan.evidence || production);
  const [fields, setFields] = useState({ databaseReference: initial?.plan.evidence?.databaseReference ?? "", backupReference: initial?.plan.evidence?.backupReference ?? "", backupAt: initial?.plan.evidence?.backupAt ?? "", restoreDrillReference: initial?.plan.evidence?.restoreDrillReference ?? "", restoreDrillAt: initial?.plan.evidence?.restoreDrillAt ?? "", verifiedBy: initial?.plan.evidence?.verifiedBy ?? "" });
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [keyConfirmed, setKeyConfirmed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const blockers = recoveryBlockers(current?.plan ?? null, inventoryVersion, production, new Date(), databaseReference);
  const changed = () => { setAcknowledged(false); setMessage(""); };
  async function save() {
    setPending(true); setMessage("");
    try {
      const result = await recordMigrationRecovery({ version: current?.plan.version ?? 0, inventoryVersion, status, decisionOwner, recoveryPointMinutes: Number(point), recoveryTimeMinutes: Number(time), cutoverNote, holdReason, acknowledged, evidence: hasEvidence && status === "READY" ? { ...fields, environment: "PRODUCTION", isolatedRestoreConfirmed: restoreConfirmed, encryptedKeyRecoveryConfirmed: keyConfirmed } : null });
      if (!result.ok) { setMessage(result.error); return; }
      setCurrent(result.recovery); setAcknowledged(false); setMessage("Recovery controls recorded."); router.refresh();
    } catch { setMessage("Unable to save. Refresh and try again."); }
    finally { setPending(false); }
  }
  const inputClass = "mt-1 w-full min-w-0 rounded border border-gray-300 p-2";
  return <section aria-labelledby="migration-recovery-title" className="min-w-0 border-t border-gray-200 py-6">
    <h2 id="migration-recovery-title" className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck size={20} />Recovery and cutover</h2>
    <p className="mt-2 text-sm text-gray-600">Keep original school records until reconciliation is approved. Database recovery is handled by the deployment team, never by deleting imported records here.</p>
    {databaseReference && <p className="mt-2 break-words text-sm text-gray-600">Deployment database reference: {databaseReference}</p>}
    <p className="mt-2 text-sm font-medium">{current ? `Latest checkpoint: ${current.plan.status === "HOLD" ? "On hold" : "Recorded"} (${new Date(current.recordedAt).toLocaleString("en-GH", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC).` : "No recovery checkpoint recorded."} {!production && "Development workspace: live backup evidence is still required before production migration."}</p>
    {blockers.length > 0 && <ul className="mt-3 list-inside list-disc text-sm text-amber-800">{blockers.map((item) => <li key={item}>{item}</li>)}</ul>}
    <details className="mt-4" open={production && !current}>
      <summary className="cursor-pointer text-sm font-semibold">{current ? "Review or update recovery controls" : "Record recovery controls"}</summary>
      <fieldset disabled={pending || inventoryVersion === 0} className="mt-4 min-w-0 space-y-4 disabled:opacity-60">
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="min-w-0 text-sm">Decision owner<input value={decisionOwner} onChange={(e) => { setOwner(e.target.value); changed(); }} maxLength={300} className={inputClass} /></label>
          <label className="min-w-0 text-sm">Migration control<select value={status} onChange={(e) => { setStatus(e.target.value as "READY" | "HOLD"); changed(); }} className={inputClass}><option value="READY">Ready to continue</option><option value="HOLD">Hold imports and setup completion</option></select></label>
          <label className="min-w-0 text-sm">Maximum acceptable data loss (minutes)<input type="number" min={1} max={1440} value={point} onChange={(e) => { setPoint(e.target.value); changed(); }} className={inputClass} /></label>
          <label className="min-w-0 text-sm">Target recovery time (minutes)<input type="number" min={1} max={10080} value={time} onChange={(e) => { setTime(e.target.value); changed(); }} className={inputClass} /></label>
        </div>
        <p className="text-xs text-gray-600">Recovery targets are agreed requirements, not a guarantee from the hosting provider.</p>
        <label className="block text-sm">Cutover plan and rollback decision<textarea value={cutoverNote} onChange={(e) => { setNote(e.target.value); changed(); }} rows={3} maxLength={2000} className={inputClass} /></label>
        {status === "HOLD" && <label className="block text-sm">Hold reason<textarea value={holdReason} onChange={(e) => { setReason(e.target.value); changed(); }} rows={2} maxLength={1000} className={inputClass} /></label>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={hasEvidence} disabled={production} onChange={(e) => { setHasEvidence(e.target.checked); setRestoreConfirmed(false); setKeyConfirmed(false); changed(); }} className="mt-1 shrink-0" />Record completed backup and restore-drill evidence</label>
        {hasEvidence && status === "READY" && <div className="min-w-0 space-y-3">
          <p className="text-xs text-gray-600">Use internal evidence references only, never credentials, connection strings or private download links. These are operator attestations, not an automated restore verification.</p>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">{([
            ["databaseReference", "Production database / environment reference"], ["backupReference", "Completed backup reference"], ["backupAt", "Backup time (ISO UTC, e.g. 2026-10-08T12:00:00Z)"], ["restoreDrillReference", "Isolated restore-drill evidence reference"], ["restoreDrillAt", "Restore drill time (ISO UTC)"], ["verifiedBy", "Deployment operator who verified the evidence"],
          ] as const).map(([key, label]) => <label key={key} className="min-w-0 text-sm">{label}<input value={fields[key]} onChange={(e) => { setFields({ ...fields, [key]: e.target.value }); setRestoreConfirmed(false); setKeyConfirmed(false); changed(); }} maxLength={300} className={inputClass} /></label>)}</div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={restoreConfirmed} onChange={(e) => { setRestoreConfirmed(e.target.checked); changed(); }} className="mt-1 shrink-0" />The deployment operator successfully restored into an isolated database and checked records and balances.</label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={keyConfirmed} onChange={(e) => { setKeyConfirmed(e.target.checked); changed(); }} className="mt-1 shrink-0" />Encrypted staging files and required keys can be recovered without exposing them.</label>
        </div>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-1 shrink-0" />I confirm this plan and evidence with the decision owner. No restore or live-data deletion is authorized by this form.</label>
        <button type="button" onClick={save} disabled={pending || !acknowledged || (status === "READY" && hasEvidence && (!restoreConfirmed || !keyConfirmed))} className="w-full rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto">{pending ? "Recording..." : "Save recovery controls"}</button>
      </fieldset>
    </details>
    {inventoryVersion === 0 && <p className="mt-3 text-sm text-gray-600">Confirm the migration inventory first.</p>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </section>;
}
