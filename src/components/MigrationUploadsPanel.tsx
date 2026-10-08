"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";

type Upload = { id: string; fileName: string; areaKey: string; status: string; rowCount: number; inventoryVersion: number; checksum: string; expiresAt: string; uploadedBy: string; batchId: string | null };
export default function MigrationUploadsPanel({ onResume, onCancelled, revision, disabled }: { onResume: (id: string) => Promise<void>; onCancelled: (id: string) => void; revision: string; disabled: boolean }) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/admin/data-migration/uploads", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load saved uploads.");
      if (!controller.signal.aborted) { setUploads(data); setError(""); }
    }).catch(() => { if (!controller.signal.aborted) setError("Unable to load saved uploads. Refresh to retry."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, refresh]);
  async function remove(id?: string) {
    if (id && !window.confirm("Cancel this saved upload? No imported school records will be deleted.")) return;
    setPending(true); setError("");
    try {
      const response = await fetch(id ? `/api/admin/data-migration/uploads/${id}` : "/api/admin/data-migration/uploads", { method: id ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to update saved uploads.");
      if (id) onCancelled(id);
      setRefresh((value) => value + 1);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to update saved uploads."); }
    finally { setPending(false); }
  }
  return <div className="mb-5 min-w-0 border-b border-gray-200 pb-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-base font-semibold">Protected uploads</h3><div className="flex gap-2"><button type="button" title="Refresh uploads" aria-label="Refresh uploads" disabled={pending || disabled || loading} onClick={() => setRefresh((value) => value + 1)} className="rounded border p-2"><RefreshCw size={16} /></button><button type="button" disabled={pending || disabled} onClick={() => remove()} className="rounded border px-3 py-2 text-xs">Clear expired files</button></div></div>
    <p className="mt-1 text-xs text-gray-600">Saved separately from live records. Files expire after 7 days; cancelling removes the staged copy, not school records.</p>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {loading ? <p className="mt-3 text-sm text-gray-500">Loading saved uploads...</p> : uploads.length === 0 ? <p className="mt-3 text-sm text-gray-500">No saved uploads yet. Validate a mapped CSV to save it securely.</p> : <ul className="mt-3 divide-y divide-gray-200">{uploads.map((upload) => <li key={upload.id} className="flex min-w-0 flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0"><p className="break-words text-sm font-medium">{upload.fileName}</p><p className="break-words text-xs text-gray-600">{upload.rowCount} rows · {upload.batchId && upload.status === "EXPIRED" ? "Imported; source copy expired" : upload.status === "VALIDATED" ? "Saved for review" : upload.status.toLowerCase()} · Inventory revision {upload.inventoryVersion}</p><p className="text-xs text-gray-500" title={`SHA-256: ${upload.checksum}`}>File ID: {upload.id.slice(0, 8)} · Expires {upload.expiresAt.slice(0, 10)}</p></div>
      {upload.status === "VALIDATED" && <div className="flex shrink-0 gap-2"><button type="button" disabled={pending || disabled} onClick={() => onResume(upload.id)} className="rounded border px-3 py-2 text-xs">Review upload</button><button type="button" disabled={pending || disabled} title="Cancel saved upload" aria-label={`Cancel ${upload.fileName}`} onClick={() => remove(upload.id)} className="rounded border p-2 text-red-700"><Trash2 size={16} /></button></div>}
    </li>)}</ul>}
  </div>;
}
