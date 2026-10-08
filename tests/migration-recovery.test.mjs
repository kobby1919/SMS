import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

function load(path, modules, environment = "development") {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: (name) => modules[name] ?? {}, Date, process: { env: { NODE_ENV: environment } } });
  return exports;
}
const core = load("src/lib/migration/recovery.ts", { zod: { z } });
const now = new Date("2026-10-08T12:00:00Z");
function plan() {
  return { version: 0, inventoryVersion: 3, status: "READY", decisionOwner: "School decision owner", recoveryPointMinutes: 60, recoveryTimeMinutes: 240, cutoverNote: "Freeze source writes, reconcile all records and obtain go-no-go approval before release.", holdReason: "", acknowledged: true, evidence: null };
}
function evidence(at = now) {
  return { environment: "PRODUCTION", databaseReference: "production-project-1", backupReference: "backup-123", backupAt: new Date(at.getTime() - 60000).toISOString(), restoreDrillReference: "drill-456", restoreDrillAt: new Date(at.getTime() - 3600000).toISOString(), verifiedBy: "Deployment operator", encryptedKeyRecoveryConfirmed: true, isolatedRestoreConfirmed: true };
}
test("recovery schema rejects tenant/actor injection and unconfirmed evidence", () => {
  assert.equal(core.recoveryInputSchema.safeParse(plan()).success, true);
  for (const extra of [{ schoolId: "other" }, { actorId: "other" }, { acknowledged: false }, { recoveryPointMinutes: 0 }, { recoveryTimeMinutes: 1.5 }]) assert.equal(core.recoveryInputSchema.safeParse({ ...plan(), ...extra }).success, false);
  assert.equal(core.recoveryInputSchema.safeParse({ ...plan(), evidence: { ...evidence(), isolatedRestoreConfirmed: false } }).success, false);
  assert.equal(core.recoveryInputSchema.safeParse({ ...plan(), status: "HOLD" }).success, false);
});
test("checkpoint references reject connection strings and private URLs", () => {
  for (const backupReference of ["postgresql://user:secret@host/db", "https://private/download?token=secret", "sk_live_abc123"]) assert.equal(core.recoveryInputSchema.safeParse({ ...plan(), evidence: { ...evidence(), backupReference } }).success, false);
});
test("production cannot pass with local-development evidence or no plan", () => {
  assert.equal(core.recoveryBlockers(null, 3, false, now).length, 0);
  assert.ok(core.recoveryBlockers(null, 3, true, now).length);
  assert.ok(core.recoveryBlockers(plan(), 3, true, now).length);
  assert.equal(core.recoveryBlockers({ ...plan(), evidence: evidence() }, 3, true, now).length, 0);
});
test("hold blocks every environment even when inventory changed", () => {
  for (const production of [false, true]) assert.match(core.recoveryBlockers({ ...plan(), status: "HOLD", holdReason: "Unreconciled opening balances" }, 99, production, now)[0], /hold/);
});
test("inventory revision invalidates ready checkpoint", () => {
  assert.match(core.recoveryBlockers({ ...plan(), evidence: evidence() }, 4, true, now)[0], /inventory changed/);
});
test("expired and future backup/drill timestamps fail closed", () => {
  for (const [key, date] of [["backupAt", "2026-10-07T11:59:59Z"], ["backupAt", "2026-10-08T12:00:01Z"], ["restoreDrillAt", "2026-09-07T12:00:00Z"], ["restoreDrillAt", "2026-10-08T12:00:01Z"]]) assert.ok(core.recoveryBlockers({ ...plan(), evidence: { ...evidence(), [key]: date } }, 3, true, now).length);
});

function fixture(environment = "development") {
  const state = { inventory: { version: 3, status: "CONFIRMED" }, logs: [], writes: 0, locked: false };
  const tx = {
    $queryRaw: async (_template, schoolId) => { state.locked = true; return schoolId === "a" ? [{ id: "a" }] : []; },
    onboardingAuditLog: {
      findFirst: async ({ where }) => [...state.logs].reverse().find((log) => log.schoolId === where.schoolId && log.action === where.action) ?? null,
      create: async ({ data }) => { assert.equal(state.locked, true); state.writes++; const log = { ...data, id: state.writes, createdAt: new Date() }; state.logs.push(log); return log; },
    },
  };
  const service = load("src/lib/services/migration-recovery.ts", {
    "@/src/lib/prisma": { default: { ...tx, $transaction: async (work) => work(tx) } },
    "@/src/generated/prisma": { Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } } },
    "@/src/lib/services/migration-inventory": { getMigrationInventory: async (schoolId) => schoolId === "a" ? state.inventory : null },
    "@/src/lib/migration/recovery": core,
  }, environment);
  return { state, service, tx };
}
test("recovery records are append-only and school scoped", async () => {
  const { service, state } = fixture();
  const first = await service.saveMigrationRecovery("a", "admin", plan());
  await service.saveMigrationRecovery("a", "admin", { ...plan(), version: first.plan.version, status: "HOLD", holdReason: "Opening balance mismatch" });
  assert.equal(state.logs.length, 2); assert.equal(state.logs[0].metadata.status, "READY");
  assert.equal(await service.getMigrationRecovery("b"), null);
  await assert.rejects(service.saveMigrationRecovery("b", "admin", plan()), /School not found/);
});
test("stale saves and stale scope cannot overwrite checkpoint", async () => {
  const { service, state } = fixture(); await service.saveMigrationRecovery("a", "admin", plan());
  await assert.rejects(service.saveMigrationRecovery("a", "admin", plan()), /plan changed/);
  state.inventory.version = 4;
  await assert.rejects(service.saveMigrationRecovery("a", "admin", { ...plan(), version: 1 }), /current inventory/);
  assert.equal(state.logs.length, 1);
});
test("hold can be recorded during draft scope; ready cannot", async () => {
  const { service, state } = fixture(); state.inventory.status = "DRAFT";
  await service.saveMigrationRecovery("a", "admin", { ...plan(), status: "HOLD", holdReason: "Review source mismatch" });
  await assert.rejects(service.saveMigrationRecovery("a", "admin", { ...plan(), version: 1 }), /current inventory/);
});
test("production save and transaction gate require completed live evidence", async () => {
  const { service, tx, state } = fixture("production");
  await assert.rejects(service.saveMigrationRecovery("a", "admin", plan()), /Production requires/);
  await assert.rejects(service.requireMigrationRecovery("a", 3, tx), /backup/);
  await service.saveMigrationRecovery("a", "admin", { ...plan(), evidence: evidence(new Date()) });
  await service.requireMigrationRecovery("a", 3, tx);
  state.logs[0].metadata.evidence.backupAt = new Date(0).toISOString();
  await assert.rejects(service.requireMigrationRecovery("a", 3, tx), /24 hours/);
});
test("corrupt latest checkpoint cannot silently fall back to an old ready record", async () => {
  const { service, tx, state } = fixture();
  await service.saveMigrationRecovery("a", "admin", plan());
  state.logs.push({ ...state.logs[0], id: 99, metadata: { status: "READY" } });
  await assert.rejects(service.requireMigrationRecovery("a", 3, tx), /invalid/);
});
test("imports and setup transitions gate recovery inside their locked transactions", () => {
  const importer = readFileSync("src/lib/services/data-migration-import.ts", "utf8");
  const gate = importer.indexOf("requireMigrationRecovery(context.schoolId");
  assert.ok(gate > importer.indexOf('FOR SHARE`'));
  assert.ok(gate < importer.indexOf('await importClasses(tx'));
  const setup = readFileSync("src/lib/services/migration-reconciliation.ts", "utf8");
  assert.match(setup, /requireMigrationRecovery\(schoolId, inventory.version, tx\)/);
  assert.match(readFileSync("src/lib/actions/migrationRecoveryActions.ts", "utf8"), /requireRole\(\["admin"\]\)/);
});
