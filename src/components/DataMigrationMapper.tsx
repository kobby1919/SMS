"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
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

type ParsedCsv = {
  headers: string[];
  rows: string[][];
  issues: string[];
};

type ParsedCsvLine = {
  values: string[];
  hasUnclosedQuote: boolean;
};

function parseCsvLine(line: string): ParsedCsvLine {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return { values, hasUnclosedQuote: inQuotes };
}

function parseCsvPreview(csv: string): ParsedCsv {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [], issues: [] };
  }

  const issues: string[] = [];
  const headerLine = parseCsvLine(lines[0]);
  const headers = headerLine.values.map((header) => header.trim());

  if (headerLine.hasUnclosedQuote) {
    issues.push("Header row has an unclosed quote. Fix the CSV before validation.");
  }

  if (headers.some((header) => header.length === 0)) {
    issues.push("Header row contains a blank column name. Rename blank columns before validation.");
  }

  const normalizedHeaderCounts = new Map<string, number>();
  for (const header of headers) {
    const normalized = header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (!normalized) continue;
    normalizedHeaderCounts.set(normalized, (normalizedHeaderCounts.get(normalized) ?? 0) + 1);
  }

  for (const header of headers) {
    const normalized = header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (normalized && (normalizedHeaderCounts.get(normalized) ?? 0) > 1) {
      issues.push(`Header "${header}" appears more than once. Rename duplicate columns before validation.`);
      break;
    }
  }

  const rows = lines.slice(1, MAX_PREVIEW_ROWS + 1).map((line, rowIndex) => {
    const parsed = parseCsvLine(line);
    if (parsed.hasUnclosedQuote) {
      issues.push(`Preview row ${rowIndex + 1} has an unclosed quote. Fix the CSV before validation.`);
    }
    if (parsed.values.length !== headers.length) {
      issues.push(
        `Preview row ${rowIndex + 1} has ${parsed.values.length} value(s), expected ${headers.length}.`,
      );
    }
    return parsed.values;
  });

  return { headers, rows, issues: [...new Set(issues)] };
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
  const [areaKey, setAreaKey] = useState<MigrationAreaKey>("students");
  const [fileName, setFileName] = useState("");
  const [rowEstimate, setRowEstimate] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [csvIssues, setCsvIssues] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  function resetForArea(nextAreaKey: MigrationAreaKey) {
    setAreaKey(nextAreaKey);
    setFileName("");
    setRowEstimate(0);
    setHeaders([]);
    setPreviewRows([]);
    setMapping({});
    setCsvIssues([]);
    setError(null);
  }

  async function handleFile(file: File | undefined) {
    setError(null);
    setHeaders([]);
    setPreviewRows([]);
    setMapping({});
    setCsvIssues([]);
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

    const text = await file.text();
    const parsed = parseCsvPreview(text);

    if (parsed.headers.length === 0 || parsed.headers.every((header) => header.length === 0)) {
      setError("The CSV has no header row. Add column names before uploading.");
      return;
    }

    const allRows = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
    const suggested = suggestColumnMapping(parsed.headers, area);

    setFileName(file.name);
    setRowEstimate(Math.max(0, allRows.length - 1));
    setHeaders(parsed.headers);
    setPreviewRows(parsed.rows);
    setCsvIssues(parsed.issues);
    setMapping(suggested);
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-700">
            <UploadCloud size={14} />
            Point 2
          </div>
          <h2 className="mt-3 text-lg font-black text-gray-950">Upload and map spreadsheet columns</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-gray-500">
            Upload a CSV exported from Excel or Google Sheets. Edujay reads the headers,
            suggests mappings, and shows a small preview. Nothing is saved to live records here.
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
              onChange={(event) => resetForArea(event.target.value as MigrationAreaKey)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-black text-gray-700 outline-none transition focus:border-blue-400"
            >
              {MIGRATION_AREAS.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="block rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 p-4">
            <span className="flex items-center gap-2 text-sm font-black text-blue-900">
              <FileSpreadsheet size={16} />
              CSV upload
            </span>
            <p className="mt-1 text-xs font-semibold leading-5 text-blue-700">
              Export the school spreadsheet as CSV first. Excel `.xlsx` parsing will come after validation storage is added.
            </p>
            <input
              type="file"
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
                    ? "Next point will validate every row before anything is imported."
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
                    onChange={(event) =>
                      setMapping((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-700 outline-none transition focus:border-blue-400"
                    disabled={headers.length === 0}
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
            This step stores nothing in the database. The next step will validate the mapped rows
            before Edujay allows any safe import.
          </p>
        </div>
      </div>
    </section>
  );
}
