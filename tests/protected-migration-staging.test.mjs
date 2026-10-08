import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import * as crypto from "node:crypto";
import path from "node:path";
import { parse } from "csv-parse/sync";

function load(file, dependencies = {}, extra = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, { exports, require: (name) => {
    if (name === "server-only") return {};
    if (!(name in dependencies)) throw new Error(`Missing dependency: ${name}`);
    return dependencies[name];
  }, Buffer, Date, Set, Map, console, ...extra });
  return exports;
}
const columns = load("src/lib/migration/column-mapping.ts");
const validation = load("src/lib/validation/data-migration.ts", { zod: { z }, "@/src/lib/migration/column-mapping": columns });
const staging = load("src/lib/migration/staging.ts", { zod: { z }, "@/src/lib/validation/data-migration": validation });
const parser = load("src/lib/services/migration-staging-parser.ts", { "csv-parse/sync": { parse }, "@/src/lib/migration/staging": staging, "@/src/lib/validation/data-migration": validation, "@/src/lib/migration/column-mapping": columns });
const body = load("src/lib/migration/request-body.ts", { "@/src/lib/migration/staging": staging }, { URL });
const input = () => ({ areaKey: "subjects", fileName: "subjects.csv", csv: "Subject,Code\nEnglish,ENG", mapping: { subjectName: "Subject", code: "Code" } });

test("server CSV parser preserves quoted commas and multiline cells", () => { const data = input(); data.csv = 'Subject,Code\n"English, Language",ENG\n"Creative\nArts",ART'; const parsed = parser.parseStagedCsv(data); assert.equal(parsed.payload.rows[0][0], "English, Language"); assert.equal(parsed.payload.rows[1][0], "Creative\nArts"); });
test("bad quoting and uneven columns are rejected", () => { const data = input(); data.csv = 'Subject,Code\n"English,ENG'; assert.throws(() => parser.parseStagedCsv(data)); data.csv = "Subject,Code\nEnglish,ENG,extra"; assert.throws(() => parser.parseStagedCsv(data)); });
test("blank or normalized duplicate headers cannot hide columns", () => { const data = input(); data.csv = "Subject,subject\nEnglish,Math"; assert.throws(() => parser.parseStagedCsv(data)); data.csv = "Subject,\nEnglish,ENG"; assert.throws(() => parser.parseStagedCsv(data)); });
test("mapping cannot reference unknown fields or reuse source columns", () => { const data = input(); data.mapping = { subjectName: "Subject", code: "Subject" }; assert.throws(() => parser.parseStagedCsv(data)); data.mapping = { subjectName: "Subject", schoolId: "Code" }; assert.throws(() => parser.parseStagedCsv(data)); });
test("byte limits apply to Unicode, not just character count", () => { const data = input(); data.csv = "Subject,Code\n" + "界".repeat(400000); assert.throws(() => parser.parseStagedCsv(data), /1MB/); });
test("paths and caller-supplied school identities are rejected", () => { const data = input(); data.fileName = "../subjects.csv"; assert.throws(() => parser.parseStagedCsv(data)); data.fileName = "subjects.csv"; data.schoolId = "another-school"; assert.throws(() => parser.parseStagedCsv(data)); });
test("import schema rejects raw rows alongside a staging ID", () => { assert.equal(staging.stagedImportSchema.safeParse({ uploadId: crypto.randomUUID(), rows: [["forged"]] }).success, false); });

function storage(env = { NODE_ENV: "production", MIGRATION_STAGING_ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64") }) {
  return load("src/lib/services/migration-staging-storage.ts", { "node:crypto": crypto, "node:fs/promises": { readFile: async () => "" }, "node:path": path }, { process: { env, cwd: () => "/tmp" } });
}
const context = { schoolId: "school-a", uploadId: crypto.randomUUID(), purpose: "SOURCE" };
test("staging ciphertext does not expose original records", async () => { const { migrationStagingStorage: adapter } = storage(); const encrypted = await adapter.seal("private@example.com", context); assert.ok(!encrypted.includes("private@example.com")); assert.equal(await adapter.open(encrypted, context), "private@example.com"); assert.notEqual(encrypted, await adapter.seal("private@example.com", context)); });
test("school, upload and result contexts cannot decrypt another source", async () => { const { migrationStagingStorage: adapter } = storage(); const encrypted = await adapter.seal("private", context); for (const changed of [{ schoolId: "school-b" }, { uploadId: crypto.randomUUID() }, { purpose: "RESULT" }]) await assert.rejects(adapter.open(encrypted, { ...context, ...changed })); });
test("tampered ciphertext fails authentication", async () => { const { migrationStagingStorage: adapter } = storage(); const encrypted = (await adapter.seal("private", context)).split(":"); const bytes = Buffer.from(encrypted[3], "base64"); bytes[0] ^= 1; encrypted[3] = bytes.toString("base64"); await assert.rejects(adapter.open(encrypted.join(":"), context)); });
test("production refuses a missing or weak encryption key", async () => { for (const value of [undefined, "weak-key"]) { const { migrationStagingStorage: adapter } = storage({ NODE_ENV: "production", MIGRATION_STAGING_ENCRYPTION_KEY: value }); await assert.rejects(adapter.seal("private", context), /not configured/); } });

test("request bodies are bounded without a content-length header", async () => { const request = new Request("http://localhost/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: "x".repeat(200) }) }); await assert.rejects(body.readMigrationJson(request, 100), /too large/); });
test("cross-site writes cannot reuse an admin session", async () => { const request = new Request("http://localhost/upload", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://other.example" }, body: "{}" }); await assert.rejects(body.readMigrationJson(request, 100), /Cross-site/); });
test("imports atomically consume the saved snapshot and preserve its checksum", () => { const importer = readFileSync("src/lib/services/data-migration-import.ts", "utf8"); assert.match(importer, /loadStagedMigration\(request.schoolId, request.uploadId\)/); assert.match(importer, /"schoolId" = \$\{context.schoolId\} FOR UPDATE/); assert.match(importer, /inventory.version !== staged.upload.inventoryVersion/); assert.match(importer, /status: "IMPORTED", importedAt:/); assert.match(importer, /sourceChecksum: upload.checksum/); assert.match(importer, /readStagedImportResult/); });

function importFixture() {
  const uploadId = crypto.randomUUID();
  const upload = { id: uploadId, schoolId: "a", status: "VALIDATED", checksum: "digest", encryptedPayload: "source", encryptedResult: null, inventoryVersion: 3, expiresAt: new Date(Date.now() + 60000) };
  const payload = { areaKey: "subjects", headers: ["Subject"], rows: [["English"]], mapping: { subjectName: "Subject" }, fileName: "subjects.csv" };
  const writes = [];
  const audits = [];
  let inventoryVersion = 3;
  const tx = { $queryRaw: async () => [{ id: uploadId }], migrationStagedUpload: { findFirst: async () => ({ ...upload }), update: async ({ data }) => Object.assign(upload, data) }, subject: { create: async ({ data }) => { writes.push(data); return data; } }, onboardingAuditLog: { create: async ({ data }) => { audits.push(data); return data; } } };
  const importer = load("src/lib/services/data-migration-import.ts", {
    crypto, "@/src/generated/prisma": { Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } } },
    "@/src/lib/prisma": { $transaction: async (work) => work(tx) },
    "@/src/lib/cacheTags": { revalidateDashboard() {}, revalidateReferenceData() {} },
    "@/src/lib/services/user-management": {}, "@/src/lib/services/bill-discounts": {},
    "@/src/lib/services/data-migration-validation": { validateMigrationRows: async () => ({ totalRows: 1, skippedRows: 0, correctionRows: 0, warningRows: 0, rows: [{ rowNumber: 2, status: "READY", values: { subjectName: "English" }, issues: [] }] }) },
    "@/src/lib/services/migration-inventory": { getMigrationInventory: async () => ({ version: inventoryVersion, status: "CONFIRMED", rows: [{ key: "subjects", disposition: "INCLUDE" }] }) },
    "@/src/lib/migration/inventory": { inventorySchema: { safeParse: () => ({ success: true }) } },
    "@/src/lib/services/migration-staging": { loadStagedMigration: async (schoolId) => { if (schoolId !== upload.schoolId) throw new Error("Upload not found"); return { payload, upload: { ...upload } }; }, readStagedImportResult: async (_schoolId, _uploadId, saved) => JSON.parse(saved) },
    "@/src/lib/services/migration-staging-storage": { migrationStagingStorage: { seal: async (text) => text } },
  });
  return { importer, request: { schoolId: "a", actorId: "admin", uploadId }, upload, writes, audits, revise: () => { inventoryVersion += 1; } };
}
test("retrying the same imported upload returns its result without a second write", async () => {
  const { importer, request, writes, audits, upload } = importFixture();
  const first = await importer.importValidatedMigrationRows(request);
  const again = await importer.importValidatedMigrationRows(request);
  assert.equal(first.batchId, again.batchId); assert.equal(writes.length, 1); assert.equal(audits.length, 1); assert.equal(upload.status, "IMPORTED");
});
test("a revised inventory blocks staged imports before live writes", async () => {
  const { importer, request, writes, revise } = importFixture(); revise();
  await assert.rejects(importer.importValidatedMigrationRows(request), /scope changed/); assert.equal(writes.length, 0);
});
test("cancelled and expired stages cannot create live records", async () => {
  for (const status of ["CANCELLED", "VALIDATED"]) {
    const { importer, request, upload, writes } = importFixture(); upload.status = status;
    if (status === "VALIDATED") upload.expiresAt = new Date(0);
    await assert.rejects(importer.importValidatedMigrationRows(request), /expired/); assert.equal(writes.length, 0);
  }
});
test("another school cannot import the saved upload", async () => {
  const { importer, request, writes } = importFixture();
  await assert.rejects(importer.importValidatedMigrationRows({ ...request, schoolId: "b" }), /not found/); assert.equal(writes.length, 0);
});
