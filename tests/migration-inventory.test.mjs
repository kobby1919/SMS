import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync("src/lib/migration/inventory.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: () => ({ z }), Date, Set });
const { inventorySchema, inventoryDatasets } = exports;
function valid() {
  return { version: 0, status: "CONFIRMED", source: "School register", representative: "School admin", acknowledged: true, finance: null, rows: inventoryDatasets.map(([key]) => ({ key, disposition: key === "students" ? "INCLUDE" : "EXCLUDE", expectedRecords: key === "students" ? 2 : 0, files: key === "students" ? "students.csv" : "", reason: "Not supplied for this batch", from: "", to: "" })) };
}
test("confirmed scope accepts an explicit supported dataset", () => assert.equal(inventorySchema.safeParse(valid()).success, true));
test("unlisted or duplicate datasets are rejected", () => { const v = valid(); v.rows[1].key = v.rows[0].key; assert.equal(inventorySchema.safeParse(v).success, false); });
test("unsupported historical records cannot silently enter the importer", () => { const v = valid(); v.rows.find((r) => r.key === "paymentHistory").disposition = "INCLUDE"; assert.equal(inventorySchema.safeParse(v).success, false); });
test("excluded records need a reason and included records need a source", () => { const v = valid(); v.rows[0].reason = ""; assert.equal(inventorySchema.safeParse(v).success, false); v.rows[0].reason = "Not supplied"; v.rows.find((r) => r.key === "students").files = ""; assert.equal(inventorySchema.safeParse(v).success, false); });
test("opening controls balance exactly in minor units", () => { const v = valid(); v.finance = { gross: "100.10", discounts: "0.10", paid: "30", outstanding: "70" }; assert.equal(inventorySchema.safeParse(v).success, true); v.finance.outstanding = "70.01"; assert.equal(inventorySchema.safeParse(v).success, false); });
test("invalid dates and reversed ranges are rejected", () => { const v = valid(); v.rows[0].from = "2026-02-30"; assert.equal(inventorySchema.safeParse(v).success, false); v.rows[0].from = "2026-03-01"; v.rows[0].to = "2026-02-01"; assert.equal(inventorySchema.safeParse(v).success, false); });
test("agreement requires acknowledgement", () => { const v = valid(); v.acknowledged = false; assert.equal(inventorySchema.safeParse(v).success, false); });

function serviceFixture() {
  const records = [];
  const tx = { $queryRaw: async () => [], onboardingAuditLog: {
    findFirst: async ({ where }) => [...records].reverse().find((r) => r.schoolId === where.schoolId) ?? null,
    create: async ({ data }) => { records.push(data); return data; },
  } };
  const db = { ...tx, $transaction: async (work) => work(tx) };
  const service = {};
  vm.runInNewContext(ts.transpileModule(readFileSync("src/lib/services/migration-inventory.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: service, require: (key) => key === "@/src/lib/prisma" ? { default: db } : key === "@/src/lib/migration/inventory" ? { inventorySchema } : {} });
  return { service, records };
}
test("inventory reads are school scoped", async () => { const { service } = serviceFixture(); await service.saveMigrationInventory("a", "admin", valid()); assert.equal(await service.getMigrationInventory("b"), null); });
test("stale saves cannot overwrite a confirmed inventory", async () => { const { service, records } = serviceFixture(); await service.saveMigrationInventory("a", "admin", valid()); await assert.rejects(service.saveMigrationInventory("a", "admin", valid()), /changed/); assert.equal(records.length, 1); });
test("revision preserves confirmed agreement history", async () => { const { service, records } = serviceFixture(); const first = await service.saveMigrationInventory("a", "admin", valid()); await assert.rejects(service.saveMigrationInventory("a", "admin", first), /Reopen/); await service.saveMigrationInventory("a", "admin", { ...first, status: "DRAFT" }); assert.equal(records.length, 2); assert.equal(records[0].metadata.status, "CONFIRMED"); assert.equal(records[1].metadata.version, 2); });
