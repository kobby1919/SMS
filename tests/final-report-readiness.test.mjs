import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const loaded = { exports: {} };
const code = ts.transpileModule(readFileSync("src/lib/services/final-report-readiness.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function("require", "module", "exports", code)((id) => { assert.equal(id, "server-only"); return {}; }, loaded, loaded.exports);
const { getFinalReportPosition, buildFinalReportTracking } = loaded.exports;
const evidence = { expectedEntryCount: 10, readyEntryCount: 7, studentCount: 5, subjectCount: 2, isReady: false, issues: [], examRequired: true, currentPeriod: true };
const complete = { ...evidence, readyEntryCount: 10, isReady: true };
const run = (overrides = {}) => getFinalReportPosition({ readiness: evidence, examState: "OPEN", publicationStatus: "UNPUBLISHED", ...overrides });

test("early exam preparation never shows a term-long report completion warning", () => {
  for (const examState of ["NOT_CONFIGURED", "NOT_OPENED", "NEEDS_REVIEW"]) {
    const result = run({ examState });
    assert.equal(result.phase, "PREPARATION");
    assert.equal(result.completionPercent, null);
    assert.equal(result.releaseReady, false);
  }
  assert.equal(run().completionPercent, 70);
  assert.equal(run({ examState: "CLOSED" }).completionPercent, 70);
});

test("complete evidence never implies approval or cleared pending corrections", () => {
  assert.equal(run({ readiness: complete }).workflowState, "NOT_SUBMITTED");
  assert.equal(run({ readiness: complete }).canSubmitForReview, true);
  const pending = run({ readiness: { ...complete, isReady: false, issues: ["A score correction awaits review."] } });
  assert.equal(pending.completionPercent, 100);
  assert.equal(pending.evidenceComplete, true);
  assert.equal(pending.releaseReady, false);
  assert.equal(pending.canSubmitForReview, false);
});

test("persisted workflow survives incomplete current evidence without granting release", () => {
  for (const [publicationStatus, workflowState, unpublishedAt] of [["UNPUBLISHED", "NOT_SUBMITTED", null], ["SUBMITTED", "AWAITING_ADMIN_REVIEW", null], ["PUBLISHED", "PUBLISHED", null], ["REJECTED", "RETURNED", null], ["UNPUBLISHED", "WITHDRAWN", new Date("2026-10-13")]]) {
    const result = run({ publicationStatus, unpublishedAt, examState: "NOT_OPENED" });
    assert.equal(result.workflowState, workflowState);
    assert.equal(result.needsReconciliation, ["SUBMITTED", "PUBLISHED"].includes(publicationStatus));
    assert.equal(result.canSubmitForReview, false);
    assert.equal(result.completionPercent, workflowState === "NOT_SUBMITTED" ? null : 70);
  }
  for (const publicationStatus of ["SUBMITTED", "PUBLISHED"]) assert.equal(run({ publicationStatus, readiness: complete }).canSubmitForReview, false);
});

test("CA-only review waits for complete evidence or actual workflow", () => {
  assert.equal(run({ readiness: { ...evidence, examRequired: false }, examState: "NOT_REQUIRED" }).completionPercent, null);
  assert.equal(run({ readiness: { ...complete, examRequired: false }, examState: "NOT_REQUIRED" }).canSubmitForReview, true);
  const result = run({ readiness: complete, examState: "NOT_CONFIGURED" });
  assert.equal(result.evidenceComplete, true);
  assert.equal(result.releaseReady, false);
  assert.equal(result.completionPercent, null);
});

test("count inconsistencies fail closed and incomplete evidence never rounds to 100%", () => {
  for (const overrides of [{ publicationStatus: "BAD" }, { unpublishedAt: new Date("invalid") }, { readiness: { ...evidence, readyEntryCount: 11 } }, { readiness: { ...evidence, expectedEntryCount: 9 } }, { readiness: { ...evidence, isReady: true } }, { readiness: { ...complete, issues: ["Blocked"] } }]) assert.throws(() => run(overrides), /inconsistent/);
  assert.equal(run({ readiness: { ...evidence, studentCount: 100, subjectCount: 100, expectedEntryCount: 10000, readyEntryCount: 9999 } }).completionPercent, 99.9);
});

test("school percentages exclude preparation classes and retain exact bounded review links", () => {
  const classes = Array.from({ length: 8 }, (_, index) => ({ classId: index + 1, className: `Class ${index + 1}`, blockingSubjects: [{ subjectId: 2, subjectName: "Mathematics", affectedEntries: 3, reasons: ["MISSING_CA"] }], position: run({ examState: index < 2 ? "OPEN" : "NOT_OPENED" }) }));
  const result = buildFinalReportTracking(classes, "2026/2027", "TERM_1");
  assert.equal(result.classes.length, 5);
  assert.equal(result.totals.preparingClasses, 6);
  assert.equal(result.totals.reviewExpectedEntries, 20);
  assert.equal(result.totals.reviewCompleteEntries, 14);
  assert.equal(result.totals.completionPercent, 70);
  assert.equal(result.totals.blockedReviewClasses, 2);
  const url = new URL(result.classes[0].blockingSubjects[0].assessmentUrl, "https://edujay.test");
  assert.equal(url.pathname, "/list/ca");
  assert.equal(url.searchParams.get("subjectId"), "2");
  assert.equal(url.searchParams.get("classId"), "1");
  assert.equal(url.searchParams.get("year"), "2026/2027");
});

test("historical complete publication is not a new release or an automatic reconciliation failure", () => {
  const result = run({ readiness: { ...complete, currentPeriod: false }, publicationStatus: "PUBLISHED" });
  assert.equal(result.workflowState, "PUBLISHED");
  assert.equal(result.evidenceComplete, true);
  assert.equal(result.releaseReady, false);
  assert.equal(result.canSubmitForReview, false);
  assert.equal(result.needsReconciliation, false);
});

test("malformed exam states, contradictory readiness and duplicate classes cannot certify results", () => {
  for (const overrides of [{ examState: "UNKNOWN" }, { examState: "NOT_REQUIRED" }, { readiness: { ...complete, isReady: false } }]) assert.throws(() => run(overrides), /inconsistent/);
  const cls = { classId: 1, className: "KG1", position: run(), blockingSubjects: [] };
  assert.throws(() => buildFinalReportTracking([cls, cls], "2026/2027", "TERM_1"), /scope is inconsistent/);
});

test("healthy published classes cannot crowd out admin-review and resubmission work", () => {
  const classes = Array.from({ length: 8 }, (_, index) => ({ classId: index + 1, className: `Class ${index + 1}`, blockingSubjects: [], position: run({ readiness: complete, publicationStatus: index === 7 ? "SUBMITTED" : "PUBLISHED" }) }));
  const result = buildFinalReportTracking(classes, "2026/2027", "TERM_1");
  assert.equal(result.totals.publishedClasses, 7);
  assert.equal(result.totals.awaitingReviewClasses, 1);
  assert.equal(result.classes.length, 1);
  assert.equal(result.classes[0].classId, 8);
  assert.equal(result.classListTotal, 1);
});
