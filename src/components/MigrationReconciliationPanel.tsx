"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, RefreshCw } from "lucide-react";
import type { getMigrationReconciliation } from "@/src/lib/services/migration-reconciliation";
import { approveSchoolMigration } from "@/src/lib/actions/migrationReconciliationActions";
import { inventoryDatasets } from "@/src/lib/migration/inventory";

type Report = Awaited<ReturnType<typeof getMigrationReconciliation>>;
export default function MigrationReconciliationPanel({ report }: { report: Report }) {
  const router = useRouter();
  const [representative, setRepresentative] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [checkedSamples, setCheckedSamples] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [approvedFingerprint, setApprovedFingerprint] = useState<string | null>(null);
  const approved = !!report.approval || approvedFingerprint === report.fingerprint;
  async function approve() {
    setPending(true); setMessage("");
    try {
      const result = await approveSchoolMigration({ fingerprint: report.fingerprint, representative, reviewNote, checkedSamples, acknowledged });
      if (!result.ok) { setMessage(result.error); return; }
      setApprovedFingerprint(report.fingerprint); setMessage("School approval recorded."); router.refresh();
    } catch { setMessage("Unable to record approval. Refresh and try again."); }
    finally { setPending(false); }
  }
  return <section className="min-w-0 border-t border-gray-200 py-6" aria-labelledby="migration-reconciliation-title">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="migration-reconciliation-title" className="text-lg font-semibold">Reconciliation and school approval</h2>
      <div className="flex flex-wrap gap-4"><a href="/api/admin/data-migration/reconciliation/export" className="inline-flex items-center gap-2 text-sm text-blue-700"><Download size={16} />Download review</a><button type="button" onClick={() => router.refresh()} disabled={pending} className="inline-flex items-center gap-2 text-sm text-blue-700"><RefreshCw size={16} />Refresh review</button></div>
    </div>
    <p className="mt-2 text-sm text-gray-600">Compare the agreed scope with imported records. Review sample names, class placement, guardian links and opening balances against the school&apos;s source records before approval.</p>
    {report.rows.length === 0 ? <p className="mt-4 text-sm">Confirm the inventory to begin reconciliation.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {report.rows.map((row) => <article key={row.key} className="min-w-0 rounded-lg border border-gray-200 p-3">
        <h3 className="text-sm font-semibold">{inventoryDatasets.find(([key]) => key === row.key)?.[1] ?? row.key}</h3>
        <p className="mt-1 text-xs text-gray-600">{row.unit}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><div><dt className="text-gray-500">Agreed</dt><dd className="break-all font-semibold">{row.expected}</dd></div><div><dt className="text-gray-500">Verified</dt><dd className="break-all font-semibold">{row.present}</dd></div></dl>
        <p className={`mt-2 text-sm ${row.difference ? "text-red-700" : "text-green-700"}`}>{row.difference === 0 ? "Counts match" : `${row.difference > 0 ? "+" : ""}${row.difference} difference`}</p>
      </article>)}
    </div>}
    {report.finance.expected && <div className="mt-5 min-w-0">
      <h3 className="text-sm font-semibold">Opening financial controls (GHS)</h3>
      <p className="mt-1 text-xs text-gray-600">Opening paid balances are historical credits, not new collections or receipts.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{(["gross", "discounts", "paid", "outstanding"] as const).map((key) => <div key={key} className="min-w-0 border-l-2 border-gray-200 pl-3 text-sm"><p className="capitalize font-semibold">{key}</p><p className="break-all text-gray-600">Agreed: {report.finance.expected![key]}</p><p className="break-all">Imported: {report.finance.actual[key]}</p></div>)}</div>
    </div>}
    {report.batches.length > 0 && <details className="mt-5 text-sm"><summary className="cursor-pointer font-medium">Import evidence ({report.batches.length} batches)</summary><ul className="mt-2 space-y-2">{report.batches.map((batch) => <li key={batch.id} className="break-words border-b border-gray-100 py-2">{batch.fileName}: {batch.importedRows} imported rows; {batch.skippedRows} rows held outside this batch. {batch.hasEvidence ? "Record evidence saved." : "Legacy batch: evidence review required."}</li>)}</ul></details>}
    <details className="mt-5 text-sm"><summary className="cursor-pointer font-medium">Deferred and excluded records</summary><ul className="mt-2 space-y-2">{report.scope.filter((row) => row.disposition !== "INCLUDE").map((row) => <li key={row.key} className="break-words">{inventoryDatasets.find(([key]) => key === row.key)?.[1] ?? row.key}: {row.disposition.toLowerCase()} - {row.reason}</li>)}</ul></details>
    {(report.samples.students.length > 0 || report.samples.guardians.length > 0) && <details className="mt-5 text-sm"><summary className="cursor-pointer font-medium">Sample student and guardian records</summary><div className="mt-3 grid gap-4 sm:grid-cols-2"><div><h3 className="font-semibold">Class placement</h3>{report.samples.students.map((student, index) => <p key={index} className="mt-2 break-words">{student.admissionNumber}: {student.name} - {student.className}</p>)}</div><div><h3 className="font-semibold">Guardian links</h3>{report.samples.guardians.map((guardian, index) => <p key={index} className="mt-2 break-words">{guardian.admissionNumber}: {guardian.name} ({guardian.role.replaceAll("_", " ").toLowerCase()})</p>)}</div></div></details>}
    {report.blockers.length > 0 && <div className="mt-5 border-l-2 border-amber-500 pl-3"><h3 className="text-sm font-semibold">Resolve before approval</h3><ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-900">{report.blockers.map((blocker) => <li key={blocker} className="break-words">{blocker}</li>)}</ul></div>}
    {approved ? <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-green-700"><CheckCircle2 size={18} />School approval recorded{report.approval ? ` by ${report.approval.representative}` : ""}.</p> : <fieldset disabled={pending || !report.canApprove} className="mt-5 min-w-0 space-y-3 disabled:opacity-60">
      <label className="block text-sm">School representative<input value={representative} onChange={(e) => { setRepresentative(e.target.value); setAcknowledged(false); }} maxLength={150} className="mt-1 w-full rounded border border-gray-300 p-2" /></label>
      <label className="block text-sm">Review note<textarea value={reviewNote} onChange={(e) => { setReviewNote(e.target.value); setAcknowledged(false); }} maxLength={2000} rows={3} className="mt-1 w-full rounded border border-gray-300 p-2" /></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={checkedSamples} onChange={(e) => setCheckedSamples(e.target.checked)} className="mt-1 shrink-0" />I checked sample records and guardian links against our source files.</label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-1 shrink-0" />I confirm the agreed records and opening balances are correct. Deferred and excluded records remain outside this approval.</label>
      <button type="button" onClick={approve} disabled={pending || !checkedSamples || !acknowledged || representative.trim().length < 2 || reviewNote.trim().length < 10} className="w-full rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto">{pending ? "Recording approval..." : "Approve school migration"}</button>
    </fieldset>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </section>;
}
