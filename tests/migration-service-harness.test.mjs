import test from "node:test";
import assert from "node:assert/strict";
import { loadMigrationServices } from "../tools/database/migration-service-harness.mjs";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { Prisma } from "../src/generated/prisma/index.js";
import { cleanupStagingFixtures } from "../tools/database/staging-fixture-cleanup.mjs";
import { migrationContest } from "../tools/database/contested-migration.mjs";

test("synthetic cleanup preserves exact scope and removes classes before grades", async () => {
  const ids = [1, 2, 3].map((number) => "concurrency_probe_" + String(number).padStart(36, "0"));
  const deleted = [];
  const tx = Object.fromEntries(["onboardingAuditLog", "migrationStagedUpload", "subject", "class", "grade", "school"].map((name) => [name, {
    deleteMany: async ({ where }) => {
      assert.deepEqual((where.id ?? where.schoolId).in, ids);
      deleted.push(name); return { count: name === "school" ? 3 : 0 };
    },
  }]));
  const prisma = Object.fromEntries(Object.keys(tx).map((name) => [name, { count: async () => 0 }]));
  prisma.school.findMany = async () => ids.map((id) => ({ id, slug: id, name: "Synthetic concurrency rehearsal" }));
  prisma.$transaction = async (work) => work(tx);
  await cleanupStagingFixtures(prisma, ids);
  assert.deepEqual(deleted, ["onboardingAuditLog", "migrationStagedUpload", "subject", "class", "grade", "school"]);
});

test("contest waits for started requests even when its control rollback fails", async () => {
  let settled = false;
  const failure = new Error("Synthetic control connection failure");
  const holder = { query: async (sql) => { if (sql === "ROLLBACK") throw failure; } };
  const contested = migrationContest({ holder, observer: {}, pid: 1, waitForBlocked: async () => {} });
  await assert.rejects(contested("School", "synthetic", async (start) => {
    start(new Promise((resolve) => setTimeout(() => { settled = true; resolve(); }, 10)));
    throw new Error("Synthetic failed check");
  }), (error) => error === failure);
  assert.equal(settled, true);
});

function loadTs(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: (name) => { assert.ok(Object.hasOwn(dependencies, name), name); return dependencies[name]; } });
  return exports;
}

test("interrupted cleanup refuses unknown IDs and non-synthetic school identities before deleting", async () => {
  const ids = [1, 2, 3].map((number) => "concurrency_probe_" + String(number).padStart(36, "0"));
  const prisma = { school: { findMany: async () => [{ id: ids[0], slug: ids[0], name: "Real school" }] },
    $transaction: async () => { throw new Error("Must not delete an unverified fixture."); } };
  await assert.rejects(cleanupStagingFixtures(prisma, ["real-school"]));
  await assert.rejects(cleanupStagingFixtures(prisma, [ids[0], ids[0], ids[0]]));
  await assert.rejects(cleanupStagingFixtures(prisma, ids), (error) => error.code === "ERR_ASSERTION");
});

test("import endpoint returns a safe 409 for raw serialization conflicts and preserves admin scoping", async () => {
  const conflicts = loadTs("src/lib/prisma-conflicts.ts");
  const error = new Prisma.PrismaClientKnownRequestError("Synthetic raw conflict", {
    code: "P2010", clientVersion: "test", meta: { driverAdapterError: { cause: { originalCode: "40001" } } },
  });
  let received;
  class DomainError extends Error {}
  const route = loadTs("src/app/api/admin/data-migration/import/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, ...options }) } },
    "@/src/generated/prisma": { Prisma },
    "@/src/lib/prisma-conflicts": conflicts,
    "@/src/lib/authz": { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ["admin"]); return { schoolId: "authorized-school", userId: "authorized-admin" }; }, unauthorizedResponse: () => ({ status: 500 }) },
    "@/src/lib/services/data-migration-import": { MigrationImportError: DomainError, importValidatedMigrationRows: async (value) => { received = value; throw error; } },
    "@/src/lib/migration/staging": { MigrationStagingError: DomainError, stagedImportSchema: { safeParse: () => ({ success: true, data: { uploadId: "synthetic-upload" } }) } },
    "@/src/lib/migration/request-body": { readMigrationJson: async () => ({ uploadId: "synthetic-upload" }) },
    "@/src/lib/rate-limit": { RateLimitExceededError: DomainError, enforceActionRateLimit: async () => {} },
    "@/src/lib/services/bill-discounts": { BillDiscountError: DomainError }, zod: { z },
  });
  const response = await route.POST({});
  assert.equal(response.status, 409);
  assert.match(response.body.error, /Review the upload and retry/);
  assert.equal(received.schoolId, "authorized-school"); assert.equal(received.actorId, "authorized-admin");
  assert.ok(!JSON.stringify(response).includes("Synthetic raw conflict"));
});

test("advisory transaction locks execute without deserializing PostgreSQL void results", () => {
  let count = 0;
  for (const file of ["migration-staging", "data-migration-import", "bill-discounts"]) {
    const source = ts.createSourceFile(file + ".ts", readFileSync(`src/lib/services/${file}.ts`, "utf8"), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isTaggedTemplateExpression(node) && node.template.getText(source).includes("pg_advisory_xact_lock")) {
        assert.ok(ts.isPropertyAccessExpression(node.tag));
        assert.equal(node.tag.name.text, "$executeRaw"); count++;
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.equal(count, 3);
});

test("import conflict handling recognizes Prisma engine and raw-driver serialization/deadlock errors only", () => {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync("src/lib/prisma-conflicts.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
  const check = exports.isSerializationConflict;
  assert.equal(check({ code: "P2034" }), true);
  for (const code of ["40001", "40P01"]) {
    assert.equal(check({ code: "P2010", meta: { code } }), true);
    assert.equal(check({ code: "P2010", meta: { driverAdapterError: { cause: { originalCode: code } } } }), true);
  }
  for (const error of [null, {}, { code: "P2010" }, { code: "P2010", meta: { code: "23505" } }, { code: "P2010", meta: { message: "40001" } }]) assert.equal(check(error), false);
});

test("subject workflow harness uses actual CSV parser and context-bound encrypted storage without deployment env changes", async () => {
  const before = { ...process.env };
  const services = loadMigrationServices(new Proxy({}, { get() { throw new Error("Offline parser/storage test must not access a database."); } }));
  const source = { areaKey: "subjects", fileName: "test.csv", csv: "Subject\nSynthetic subject\n", mapping: { subjectName: "Subject" } };
  const parsed = services.parser.parseStagedCsv(source);
  assert.equal(parsed.payload.rows[0][0], "Synthetic subject");
  const context = { schoolId: "test-school", uploadId: "test-upload", purpose: "SOURCE" };
  const storage = services.storage.migrationStagingStorage;
  const sealed = await storage.seal(JSON.stringify(source), context);
  assert.ok(!sealed.includes("Synthetic subject"));
  assert.equal(await storage.open(sealed, context), JSON.stringify(source));
  await assert.rejects(storage.open(sealed, { ...context, schoolId: "other-school" }));
  await assert.rejects(storage.open(sealed, { ...context, purpose: "RESULT" }));
  const restarted = loadMigrationServices({}).storage.migrationStagingStorage;
  await assert.rejects(restarted.open(sealed, context));
  assert.deepEqual({ ...process.env }, before);
});
