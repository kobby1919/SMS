import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const nodeRequire = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const loadedModule = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)((id) => Object.hasOwn(mocks, id) ? mocks[id] : id === "server-only" ? {} : id.startsWith("@/") ? load(`${id.slice(2)}.ts`, mocks) : nodeRequire(id), loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const input = { classId: 1, academicYear: "2026/27", term: "TERM_1" };
const actor = { role: "admin", schoolId: "school-a", userId: "admin-a" };
const date = new Date("2026-10-13T12:00:00Z");
function fixture(options = {}) {
  const state = { window: options.window ?? null, audits: [], transactions: 0 };
  const guard = (q) => assert.equal(q.where?.schoolId ?? q.where?.schoolId_classId_term_academicYear?.schoolId ?? q.data.schoolId, "school-a");
  const prisma = { $transaction: async (work, settings) => {
    state.transactions++;
    assert.equal(settings.isolationLevel, "Serializable");
    let window = state.window;
    const audits = [];
    const tx = {
      class: { findFirst: async (q) => { guard(q); return options.foreign ? null : { name: "KG1" }; } },
      examEntryWindow: {
        findUnique: async (q) => { guard(q); return window; },
        create: async (q) => { guard(q); window = { ...q.data, id: 1, updatedAt: date }; return window; },
        updateMany: async (q) => { guard(q); assert.equal(q.where.updatedAt, window.updatedAt); if (options.stale) return { count: 0 }; window = { ...window, ...q.data }; return { count: 1 }; },
      },
      cAAuditLog: { create: async (q) => { guard(q); if (options.auditFail) throw new Error("Audit failed"); audits.push(q.data); } },
    };
    const result = await work(tx);
    state.window = window; state.audits.push(...audits);
    return result;
  } };
  const service = load("src/lib/services/exam-entry-window.ts", {
    "@/src/lib/prisma": prisma,
    "@/src/lib/services/academic-period": { requireActiveAcademicConfig: async (school) => { assert.equal(school, "school-a"); return { academicYear: options.wrongPeriod ? "old" : input.academicYear, currentTerm: input.term, examWeight: options.noExam ? 0 : 70 }; } },
    "@/src/lib/services/report-publication": { assertReportSetEditable: async () => { if (options.locked) throw new Error("Reports locked"); } },
  });
  return { state, run: (mode, who = actor) => service.transitionExamEntryWindow(mode, input, who) };
}

test("exam transitions atomically audit, preserve repeated-click history and permit explicit reopening", async () => {
  const f = fixture();
  await f.run("OPEN");
  const openedAt = f.state.window.openedAt;
  await f.run("OPEN");
  assert.equal(f.state.window.openedAt, openedAt);
  assert.equal(f.state.audits.length, 1);
  await f.run("CLOSE");
  await f.run("CLOSE");
  assert.equal(f.state.audits.length, 2);
  assert.equal(f.state.window.status, "CLOSED");
  await f.run("OPEN");
  assert.equal(f.state.window.closedAt, null);
  assert.equal(f.state.audits[2].action, "EXAM_ENTRY_OPENED");
});

test("tenant, period and publication guards deny unsafe opening without mutation", async () => {
  for (const options of [{ foreign: true }, { wrongPeriod: true }, { noExam: true }, { locked: true }, { auditFail: true }]) {
    const f = fixture(options);
    await assert.rejects(f.run("OPEN"));
    assert.equal(f.state.window, null);
    assert.equal(f.state.audits.length, 0);
  }
  const f = fixture();
  await assert.rejects(f.run("OPEN", { ...actor, role: "bursar" }), /admin/);
  assert.equal(f.state.transactions, 0);
});

test("stale updates and failed close audits cannot leave changed windows", async () => {
  const window = { id: 1, status: "OPEN", openedAt: date, closedAt: null, updatedAt: date };
  for (const options of [{ stale: true }, { auditFail: true }]) {
    const f = fixture({ ...options, window });
    await assert.rejects(f.run("CLOSE"));
    assert.equal(f.state.window, window);
    assert.equal(f.state.audits.length, 0);
  }
  for (const window of [null, { id: 1, status: "LOCKED", openedAt: null }, { id: 1, status: "OPEN", openedAt: null }]) await assert.rejects(fixture({ window }).run("CLOSE"), /open exam/);
});
