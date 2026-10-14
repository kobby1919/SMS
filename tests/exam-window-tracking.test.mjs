import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const loaded = { exports: {} };
const code = ts.transpileModule(readFileSync("src/lib/services/exam-window-tracking.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function("require", "module", "exports", code)((id) => { assert.equal(id, "server-only"); return {}; }, loaded, loaded.exports);
const { buildExamWindowTracking } = loaded.exports;
const evidence = { subjectId: 2, subjectName: "Mathematics", expected: 3, recorded: 1, missing: 1, invalid: 1 };
const cls = { classId: 1, className: "KG1", studentCount: 3, subjectCount: 1, windowState: "OPEN", publicationStatus: "UNPUBLISHED", evidence: [evidence] };
const run = (row = cls, weight = 70) => buildExamWindowTracking(weight, "2026/2027", "TERM_1", [row]);

test("window states never accuse teachers before opening and do not mutate source evidence", () => {
  for (const windowState of ["NOT_CONFIGURED", "NOT_OPENED", "OPEN", "CLOSED"]) {
    const before = JSON.stringify(cls);
    const result = run({ ...cls, windowState });
    assert.equal(result.classes[0].state, windowState);
    assert.equal(result.totals.unresolvedAfterClose, windowState === "CLOSED" ? 2 : 0);
    assert.equal(result.state, windowState === "NOT_CONFIGURED" ? "SETUP_REQUIRED" : "AVAILABLE");
    assert.equal(result.classes[0].ordinaryEntryWindowOpen, windowState === "OPEN");
    assert.equal(JSON.stringify(cls), before);
  }
});

test("open counts distinguish missing and invalid marks and lock after report submission", () => {
  const valid = { ...cls, evidence: [{ ...evidence, recorded: 2, invalid: 0 }] };
  assert.equal(run(valid).classes[0].ordinaryEntryWindowOpen, true);
  for (const publicationStatus of ["SUBMITTED", "PUBLISHED"]) {
    const result = run({ ...valid, publicationStatus });
    assert.equal(result.classes[0].ordinaryEntryWindowOpen, false);
    assert.equal(result.classes[0].reportLocked, true);
    assert.equal(result.totals.recorded, 2);
  }
  assert.equal(run({ ...valid, windowState: "CLOSED" }).classes[0].ordinaryEntryWindowOpen, false);
});

test("exam review URL targets exact read-only admin assessment filters", () => {
  const url = new URL(run().classes[0].subjects[0].reviewUrl, "https://edujay.test");
  assert.equal(url.pathname, "/list/ca");
  assert.equal(url.searchParams.get("classId"), "1");
  assert.equal(url.searchParams.get("subjectId"), "2");
  assert.equal(url.searchParams.get("year"), "2026/2027");
  assert.equal(url.searchParams.get("term"), "TERM_1");
});

test("zero exam weight overrides missing windows with no required entry counts", () => {
  const result = run({ ...cls, windowState: "NOT_CONFIGURED", evidence: [{ ...evidence, expected: 0, recorded: 0, missing: 0, invalid: 0 }] }, 0);
  assert.equal(result.state, "AVAILABLE");
  assert.equal(result.classes[0].state, "NOT_REQUIRED");
  assert.equal(result.classes[0].ordinaryEntryWindowOpen, false);
  assert.equal(result.totals.expected, 0);
});

test("malformed counts, duplicate scope and unknown window states fail closed", () => {
  for (const row of [{ ...cls, windowState: "BAD" }, { ...cls, subjectCount: 2 },
    { ...cls, evidence: [{ ...evidence, recorded: 99 }] }, { ...cls, evidence: [{ ...evidence, missing: -1 }] },
    { ...cls, evidence: [{ ...evidence, expected: 4, missing: 2 }] }]) {
    assert.equal(run(row).state, "UNAVAILABLE");
    assert.equal(run(row).totals, null);
  }
  assert.equal(buildExamWindowTracking(70, "2026/2027", "TERM_1", [cls, cls]).state, "UNAVAILABLE");
});

test("full-school totals precede bounded class and subject lists", () => {
  const classes = Array.from({ length: 8 }, (_, index) => ({ ...cls, classId: index + 1, windowState: "CLOSED" }));
  const result = buildExamWindowTracking(70, "2026/2027", "TERM_1", classes);
  assert.equal(result.classes.length, 5);
  assert.equal(result.totals.expected, 24);
  assert.equal(result.totals.unresolvedAfterClose, 16);
});

test("open missing and invalid counts are separate and corrupt unopened marks stay reviewable", () => {
  const open = run();
  assert.equal(open.totals.openMissingEntries, 1);
  assert.equal(open.totals.openInvalidEntries, 1);
  assert.equal(open.totals.openRemainingEntries, 2);
  const unopened = run({ ...cls, windowState: "NOT_OPENED" });
  assert.equal(unopened.totals.openMissingEntries, 0);
  assert.equal(unopened.totals.openInvalidEntries, 0);
  assert.equal(unopened.attentionClasses.length, 1);
  assert.equal(unopened.totals.unresolvedAfterClose, 0);
});

test("invalid exam evidence is not hidden behind another subject's missing marks", () => {
  const result = run({ ...cls, studentCount: 30, subjectCount: 2, windowState: "NOT_OPENED", evidence: [
    { subjectId: 2, subjectName: "English", expected: 30, recorded: 0, missing: 30, invalid: 0 },
    { subjectId: 3, subjectName: "Mathematics", expected: 30, recorded: 27, missing: 0, invalid: 3 },
  ] });
  assert.equal(result.attentionClasses[0].subjects[0].subjectId, 3);
  assert.equal(result.attentionClasses[0].subjects[0].invalid, 3);
  assert.equal(result.totals.unresolvedAfterClose, 0);
});

test("nonzero exams cannot accept a not-required window and empty scope is not healthy", () => {
  assert.equal(run({ ...cls, windowState: "NOT_REQUIRED" }).state, "UNAVAILABLE");
  assert.equal(buildExamWindowTracking(70, "2026/2027", "TERM_1", []).state, "SETUP_REQUIRED");
  assert.equal(buildExamWindowTracking(70, "2026/2027", "TERM_1", []).totals, null);
});

test("window setup and review are prioritized before truncation", () => {
  const classes = Array.from({ length: 8 }, (_, index) => ({ ...cls, classId: index + 1, windowState: index === 7 ? "NEEDS_REVIEW" : index === 6 ? "NOT_CONFIGURED" : "OPEN" }));
  const result = buildExamWindowTracking(70, "2026/2027", "TERM_1", classes);
  assert.equal(result.state, "SETUP_REQUIRED");
  assert.equal(result.classes[0].classId, 8);
  assert.equal(result.classes[0].ordinaryEntryWindowOpen, false);
  assert.equal(result.classes[1].classId, 7);
});
