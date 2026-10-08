"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { inventoryDatasets, type MigrationInventory } from "@/src/lib/migration/inventory";
import { updateMigrationInventory } from "@/src/lib/actions/migrationInventoryActions";

export default function MigrationInventoryPanel({ initial }: { initial: MigrationInventory | null }) {
  const router = useRouter();
  const [value, setValue] = useState<MigrationInventory>(initial ?? {
    version: 0, status: "DRAFT", source: "", representative: "", acknowledged: false, finance: null,
    rows: inventoryDatasets.map(([key]) => ({ key, disposition: "EXCLUDE", expectedRecords: 0, files: "", reason: "", from: "", to: "" })),
  });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const locked = value.status === "CONFIRMED";
  const inputClass = "w-full min-w-0 rounded border border-gray-300 bg-white px-3 py-2 text-sm";
  const edit = (next: MigrationInventory) => setValue({ ...next, acknowledged: false });
  async function save(status: MigrationInventory["status"]) {
    setPending(true); setMessage("");
    try {
      const result = await updateMigrationInventory({ ...value, status });
      if (!result.ok) { setMessage(result.error); return; }
      setValue(result.value);
      setMessage(status === "CONFIRMED" ? "Scope confirmed. Import only the listed records." : "Draft saved.");
      router.refresh();
    }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save inventory."); }
    finally { setPending(false); }
  }
  return <section className="min-w-0 border-t border-gray-200 py-6">
    <h2 className="text-lg font-semibold">Migration inventory and agreement</h2>
    <p className="mt-1 text-sm text-gray-600">List the records supplied by your school. Confirmation agrees the scope, not that migration is complete. Source filenames are references; files are uploaded below.</p>
    <p className="mt-2 text-sm font-medium">{locked ? "Confirmed" : "Draft"} · Revision {value.version}</p>
    <fieldset disabled={locked || pending} className="mt-4 min-w-0 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Source system or record owner<input className={inputClass} value={value.source} maxLength={200} onChange={(e) => edit({ ...value, source: e.target.value })} /></label>
        <label className="text-sm">School representative<input className={inputClass} value={value.representative} maxLength={150} onChange={(e) => edit({ ...value, representative: e.target.value })} /></label>
      </div>
      {value.rows.map((row, index) => {
        const definition = inventoryDatasets.find(([key]) => key === row.key)!;
        const change = (patch: Partial<typeof row>) => setValue((old) => ({ ...old, acknowledged: false, rows: old.rows.map((r, i) => i === index ? { ...r, ...patch } : r) }));
        return <div key={row.key} className="min-w-0 border-b border-gray-200 pb-4">
          <h3 className="text-sm font-semibold">{definition[1]}</h3>
          {row.key === "students" && <p className="text-xs text-gray-600">Student files also create or link guardians. Include parents and guardians and list this file as their source where applicable.</p>}
          {row.key === "parents" && <p className="text-xs text-gray-600">Count unique guardian profiles across student and guardian files, not one row per child.</p>}
          {row.key === "feeStructures" && <p className="text-xs text-gray-600">Count fee items in the supplied structures, not class/term structure headers.</p>}
          {row.key === "fees" && <p className="text-xs text-gray-600">Count opening bill line items. A student with tuition and transport has two records.</p>}
          {!definition[2] && <p className="text-xs text-gray-600">Requires a separate migration process; not supported by this importer.</p>}
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs">Scope<select className={inputClass} value={row.disposition} onChange={(e) => change({ disposition: e.target.value as typeof row.disposition })}>{definition[2] && <option value="INCLUDE">Include</option>}<option value="DEFER">Defer</option><option value="EXCLUDE">Exclude</option></select></label>
            <label className="text-xs">Expected records<input className={inputClass} type="number" min={0} max={10000000} value={row.expectedRecords} onChange={(e) => change({ expectedRecords: Number(e.target.value) })} /></label>
            <label className="text-xs">Source filenames<input className={inputClass} value={row.files} maxLength={1000} onChange={(e) => change({ files: e.target.value })} /></label>
            <label className="text-xs">Period from (optional)<input className={inputClass} type="date" value={row.from} onChange={(e) => change({ from: e.target.value })} /></label>
            <label className="text-xs">Period to (optional)<input className={inputClass} type="date" value={row.to} onChange={(e) => change({ to: e.target.value })} /></label>
            <label className="text-xs">Scope notes / reason<input className={inputClass} value={row.reason} maxLength={1000} onChange={(e) => change({ reason: e.target.value })} /></label>
          </div>
        </div>;
      })}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!value.finance} onChange={(e) => edit({ ...value, finance: e.target.checked ? { gross: "0", discounts: "0", paid: "0", outstanding: "0" } : null })} />Declare opening bill control totals (GHS)</label>
      {value.finance && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(["gross", "discounts", "paid", "outstanding"] as const).map((key) => <label key={key} className="text-sm capitalize">{key === "paid" ? "Opening paid" : key}<input className={inputClass} inputMode="decimal" value={value.finance![key]} onChange={(e) => edit({ ...value, finance: { ...value.finance!, [key]: e.target.value } })} /></label>)}</div>}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={value.acknowledged} onChange={(e) => setValue({ ...value, acknowledged: e.target.checked })} />I have listed all records supplied for this migration and acknowledged all deferred or excluded records.</label>
    </fieldset>
    <div className="mt-4 flex flex-wrap gap-3">{locked ? <button disabled={pending} className="rounded border px-4 py-2 text-sm" onClick={() => save("DRAFT")}>Revise scope</button> : <><button disabled={pending} className="rounded border px-4 py-2 text-sm" onClick={() => save("DRAFT")}>Save draft</button><button disabled={pending} className="rounded bg-blue-800 px-4 py-2 text-sm text-white" onClick={() => save("CONFIRMED")}>{pending ? "Saving..." : "Confirm scope"}</button></>}</div>
    {message && <p role="status" className="mt-3 break-words text-sm">{message}</p>}
  </section>;
}
