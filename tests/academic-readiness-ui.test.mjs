import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { academicReadinessFixture } from "./academic-readiness-fixture.mjs";
const nodeRequire = createRequire(import.meta.url);
function load(path) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)((id) => id === "server-only" ? {} : id === "next/link" ? { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) } : nodeRequire(id), loaded, loaded.exports);
  return loaded.exports;
}
const component = load("src/components/AdminAcademicReadiness.tsx").default;
const render = (snapshot) => renderToStaticMarkup(React.createElement(component, { snapshot }));
const { buildAcademicAttention } = load("src/lib/services/academic-readiness-attention.ts");
function source() {
  const classes = Array.from({ length: 8 }, (_, index) => ({ classId: index + 1, className: `Class ${index + 1}` }));
  return { period: { academicYear: "2026/2027", term: "TERM_1" }, classes,
    scope: classes.map((cls) => ({ classId: cls.classId, subjectId: 2, subjectName: "English", teacherId: "t1", teacherName: "Ms. Ama" })),
    ca: { attentionActivities: [], attentionSubjects: [] }, exams: { attentionClasses: [] }, reports: { attentionClasses: [] } };
}

test("academic section has three distinct lanes and five one-action rows", () => {
  const html = render(academicReadinessFixture());
  for (const label of ["CA Recording", "Exam Entry", "Report Release", "2026/2027", "Term 1"]) assert.ok(html.includes(label));
  assert.equal((html.match(/<li /g) ?? []).length, 5);
  assert.equal((html.match(/<a /g) ?? []).length, 5);
  assert.ok(html.includes("scores remaining"));
  assert.ok(html.includes("required activity scores recorded"));
  assert.ok(html.includes("5 of 7 classes"));
  assert.ok(html.includes("font-nunito"));
});

test("unavailable and setup states never render invented numeric readiness", () => {
  for (const state of ["UNAVAILABLE", "SETUP_REQUIRED"]) {
    const html = render(academicReadinessFixture(state));
    assert.ok(html.includes("tracking unavailable"));
    assert.equal(html.includes("0 scores remaining"), false);
    assert.equal(html.includes("configured."), false);
    assert.equal(html.includes("Review setup"), state === "SETUP_REQUIRED");
  }
  const html = render(academicReadinessFixture("CA_ONLY"));
  assert.ok(html.includes("Exam entry not required"));
  assert.equal(html.includes("70%"), false);
});

test("attention deduplicates classes before limiting and routes only actual overdue work to follow-up", () => {
  const data = source();
  data.ca.attentionActivities = Array.from({ length: 8 }, (_, index) => ({ classId: index + 1, subjectId: 2, title: "Spelling test", scoresRemaining: 6, invalidScores: 0, state: index === 0 ? "OVERDUE" : "REMAINING", followUpClosed: false, teacherId: "t1", teacherName: "Ms. Ama", recordingPermittedNow: true }));
  data.ca.attentionActivities.push({ ...data.ca.attentionActivities[0], title: "Another test" });
  const result = buildAcademicAttention(data);
  assert.equal(result.rows.length, 5);
  assert.equal(new Set(result.rows.map((row) => row.classId)).size, 5);
  assert.equal(result.totalClasses, 8);
  assert.equal(result.rows[0].action, "Review follow-up");
  assert.equal(result.rows.filter((row) => row.href.startsWith("/admin/accountability")).length, 1);
  data.ca.attentionActivities[0].followUpClosed = true;
  data.ca.attentionActivities.pop();
  const closed = buildAcademicAttention(data);
  assert.equal(closed.rows.some((row) => row.href.startsWith("/admin/accountability")), false);
  assert.ok(closed.rows.every((row) => row.href.startsWith("/list/ca?")));
});

test("class-only preparation does not fabricate report or overdue duties", () => {
  const data = source();
  data.reports.attentionClasses = [{ classId: 1, position: { phase: "PREPARATION" }, blockingSubjects: [] }];
  data.ca.attentionSubjects = [{ classId: 2, subjectId: 2, state: "NO_ACTIVITIES", label: "No CA activity recorded yet" }];
  const result = buildAcademicAttention(data);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].classId, 2);
  assert.equal(result.rows[0].detail, "No CA activity recorded yet");
  assert.equal(result.rows[0].action, "Review assessment");
  data.ca.attentionSubjects.push({ ...data.ca.attentionSubjects[0], classId: 999 });
  assert.equal(buildAcademicAttention(data).rows.length, 1);
});

test("exam score review and window reopening use distinct protected destinations", () => {
  const data = source();
  data.exams.attentionClasses = [{ classId: 1, state: "OPEN", subjects: [{ subjectId: 2, subjectName: "English", missing: 4, invalid: 1 }] }];
  let row = buildAcademicAttention(data).rows[0];
  assert.equal(row.action, "Review assessment");
  assert.ok(row.href.startsWith("/list/ca?"));
  assert.ok(row.detail.includes("4 exam entries remaining"));
  assert.ok(row.detail.includes("1 invalid entries"));
  data.exams.attentionClasses[0].state = "CLOSED";
  row = buildAcademicAttention(data).rows[0];
  assert.equal(row.action, "Review reports");
  assert.ok(row.href.startsWith("/list/report-cards?"));
  data.exams.attentionClasses[0].state = "NOT_OPENED";
  row = buildAcademicAttention(data).rows[0];
  assert.ok(row.detail.includes("Exam entry not started"));
  assert.equal(row.detail.includes("Closed"), false);
  assert.equal(row.href.includes("accountability"), false);
});

test("mismatched published subject or teacher evidence fails closed", () => {
  const data = source();
  const activity = { classId: 1, subjectId: 2, teacherId: "t1", title: "Test", scoresRemaining: 2, invalidScores: 0, state: "REMAINING", teacherName: "Ms. Ama", recordingPermittedNow: true };
  for (const overrides of [{ subjectId: 999 }, { teacherId: "other-school-teacher" }]) {
    data.ca.attentionActivities = [{ ...activity, ...overrides }];
    assert.throws(() => buildAcademicAttention(data), (error) => error.code === "ACADEMIC_EVIDENCE_INCONSISTENT");
  }
  data.ca.attentionActivities = [{ ...activity, state: "OVERDUE", hasTakenPlace: false }];
  assert.equal(buildAcademicAttention(data).rows.length, 0);
  data.ca.attentionActivities = [];
  data.reports.attentionClasses = [{ classId: 1, position: { phase: "REPORT_REVIEW", workflowState: "PUBLISHED", needsReconciliation: false }, blockingSubjects: [] }];
  assert.equal(buildAcademicAttention(data).rows.length, 0);
});

test("dashboard distinguishes invalid exams, missing marks and student-setup actions", () => {
  const data = academicReadinessFixture();
  data.examTracking.totals.openMissingEntries = 2;
  data.examTracking.totals.openInvalidEntries = 3;
  const html = render(data);
  assert.ok(html.includes("Open-window entries still to record: 2"));
  assert.ok(html.includes("Open-window invalid entries requiring review: 3"));
  const setup = academicReadinessFixture("SETUP_REQUIRED");
  setup.code = "NO_ELIGIBLE_STUDENTS";
  assert.ok(render(setup).includes('href="/list/students"'));
});
