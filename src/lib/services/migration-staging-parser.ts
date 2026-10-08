import "server-only";
import { parse } from "csv-parse/sync";
import { stageUploadSchema, MigrationStagingError } from "@/src/lib/migration/staging";
import { migrationValidationPayloadSchema } from "@/src/lib/validation/data-migration";
import { getMigrationAreaDefinition } from "@/src/lib/migration/column-mapping";

export function parseStagedCsv(raw: unknown) {
  const input = stageUploadSchema.parse(raw);
  if (Buffer.byteLength(input.csv, "utf8") > 1000000 || input.csv.includes("\0")) throw new MigrationStagingError("CSV files must be valid text and no larger than 1MB.", 413);
  let records: string[][];
  try { records = parse(input.csv, { bom: true, trim: true, skip_empty_lines: true, max_record_size: 250000 }); }
  catch { throw new MigrationStagingError("CSV format is invalid. Check quoting and column counts before uploading."); }
  const [headers = [], ...rows] = records;
  const normalized = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  if (normalized.some((h) => !h) || new Set(normalized).size !== headers.length) throw new MigrationStagingError("CSV headers must be non-empty and unique.");
  const area = getMigrationAreaDefinition(input.areaKey);
  const fieldKeys = new Set(area.fields.map((field) => field.key));
  const used = Object.values(input.mapping).filter(Boolean);
  if (Object.keys(input.mapping).some((key) => !fieldKeys.has(key)) || used.some((h) => !headers.includes(h)) || new Set(used).size !== used.length || area.fields.some((field) => field.required && !input.mapping[field.key])) throw new MigrationStagingError("Map all required fields to distinct, valid CSV headers.");
  const payload = migrationValidationPayloadSchema.parse({ areaKey: input.areaKey, fileName: input.fileName, headers, rows, mapping: input.mapping });
  return { input, payload };
}
