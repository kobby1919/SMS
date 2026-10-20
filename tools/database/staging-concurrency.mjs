import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs, parseEnv } from "node:util";
import vm from "node:vm";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import ts from "typescript";
import { z } from "zod";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../../src/generated/prisma/index.js";
import { validateTarget, verifyBundle } from "./fresh-install-safety.mjs";
import { runtimeConnectionUrls } from "./runtime-role-policy.mjs";
import { blockedSessionCountSql, postgresErrorCode } from "./concurrency-locks.mjs";
import { checkMigrationWorkflows } from "./migration-workflow-checks.mjs";
import { cleanupStagingFixtures } from "./staging-fixture-cleanup.mjs";
import { checkMigrationRecovery } from "./migration-recovery-checks.mjs";

const { values } = parseArgs({ options: { execute: { type: "boolean", default: false }, workflow: { type: "boolean", default: false }, recovery: { type: "boolean", default: false }, "cleanup-interrupted": { type: "boolean", default: false } } });
const evidenceFile = values.recovery ? "database-evidence/staging-recovery-concurrency.json" : values.workflow ? "database-evidence/staging-workflow-concurrency.json" : "database-evidence/staging-concurrency.json";
const scope = values.recovery ? "Actual subject importer, recovery HOLD, inventory edit and onboarding completion services; synthetic data, test recovery mode, ephemeral key. No production backup evidence, HTTP/auth, finance, load or restore certification."
  : values.workflow
  ? "Full subject CSV staging/import/cancellation/reconciliation service races. Ephemeral encryption key, test recovery mode, no HTTP/auth/cache/people/finance/load or restore certification."
  : "Inventory service concurrency and importer school-lock protocol only; not full import, approval, cancellation, finance, HTTP auth or load certification.";
const directory = realpathSync(".private");
function privatePath(name) {
  const result = path.join(directory, name);
  if (existsSync(result) && !realpathSync(result).startsWith(directory + path.sep)) throw new Error("Private path escapes its directory.");
  return result;
}
function loadService(filename, modules) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports, Date, Set, require(name) {
    if (!Object.hasOwn(modules, name)) throw new Error("Unexpected service dependency; review the integration harness.");
    return modules[name];
  } }, { filename });
  return exports;
}
async function waitForBlocked(observer, pid, count, failures = []) {
  const until = Date.now() + 8000;
  while (Date.now() < until) {
    if (failures.length) throw failures[0];
    const result = await observer.query(blockedSessionCountSql, [pid]);
    if (result.rows[0].count >= count) return;
    await delay(50);
  }
  throw new Error("Did not observe the expected independent blocked database sessions.");
}
async function within(promise, milliseconds) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Independent school operation timed out.")), milliseconds); })]);
  } finally { clearTimeout(timer); }
}

async function main() {
  if (values.workflow && values.recovery) throw new Error("Choose one rehearsal suite.");
  const settings = parseEnv(readFileSync(privatePath("neon-staging-migrations.env"), "utf8"));
  const target = validateTarget({ environment: "staging", url: settings.EDUJAY_MIGRATION_DATABASE_URL,
    expectedHost: settings.EDUJAY_EXPECTED_DATABASE_HOST, productionHost: settings.EDUJAY_PRODUCTION_DATABASE_HOST });
  const runtime = parseEnv(readFileSync(privatePath("neon-staging-runtime.env"), "utf8"));
  const direct = new URL(runtime.EDUJAY_STAGING_DIRECT_URL);
  const urls = runtimeConnectionUrls(settings.EDUJAY_MIGRATION_DATABASE_URL, decodeURIComponent(direct.password));
  if (direct.toString() !== urls.direct || new URL(runtime.DATABASE_URL).toString() !== urls.pooled) throw new Error("Runtime target differs from pinned staging.");
  const { manifest } = verifyBundle();
  const evidence = JSON.parse(readFileSync(privatePath("database-evidence/staging-runtime-role.json"), "utf8"));
  if (evidence.environment !== "staging" || evidence.host !== target.host || evidence.baselineSha256 !== manifest.baselineSha256 ||
      !Array.isArray(evidence.results) || evidence.results.length !== 2 || evidence.results.some((row) => row.checksPassed !== true) ||
      !Number.isFinite(Date.parse(evidence.verifiedAt)) || Date.parse(evidence.verifiedAt) > Date.now() || Date.now() - Date.parse(evidence.verifiedAt) > 7 * 86400_000) throw new Error("Recent matching runtime verification is required.");
  const schemaEvidence = JSON.parse(readFileSync(privatePath("database-evidence/staging-fresh-install.json"), "utf8"));
  if (schemaEvidence.verified !== true || schemaEvidence.host !== target.host || schemaEvidence.baselineSha256 !== manifest.baselineSha256) throw new Error("Staging schema evidence does not match.");
  // This probe covers the real importer's lock protocol, not the whole import workflow.
  assert.match(readFileSync("src/lib/services/data-migration-import.ts", "utf8"), /SELECT "id" FROM "School" WHERE "id" = \$\{context.schoolId\} FOR SHARE/);
  const appPool = new pg.Pool({ connectionString: urls.pooled, max: 4, connectionTimeoutMillis: 15000,
    statement_timeout: 25000, application_name: "edujay-staging-concurrency-app" });
  const controls = new pg.Pool({ connectionString: urls.direct, max: 2, connectionTimeoutMillis: 15000,
    statement_timeout: 25000, application_name: "edujay-staging-concurrency-control" });
  const prisma = new PrismaClient({ adapter: new PrismaPg(appPool), log: [] });
  let holder;
  let observer;
  let created = false;
  let controlError;
  const ids = [0, 1, 2].map(() => "concurrency_probe_" + randomUUID());
  const results = [];
  const pending = [];
  let cleanupPassed = false;
  const run = (name, promise) => {
    const result = { name, passed: false };
    results.push(result);
    pending.push(promise);
    // Observe rejection immediately even while coordinating the other connection.
    promise.catch(() => {});
    return promise.then((value) => { result.passed = true; return value; });
  };
  try {
    holder = await controls.connect();
    observer = await controls.connect();
    holder.on("error", (error) => { controlError = error; });
    observer.on("error", (error) => { controlError = error; });
    await holder.query("SET idle_in_transaction_session_timeout='20s'");
    const identity = (await observer.query("SELECT current_user AS role,current_database() AS database")).rows[0];
    assert.equal(identity.role, "edujay_app"); assert.equal(identity.database, "neondb");
    const locked = (await holder.query("SELECT pg_try_advisory_lock(18453,19000) AS locked")).rows[0].locked;
    if (!locked) throw new Error("Another staging database maintenance operation is active.");
    if (values["cleanup-interrupted"]) {
      if ((!values.workflow && !values.recovery) || !values.execute) throw new Error("Interrupted cleanup requires explicit workflow or recovery execution authorization.");
      const previous = JSON.parse(readFileSync(privatePath(evidenceFile), "utf8"));
      if (previous.environment !== "staging" || previous.host !== target.host || previous.baselineSha256 !== manifest.baselineSha256 || previous.passed !== false || previous.cleanupPassed !== false) throw new Error("No matching interrupted rehearsal evidence.");
      await cleanupStagingFixtures(prisma, previous.fixtureIds);
      writeFileSync(privatePath(evidenceFile), JSON.stringify({ ...previous, status: "INTERRUPTED_CLEANED", cleanupPassed: true, cleanedAt: new Date().toISOString() }, null, 2) + "\n", { mode: 0o600 });
      console.log(JSON.stringify({ interruptedFixturesCleaned: true, rehearsalPassed: false }));
      return;
    }
    const count = await prisma.school.count();
    if (count !== 0 || await prisma.onboardingAuditLog.count() !== 0) throw new Error("Concurrency rehearsal requires empty staging schools/audits; never remove existing data automatically.");
    console.log(JSON.stringify({ environment: "staging", suite: values.recovery ? "RECOVERY_COMPLETION" : values.workflow ? "SUBJECT_WORKFLOWS" : "INVENTORY", mode: values.execute ? "EXECUTE_SYNTHETIC_REHEARSAL" : "READ_ONLY_PREFLIGHT", schoolCount: count }));
    if (!values.execute) return;
    const core = loadService("src/lib/migration/inventory.ts", { zod: { z } });
    const service = loadService("src/lib/services/migration-inventory.ts", {
      "server-only": {}, "@/src/lib/prisma": { default: prisma }, "@/src/generated/prisma": { Prisma },
      "@/src/lib/migration/inventory": core,
    });
    const input = (version = 0, status = "CONFIRMED") => ({ version, status, source: "Synthetic concurrency rehearsal",
      representative: "Synthetic representative", acknowledged: status === "CONFIRMED", finance: null,
      rows: core.inventoryDatasets.map(([key]) => ({ key, disposition: key === "subjects" ? "INCLUDE" : "EXCLUDE",
        expectedRecords: key === "subjects" ? 1 : 0, files: key === "subjects" ? "synthetic-subjects.csv" : "",
        reason: "Synthetic rehearsal only", from: "", to: "" })) });
    writeFileSync(privatePath(evidenceFile), JSON.stringify({ environment: "staging", host: target.host,
      startedAt: new Date().toISOString(), baselineSha256: manifest.baselineSha256, passed: false, fixtureIds: ids, cleanupPassed: false, status: "RUNNING" }, null, 2) + "\n", { mode: 0o600 });
    await prisma.school.createMany({ data: ids.map((id) => ({ id, slug: id, name: "Synthetic concurrency rehearsal" })) });
    created = true;
    if (values.recovery) {
      await checkMigrationRecovery({ prisma, holder, observer, ids, run, waitForBlocked });
    } else if (values.workflow) {
      await checkMigrationWorkflows({ prisma, holder, observer, ids, run, waitForBlocked });
    } else {
    const pid = (await holder.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;

    await run("concurrent_same_revision_has_one_winner_and_one_audit", (async () => {
      await holder.query("BEGIN");
      const requests = [];
      const failures = [];
      try {
        await holder.query('SELECT id FROM public."School" WHERE id=$1 FOR UPDATE', [ids[0]]);
        for (const actor of ["synthetic-admin-a", "synthetic-admin-b"]) {
          const request = service.saveMigrationInventory(ids[0], actor, input());
          request.catch((error) => { failures.push(error); }); requests.push(request);
        }
        await waitForBlocked(observer, pid, 2, failures);
      } finally { await holder.query("ROLLBACK"); await Promise.allSettled(requests); }
      const settled = await Promise.allSettled(requests);
      assert.equal(settled.filter((result) => result.status === "fulfilled").length, 1);
      const failure = settled.find((result) => result.status === "rejected");
      assert.ok(failure.reason instanceof service.MigrationInventoryConflict);
      assert.match(failure.reason.message, /inventory changed/);
      const audits = await prisma.onboardingAuditLog.findMany({ where: { schoolId: ids[0] } });
      assert.equal(audits.length, 1); assert.equal(audits[0].metadata.version, 1);
      assert.equal((await service.getMigrationInventory(ids[0])).version, 1);
      assert.equal(await service.getMigrationInventory(ids[1]), null);
    })());

    await run("locked_school_does_not_block_another_school", (async () => {
      await holder.query("BEGIN");
      let blocked;
      let independent;
      try {
        await holder.query('SELECT id FROM public."School" WHERE id=$1 FOR UPDATE', [ids[0]]);
        blocked = service.saveMigrationInventory(ids[0], "synthetic-admin-a", input(1, "DRAFT"));
        blocked.catch(() => {});
        await waitForBlocked(observer, pid, 1);
        independent = service.saveMigrationInventory(ids[1], "synthetic-admin-b", input());
        const saved = await within(independent, 8000);
        assert.equal(saved.version, 1);
      } finally { await holder.query("ROLLBACK"); await Promise.allSettled([blocked, independent].filter(Boolean)); }
      assert.equal((await blocked).version, 2);
      assert.equal((await service.getMigrationInventory(ids[1])).status, "CONFIRMED");
    })());

    await service.saveMigrationInventory(ids[2], "synthetic-admin-a", input());
    await run("old_serializable_import_snapshot_rejected_after_scope_revision", (async () => {
      await holder.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      try {
        await holder.query('SELECT id FROM public."School" WHERE id=$1', [ids[2]]);
        await service.saveMigrationInventory(ids[2], "synthetic-admin-b", input(1, "DRAFT"));
        await assert.rejects(holder.query('SELECT id FROM public."School" WHERE id=$1 FOR SHARE', [ids[2]]), (error) => error.code === "40001");
      } finally { await holder.query("ROLLBACK"); }
    })());

    await run("active_import_shared_lock_fences_scope_save", (async () => {
      await holder.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      let request;
      try {
        await holder.query('SELECT id FROM public."School" WHERE id=$1 FOR SHARE', [ids[2]]);
        request = service.saveMigrationInventory(ids[2], "synthetic-admin-a", input(2));
        request.catch(() => {});
        await waitForBlocked(observer, pid, 1);
        assert.equal((await service.getMigrationInventory(ids[2])).version, 2);
      } finally { await holder.query("ROLLBACK"); if (request) await Promise.allSettled([request]); }
      assert.equal((await request).version, 3);
    })());
    }
  } finally {
    let cleanupError;
    try {
      if (holder && !controlError) await holder.query("ROLLBACK").catch((error) => { controlError = error; });
      await Promise.allSettled(pending);
      if (created) {
        await cleanupStagingFixtures(prisma, ids);
        cleanupPassed = true;
      }
    } catch (error) { cleanupError = error; }
    finally {
      // Closing the direct holder also releases its session lock after any failure.
      holder?.release(true);
      observer?.release(true);
      const closed = await Promise.allSettled([prisma.$disconnect(), appPool.end(), controls.end()]);
      cleanupError ??= closed.find((result) => result.status === "rejected")?.reason;
    }
    if (values.execute && !values["cleanup-interrupted"]) {
      const passed = results.length === (values.recovery ? 5 : 4) && results.every((result) => result.passed) && cleanupPassed && !cleanupError && !controlError;
      const record = { environment: "staging", host: target.host, verifiedAt: new Date().toISOString(), baselineSha256: manifest.baselineSha256,
        passed, results, fixtureIds: ids, cleanupPassed, scope };
      writeFileSync(privatePath(evidenceFile), JSON.stringify(record, null, 2) + "\n", { mode: 0o600 });
      console.log(JSON.stringify(record));
    }
    if (cleanupError) throw cleanupError;
    if (controlError) throw controlError;
  }
}

main().catch((error) => {
  const known = ["Did not observe the expected independent blocked database sessions.", "Independent school operation timed out."];
  console.error(JSON.stringify({ failed: true, code: /^(?:P\d{4}|\d{5}|ERR_ASSERTION)$/.test(error?.code ?? "") ? error.code : "REHEARSAL_FAILED",
    errorType: error?.constructor?.name,
    databaseCode: postgresErrorCode(error),
    category: /\bvoid\b/i.test(JSON.stringify(error?.meta ?? {})) ? "UNSUPPORTED_VOID_RESULT" : undefined,
    reason: known.includes(error?.message) ? error.message : "Review failed assertion or service exception without exposing query details.",
    actual: typeof error?.actual === "number" ? error.actual : undefined,
    expected: typeof error?.expected === "number" ? error.expected : undefined,
    message: "Staging concurrency rehearsal stopped. Review sanitized evidence and any remaining synthetic fixtures privately; do not retry or delete existing data blindly." }));
  process.exitCode = 1;
});
