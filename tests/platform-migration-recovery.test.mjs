import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

const read = (path) => readFileSync(path, "utf8");
function load(path, modules, env = {}, globals = {}) {
  const exports = {};
  const js = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(js, { exports, require: (id) => modules[id] ?? {}, process: { env }, console, Date, URL, AbortSignal, ...globals });
  return exports;
}
const core = load("src/lib/migration/recovery.ts", { zod: { z } });

test("school migration receives only a readiness status; technical controls are platform-only", () => {
  const school = read("src/app/(dashboard)/admin/data-migration/page.tsx");
  assert.match(school, /<MigrationRecoveryStatus status=\{migrationRecoveryReadiness/);
  assert.doesNotMatch(school, /<MigrationRecoveryPanel|initial=\{recovery\}/);
  const status = read("src/components/MigrationRecoveryStatus.tsx");
  assert.doesNotMatch(status, /backupReference|databaseReference|recordMigrationRecovery|restoreDrillAt/);
  const platform = read("src/app/(dashboard)/platform/onboarding/recovery/[schoolId]/page.tsx");
  assert.ok(platform.indexOf('requirePageSession(["platform_admin"])') < platform.indexOf("prisma.school.findUnique"));
  assert.match(platform, /<MigrationRecoveryPanel schoolId=\{school.id\}/);
  assert.match(read("src/components/OnboardingRequestsClient.tsx"), /encodeURIComponent\(entry.school.id\)/);
});

test("missing and expired checkpoints stay pending; a hold never becomes ready", () => {
  assert.equal(core.migrationRecoveryReadiness(null, 1, true), "PENDING");
  assert.equal(core.migrationRecoveryReadiness(null, 1, false), "PENDING");
  assert.equal(core.migrationRecoveryReadiness({ status: "HOLD" }, 99, true), "HOLD");
  const now = new Date();
  const plan = { status: "READY", inventoryVersion: 2, evidence: { databaseReference: "production-a", backupAt: now.toISOString(), restoreDrillAt: now.toISOString() } };
  assert.equal(core.migrationRecoveryReadiness(plan, 2, true, now, "production-a"), "READY");
  assert.equal(core.migrationRecoveryReadiness(plan, 3, true, now, "production-a"), "PENDING");
  assert.equal(core.migrationRecoveryReadiness(plan, 2, true, now, "other"), "PENDING");
  assert.equal(core.migrationRecoveryReadiness(plan, 2, true, new Date(now.getTime() + 86400001), "production-a"), "PENDING");
});

test("school admins cannot invoke either platform recovery action", async () => {
  for (const [file, name, args] of [
    ["migrationRecoveryActions", "recordMigrationRecovery", ["target-school", {}]],
    ["neonBackupActions", "checkNeonBackupCatalog", ["target-school"]],
  ]) {
    let effects = 0;
    const actions = load(`src/lib/actions/${file}.ts`, {
      zod: { z },
      "@/src/lib/authz": { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ["platform_admin"]); throw Error("Forbidden"); } },
      "@/src/lib/rate-limit": { enforceActionRateLimit: async () => { effects++; } },
    });
    await assert.rejects(actions[name](...args), /Forbidden/);
    assert.equal(effects, 0);
  }
});

test("platform recovery targets the explicit school and attributes the authenticated operator", async () => {
  const calls = [];
  class RecoveryError extends Error {}
  const actions = load("src/lib/actions/migrationRecoveryActions.ts", {
    zod: { z },
    "@/src/lib/authz": { requireRole: async () => ({ userId: "operator", schoolId: "platform-tenant" }) },
    "@/src/lib/rate-limit": { enforceActionRateLimit: async () => {} },
    "next/cache": { revalidatePath: (path) => calls.push(path) },
    "@/src/lib/services/migration-recovery": { MigrationRecoveryError: RecoveryError, saveMigrationRecovery: async (...args) => { calls.push(args); return { plan: {} }; } },
  });
  const result = await actions.recordMigrationRecovery("school-eis", { status: "HOLD" });
  assert.equal(result.ok, true);
  assert.equal(calls[0][0], "school-eis");
  assert.equal(calls[0][1], "operator");
  assert.ok(calls.includes("/onboarding/setup/migration"));
});

function provider(options = {}) {
  const calls = [];
  const env = { NEON_RECOVERY_PROJECT_ID: "project-a", NEON_RECOVERY_BRANCH_ID: "br-production", NEON_RECOVERY_API_KEY: "private-test-key", DATABASE_URL: "postgresql://user:password@ep-production-pooler.eu.neon.tech/db", ...options.env };
  const rows = options.rows ?? [{ id: "snap-production", source_branch_id: "br-production", created_at: new Date().toISOString(), manual: false }];
  const service = load("src/lib/services/neon-backup-check.ts", { zod: { z } }, env, { fetch: async (url, init) => {
    calls.push({ url, init });
    if (options.networkError) throw Error("Bearer private-test-key");
    return { ok: options.ok ?? true, json: async () => url.endsWith("endpoints")
      ? { endpoints: [{ branch_id: "br-production", host: options.host ?? "ep-production.eu.neon.tech" }] }
      : { snapshots: rows } };
  } });
  return { service, calls };
}

test("Neon catalog check is GET-only, host-bound, uncached and cannot change readiness", async () => {
  const { service, calls } = provider();
  const result = await service.inspectNeonBackupCatalog();
  assert.equal(result.latest.id, "snap-production");
  assert.equal(result.latest.scheduled, true);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.init.method, "GET");
    assert.equal(call.init.cache, "no-store");
    assert.equal(call.init.redirect, "error");
    assert.ok(call.url.startsWith("https://console.neon.tech/api/v2/projects/project-a/"));
  }
  assert.doesNotMatch(JSON.stringify(result), /private-test-key|password|READY/);
  assert.doesNotMatch(read("src/lib/actions/neonBackupActions.ts"), /saveMigrationRecovery/);
});

test("provider mismatch, configuration errors and provider failures fail closed without secret leakage", async () => {
  const mismatch = provider({ host: "ep-other.eu.neon.tech" });
  await assert.rejects(mismatch.service.inspectNeonBackupCatalog(), /does not match/);
  assert.equal(mismatch.calls.length, 1);
  const missing = provider({ env: { NEON_RECOVERY_API_KEY: "" } });
  await assert.rejects(missing.service.inspectNeonBackupCatalog(), /not configured/);
  assert.equal(missing.calls.length, 0);
  for (const options of [{ networkError: true }, { ok: false }]) {
    await assert.rejects(provider(options).service.inspectNeonBackupCatalog(), (error) => /unavailable/.test(error.message) && !/private-test-key/.test(error.message));
  }
});

test("foreign, expired, future and incomplete snapshot entries are not selected", async () => {
  const base = { id: "snap-test", source_branch_id: "br-production", created_at: new Date().toISOString(), manual: true };
  for (const row of [
    { ...base, source_branch_id: "br-other" },
    { ...base, expires_at: "2020-01-01T00:00:00Z" },
    { ...base, created_at: "2099-01-01T00:00:00Z" },
    { ...base, status: "pending" },
  ]) assert.equal((await provider({ rows: [row] }).service.inspectNeonBackupCatalog()).latest, null);
  await assert.rejects(provider({ rows: [{ ...base, created_at: "not-a-date" }] }).service.inspectNeonBackupCatalog(), /unrecognized/);
});
