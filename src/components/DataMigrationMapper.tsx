"use client";

import { useMemo, useState, useRef } from "react";
import { parse as parseCsv } from "csv-parse/browser/esm/sync";
import MigrationUploadsPanel from "@/src/components/MigrationUploadsPanel";
import MigrationFinanceReview from "@/src/components/MigrationFinanceReview";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import {
  buildMigrationTemplateCsv,
  getMigrationAreaDefinition,
  MIGRATION_AREAS,
  suggestColumnMapping,
  type MigrationAreaKey,
} from "@/src/lib/migration/column-mapping";

const MAX_MAPPING_FILE_BYTES = 1_000_000;
const MAX_PREVIEW_ROWS = 5;

type ValidationIssue = {
  severity: "ERROR" | "WARNING" | "SKIP";
  field?: string;
  message: string;
};

type ValidationRow = {
  rowNumber: number;
  status: "READY" | "NEEDS_CORRECTION" | "SKIPPED";
  values: Record<string, string>;
  issues: ValidationIssue[];
};

type ValidationResult = {
  uploadId: string;
  checksum: string;
  expiresAt: string;
  totalRows: number;
  readyRows: number;
  skippedRows: number;
  correctionRows: number;
  warningRows: number;
  rows: ValidationRow[];
  summaryIssues: ValidationIssue[];
};

type ImportResult = {
  batchId: string | null;
  importedRows: number;
  skippedRows: number;
  correctionRows: number;
  warningRows: number;
  created: {
    students: number;
    parents: number;
    parentLinks: number;
    teachers: number;
    bursars: number;
    classes: number;
    subjects: number;
    feeBills: number;
    feeLineItems: number;
    feeStructures: number;
    discounts: number;
  };
  dirtyRows: Array<{
    rowNumber: number;
    status: ValidationRow["status"];
    issues: ValidationIssue[];
  }>;
};

type ParsedCsv = {
  headers: string[];
  rows: string[][];
  issues: string[];
};

function parseCsvPreview(csv: string): ParsedCsv {
  try {
    const records: string[][] = parseCsv(csv, { bom: true, trim: true, skip_empty_lines: true, max_record_size: 250000 });
    const [headers = [], ...rows] = records;
    const normalized = headers.map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const issues = normalized.some((header) => !header) || new Set(normalized).size !== headers.length ? ["Headers must be non-empty and unique."] : [];
    if (rows.length > 2000) issues.push("Split the file into batches of at most 2,000 rows.");
    return { headers, rows, issues };
  } catch { return { headers: [], rows: [], issues: ["CSV format is invalid. Check quoting and column counts."] }; }
}

function duplicateMappedHeaders(mapping: Record<string, string>) {
  const counts = new Map<string, number>();
  for (const header of Object.values(mapping).filter(Boolean)) {
    counts.set(header, (counts.get(header) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([header]) => header);
}

function displayHeader(header: string, index: number) {
  return header || `Blank column ${index + 1}`;
}

export default function DataMigrationMapper() {
  const fileVersion = useRef(0);
  const [csvSource, setCsvSource] = useState("");
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [areaKey, setAreaKey] = useState<MigrationAreaKey>("students");
  const [fileName, setFileName] = useState("");
  const [rowEstimate, setRowEstimate] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<string[][]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [csvIssues, setCsvIssues] = useState<string[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = isValidating || isImporting || isReadingFile;

  const area = useMemo(() => getMigrationAreaDefinition(areaKey), [areaKey]);
  const templateHref = useMemo(
    () => `data:text/csv;charset=utf-8,${encodeURIComponent(buildMigrationTemplateCsv(area))}`,
    [area],
  );
  const requiredFields = area.fields.filter((field) => field.required);
  const mappedRequiredCount = requiredFields.filter((field) => mapping[field.key]).length;
  const missingRequiredFields = requiredFields.filter((field) => !mapping[field.key]);
  const duplicateHeaders = duplicateMappedHeaders(mapping);
  const readyForValidation =
    headers.length > 0 &&
    csvIssues.length === 0 &&
    missingRequiredFields.length === 0 &&
    duplicateHeaders.length === 0;
  const cleanValidationRows = validation
    ? validation.rows.filter((row) => row.status === "READY" && row.issues.length === 0).length
    : 0;

  function resetForArea(nextAreaKey: MigrationAreaKey) {
    fileVersion.current += 1;
    setCsvSource("");
    setAreaKey(nextAreaKey);
    setFileName("");
    setRowEstimate(0);
    setHeaders([]);
    setAllRows([]);
    setPreviewRows([]);
    setMapping({});
    setCsvIssues([]);
    setValidation(null);
    setImportResult(null);
    setError(null);
  }

  async function handleFile(file: File | undefined) {
    const version = ++fileVersion.current;
    setCsvSource("");
    setError(null);
    setHeaders([]);
    setAllRows([]);
    setPreviewRows([]);
    setMapping({});
    setCsvIssues([]);
    setValidation(null);
    setImportResult(null);
    setRowEstimate(0);
    setFileName("");

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setError("Upload a CSV file exported from Excel or Google Sheets.");
      return;
    }

    if (file.size > MAX_MAPPING_FILE_BYTES) {
      setError("This mapping preview accepts CSV files up to 1MB. Split very large files before migration.");
      return;
    }

    setIsReadingFile(true);
    let text: string;
    try { text = await file.text(); }
    catch { setError("The file could not be read. Select it again."); return; }
    finally { setIsReadingFile(false); }
    if (version !== fileVersion.current) return;
    const parsed = parseCsvPreview(text);

    if (parsed.headers.length === 0 || parsed.headers.every((header) => header.length === 0)) {
      setError("The CSV has no header row. Add column names before uploading.");
      return;
    }

    const suggested = suggestColumnMapping(parsed.headers, area);
    setCsvSource(text);
    setFileName(file.name);
    setRowEstimate(parsed.rows.length);
    setHeaders(parsed.headers);
    setAllRows(parsed.rows);
    setPreviewRows(parsed.rows.slice(0, MAX_PREVIEW_ROWS));
    setCsvIssues(parsed.issues);
    setMapping(suggested);
  }

  function updateMapping(fieldKey: string, header: string) {
    setValidation(null);
    setImportResult(null);
    setMapping((current) => ({ ...current, [fieldKey]: header }));
  }

  async function validateRows() {
    if (!readyForValidation || isValidating) return;

    setError(null);
    setValidation(null);
    setImportResult(null);
    setIsValidating(true);

    try {
      const response = await fetch("/api/admin/data-migration/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          areaKey,
          mapping,
          csv: csvSource,
          fileName,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error ?? "Validation failed. Please try again.");
        return;
      }
      setValidation(payload as ValidationResult);
    } catch {
      setError("Validation could not be completed. Check your connection and try again.");
    } finally {
      setIsValidating(false);
    }
  }

  async function importCleanRows() {
    if (!validation?.uploadId || cleanValidationRows === 0 || busy) return;

    setError(null);
    setImportResult(null);
    setIsImporting(true);

    try {
      const response = await fetch("/api/admin/data-migration/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId: validation.uploadId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error ?? "Import failed. Please validate again and retry.");
        return;
      }
      setImportResult(payload as ImportResult);
      setValidation(null);
    } catch {
      setError("Import could not be completed. Check your connection and try again.");
    } finally {
      setIsImporting(false);
    }
  }

  async function resumeUpload(id: string) {
    if (busy) return;
    setIsValidating(true); setError(null);
    try {
      const response = await fetch(`/api/admin/data-migration/uploads/${id}`, { cache: "no-store" });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error ?? "Unable to resume upload.");
      fileVersion.current += 1;
      setAreaKey(saved.payload.areaKey); setFileName(saved.payload.fileName);
      setHeaders(saved.payload.headers); setAllRows(saved.payload.rows);
      setPreviewRows(saved.payload.rows.slice(0, MAX_PREVIEW_ROWS)); setRowEstimate(saved.payload.rows.length);
      setMapping(saved.payload.mapping); setCsvSource(saved.csv); setCsvIssues([]);
      setValidation(saved.validation); setImportResult(null);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to resume upload."); }
    finally { setIsValidating(false); }
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <MigrationUploadsPanel onResume={resumeUpload} revision={importResult?.batchId ?? validation?.uploadId ?? "initial"} disabled={busy} onCancelled={(id) => { if (validation?.uploadId === id) setValidation(null); }} />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-700">
            <UploadCloud size={14} />
            Step 1 and 2
          </div>
          <h2 className="mt-3 text-lg font-black text-gray-950">Upload and map spreadsheet columns</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-gray-500">
            Upload a CSV exported from Excel or Google Sheets. Edujay reads the headers,
            suggests mappings, and shows a small preview before validation.
          </p>
        </div>
        <a
          href={templateHref}
          download={`edujay-${area.key}-migration-template.csv`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-xs font-black text-blue-700 transition hover:bg-blue-100 sm:w-auto"
        >
          <Download size={15} />
          Download template
        </a>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-3">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-gray-400">Migration area</span>
            <select
              value={areaKey}
              disabled={busy}
              onChange={(event) => resetForArea(event.target.value as MigrationAreaKey)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-black text-gray-700 outline-none transition focus:border-blue-400"
            >
              {MIGRATION_AREAS.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
            <p className="mt-2 text-xs leading-5 text-gray-500">{area.description}</p>
          </label>
          {["feeStructures", "fees", "discounts"].includes(areaKey) && <MigrationFinanceReview key={importResult?.batchId ?? "finance-review"} />}

          <label className="block rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 p-4">
            <span className="flex items-center gap-2 text-sm font-black text-blue-900">
              <FileSpreadsheet size={16} />
              CSV upload
            </span>
            <p className="mt-1 text-xs font-semibold leading-5 text-blue-700">
              Export the school spreadsheet as CSV before uploading.
            </p>
            <input
              type="file"
              disabled={busy}
              accept=".csv,text/csv"
              onChange={(event) => void handleFile(event.target.files?.[0])}
              className="mt-3 w-full text-xs font-semibold text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-700 file:px-3 file:py-2 file:text-xs file:font-black file:text-white"
            />
          </label>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-black uppercase tracking-wide text-gray-400">Required mapping</p>
            <p className="mt-2 text-2xl font-black text-gray-950">
              {mappedRequiredCount}/{requiredFields.length}
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">
              Required Edujay fields mapped for {area.label.toLowerCase()}.
            </p>
          </div>

          <div className={`rounded-2xl border p-3 ${readyForValidation ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-amber-100 bg-amber-50 text-amber-800"}`}>
            <div className="flex items-start gap-2">
              {readyForValidation ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
              <div>
                <p className="text-sm font-black">
                  {readyForValidation ? "Ready for validation step" : "Mapping not ready yet"}
                </p>
                <p className="mt-1 text-xs font-semibold leading-5">
                  {readyForValidation
                    ? "Edujay can now check every uploaded row before import."
                    : "Upload a file and map every required field before validation."}
                </p>
              </div>
            </div>
          </div>
        </aside>

        <div className="space-y-4">
          {error ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="rounded-2xl border border-gray-100">
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-black text-gray-900">Column mapping</h3>
              <p className="mt-0.5 text-xs font-semibold text-gray-400">
                {fileName ? `${fileName} · ${rowEstimate} data row${rowEstimate === 1 ? "" : "s"} detected` : "Upload a CSV to detect columns."}
              </p>
            </div>

            <div className="divide-y divide-gray-100">
              {area.fields.map((field) => (
                <div key={field.key} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_260px] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-gray-900">{field.label}</p>
                      {field.required ? (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-black uppercase text-rose-700">Required</span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-black uppercase text-gray-500">Optional</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">{field.help}</p>
                  </div>
                  <select
                    value={mapping[field.key] ?? ""}
                    onChange={(event) => updateMapping(field.key, event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-700 outline-none transition focus:border-blue-400"
                    disabled={headers.length === 0 || busy}
                  >
                    <option value="">Not mapped</option>
                    {headers.map((header, index) => (
                      <option key={`${index}-${header}`} value={header}>
                        {displayHeader(header, index)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {headers.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <h3 className="text-sm font-black text-gray-900">Detected columns</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {headers.map((header, index) => (
                    <span key={`${index}-${header}`} className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-black text-gray-600 ring-1 ring-gray-100">
                      {displayHeader(header, index)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <h3 className="text-sm font-black text-gray-900">Mapping issues</h3>
                <div className="mt-3 space-y-2">
                  {csvIssues.length === 0 && missingRequiredFields.length === 0 && duplicateHeaders.length === 0 ? (
                    <p className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                      No mapping issues found yet.
                    </p>
                  ) : null}
                  {csvIssues.map((issue) => (
                    <p key={issue} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-rose-700 ring-1 ring-rose-100">
                      {issue}
                    </p>
                  ))}
                  {missingRequiredFields.map((field) => (
                    <p key={field.key} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-amber-700 ring-1 ring-amber-100">
                      Missing required field: {field.label}
                    </p>
                  ))}
                  {duplicateHeaders.map((header) => (
                    <p key={header} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-rose-700 ring-1 ring-rose-100">
                      Column mapped more than once: {header}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {headers.length > 0 ? (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-black text-blue-950">Step 3: Review issues</h3>
                  <p className="mt-1 text-xs font-semibold leading-5 text-blue-800">
                    Edujay checks every uploaded row against required fields, duplicates, existing records, class names, parent links, gender, terms, and fee amounts before import.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void validateRows()}
                  disabled={!readyForValidation || busy || allRows.length === 0}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-xs font-black text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto"
                >
                  {isValidating ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                  Validate and save upload
                </button>
              </div>

              {validation ? (
                <div className="mt-4 space-y-4">
                  <p className="break-words text-xs text-blue-900">Protected copy saved · File ID {validation.uploadId.slice(0, 8)} · Expires {validation.expiresAt.slice(0, 10)}. Import uses this saved copy.</p>
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                    {[
                      ["Rows checked", validation.totalRows, "text-gray-950"],
                      ["Ready", validation.readyRows, "text-emerald-700"],
                      ["Skipped", validation.skippedRows, "text-slate-700"],
                      ["Need correction", validation.correctionRows, "text-rose-700"],
                      ["Warnings", validation.warningRows, "text-amber-700"],
                    ].map(([label, value, color]) => (
                      <div key={label} className="rounded-xl bg-white p-3 ring-1 ring-blue-100">
                        <p className={`text-xl font-black ${color}`}>{value}</p>
                        <p className="mt-0.5 break-words text-[10px] font-black uppercase leading-snug text-gray-400">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-white">
                    <div className="border-b border-blue-100 px-4 py-3">
                      <h4 className="text-sm font-black text-gray-900">Rows needing admin attention</h4>
                      <p className="mt-0.5 text-xs font-semibold text-gray-500">
                        Showing the first 12 rows with skips, errors, or warnings.
                      </p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {validation.rows.filter((row) => row.issues.length > 0).slice(0, 12).length === 0 ? (
                        <p className="px-4 py-3 text-sm font-bold text-emerald-700">
                          No validation issues found. Review the saved upload before importing clean rows.
                        </p>
                      ) : (
                        validation.rows
                          .filter((row) => row.issues.length > 0)
                          .slice(0, 12)
                          .map((row) => (
                            <div key={row.rowNumber} className="px-4 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-black text-gray-900">CSV row {row.rowNumber}</p>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                                  row.status === "READY"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : row.status === "SKIPPED"
                                      ? "bg-slate-100 text-slate-700"
                                      : "bg-rose-50 text-rose-700"
                                }`}>
                                  {row.status.replaceAll("_", " ").toLowerCase()}
                                </span>
                              </div>
                              <div className="mt-2 space-y-1">
                                {row.issues.map((issue) => (
                                  <p key={`${issue.severity}-${issue.field ?? "row"}-${issue.message}`} className={`text-xs font-bold leading-5 ${
                                    issue.severity === "WARNING"
                                      ? "text-amber-700"
                                      : issue.severity === "SKIP"
                                        ? "text-slate-600"
                                        : "text-rose-700"
                                  }`}>
                                    {issue.field ? `${issue.field}: ` : ""}{issue.message}
                                  </p>
                                ))}
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="text-sm font-black text-emerald-950">Step 4: Import clean records</h4>
                        <p className="mt-1 text-xs font-semibold leading-5 text-emerald-800">
                          Edujay will import only the {cleanValidationRows} clean row{cleanValidationRows === 1 ? "" : "s"}. Rows with warnings, corrections, or skip markers stay outside live records.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void importCleanRows()}
                        disabled={cleanValidationRows === 0 || busy || !validation.uploadId}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-xs font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto"
                      >
                        {isImporting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                        Import clean rows
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {importResult ? (
                <div className="mt-4 rounded-2xl border border-emerald-100 bg-white p-4">
                  <h4 className="text-sm font-black text-gray-900">Safe import completed</h4>
                  {importResult.batchId ? (
                    <p className="mt-1 break-all text-xs font-bold text-gray-500">
                      Audit batch: {importResult.batchId}
                    </p>
                  ) : null}
                  <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                    {[
                      ["Imported rows", importResult.importedRows],
                      ["Skipped rows", importResult.skippedRows],
                      ["Need correction", importResult.correctionRows],
                      ["Warnings", importResult.warningRows],
                      ["Students", importResult.created.students],
                      ["Parents", importResult.created.parents],
                      ["Parent links", importResult.created.parentLinks],
                      ["Fee lines", importResult.created.feeLineItems],
                      ["Fee structures", importResult.created.feeStructures],
                      ["Discounts", importResult.created.discounts],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-gray-50 p-3">
                        <p className="text-lg font-black text-gray-950">{value}</p>
                        <p className="mt-0.5 break-words text-[10px] font-black uppercase leading-snug text-gray-400">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs font-semibold leading-5 text-gray-500">
                    Dirty rows were not imported. Fix them in the spreadsheet, upload again, validate again, then import the corrected rows.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {previewRows.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-gray-100">
              <div className="border-b border-gray-100 px-4 py-3">
                <h3 className="text-sm font-black text-gray-900">Preview sample</h3>
                <p className="mt-0.5 text-xs font-semibold text-gray-400">First {previewRows.length} row{previewRows.length === 1 ? "" : "s"} only. Full validation comes next.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full text-left text-sm">
                  <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-wide text-gray-400">
                    <tr>
                      {headers.map((header, index) => (
                        <th key={`${index}-${header}`} className="px-3 py-2">{displayHeader(header, index)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewRows.map((row, index) => (
                      <tr key={`${index}-${row.join("|")}`}>
                        {headers.map((header, headerIndex) => (
                          <td key={`${headerIndex}-${header}`} className="px-3 py-2 text-xs font-semibold text-gray-600">
                            {row[headerIndex] || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-blue-700" />
          <p className="text-sm font-semibold leading-6 text-blue-800">
            Review the validation results carefully. Edujay imports only clean rows and keeps rows with warnings, errors, or skip markers outside the live school records.
          </p>
        </div>
      </div>
    </section>
  );
}
