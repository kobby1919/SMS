import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const nodeRequire = createRequire(import.meta.url);
const loadedModule = { exports: {} };
const source = readFileSync("src/lib/services/academic-readiness-attention.ts", "utf8");
new Function("require", "module", "exports", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(() => ({}), loadedModule, loadedModule.exports);
const { buildAcademicAttention } = loadedModule.exports;
function fixture() {
  return { period: { academicYear: "2026/2027", term: "TERM_2" }, classes: [{ classId: 8, className: "KG1" }],
    scope: [{ classId: 8, subjectId: 4, teacherId: "teacher&1", teacherName: "Ms. Ama", subjectName: "English" }],
    ca: { attentionActivities: [], attentionSubjects: [] }, exams: { attentionClasses: [] }, reports: { attentionClasses: [] } };
}
function action(data) {
  const row = buildAcademicAttention(data).rows[0];
  const url = new URL(row.href, "http://localhost");
  assert.ok(existsSync(`src/app/(dashboard)${url.pathname}/page.tsx`), `Missing route: ${url.pathname}`);
  return url;
}
test("CA action targets the exact activity and genuine overdue action targets only its duty", () => {
  const data = fixture();
  data.ca.attentionActivities = [{ classId: 8, subjectId: 4, activityId: 17, teacherId: "teacher&1", title: "Spelling", state: "REMAINING", scoresRemaining: 3, recordingPermittedNow: true }];
  let url = action(data);
  assert.equal(url.pathname, "/list/ca");
  assert.deepEqual(Object.fromEntries(url.searchParams), { classId: "8", subjectId: "4", year: "2026/2027", term: "TERM_2", activityId: "17" });
  data.ca.attentionActivities[0].state = "OVERDUE";
  url = action(data);
  assert.equal(url.pathname, "/admin/accountability/follow-up");
  assert.deepEqual(Object.fromEntries(url.searchParams), { teacherId: "teacher&1", activityId: "17" });
  data.ca.attentionActivities[0].followUpClosed = true;
  assert.equal(action(data).pathname, "/list/ca");
  data.ca.attentionActivities[0].state = "DEADLINE_UNAVAILABLE";
  assert.equal(action(data).pathname, "/admin/accountability-settings");
});
test("exam windows and report blockers preserve the exact class and period", () => {
  const data = fixture();
  for (const state of ["OPEN", "CLOSED", "NOT_CONFIGURED", "NEEDS_REVIEW"]) {
    data.exams.attentionClasses = [{ classId: 8, state, subjects: [{ subjectId: 4, subjectName: "English", missing: 3, invalid: 0 }] }];
    const url = action(data);
    assert.equal(url.pathname, state === "OPEN" ? "/list/ca" : "/list/report-cards");
    assert.equal(url.searchParams.get("classId"), "8");
    assert.equal(url.searchParams.get("year"), "2026/2027");
    assert.equal(url.searchParams.get("term"), "TERM_2");
  }
  data.exams.attentionClasses = [];
  data.reports.attentionClasses = [{ classId: 8, position: { phase: "REPORT_REVIEW", workflowState: "NOT_SUBMITTED", remainingEntries: 3 }, blockingSubjects: [{ subjectId: 4, subjectName: "English", affectedEntries: 3 }] }];
  assert.equal(action(data).pathname, "/list/report-cards");
});
test("admin assessment route cannot reach teacher grading UI and activity filters survive pagination", () => {
  const route = readFileSync("src/app/(dashboard)/list/ca/page.tsx", "utf8");
  assert.ok(route.indexOf('if (role === "admin") return <AdminAssessmentReview') < route.indexOf("<CAEntryForm"));
  const review = readFileSync("src/components/AdminAssessmentReview.tsx", "utf8");
  assert.ok(review.includes('query.set("activityId", String(data.activityId))'));
  assert.equal(/CAEntryForm|CAActivityManager|recordExamScores|saveActivityScores/.test(review), false);
  const followUp = readFileSync("src/app/(dashboard)/admin/accountability/follow-up/page.tsx", "utf8");
  assert.ok(followUp.includes('requirePageSession(["admin"])'));
  assert.ok(followUp.includes('item.kind === "CA_SCORE_PUBLISHING"'));
  assert.ok(followUp.includes('item.teacherId === teacherId'));
  assert.ok(followUp.includes('item.id === `duty:${teacherId}:ca-score-publishing:activity:${activityId}`'));
});
test("follow-up route shows only the corresponding authorized duty, and safely handles stale links", async () => {
  let authChecks = 0;
  let setupChecks = 0;
  const detail = { id: "duty:teacher&1:ca-score-publishing:activity:17", teacherId: "teacher&1", teacherName: "Ms. Ama", kind: "CA_SCORE_PUBLISHING", title: "Selected spelling duty", detail: "3 scores remaining", at: "2026-10-14T10:00:00Z", reviewId: null };
  const details = [detail, { ...detail, id: "duty:teacher&1:ca-score-publishing:activity:18", title: "Unrelated activity" }, { ...detail, teacherId: "foreign", title: "Foreign teacher" }];
  const loaded = { exports: {} };
  const mocks = {
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
    "@/src/lib/authz": { requirePageSession: async (roles) => { assert.deepEqual(roles, ["admin"]); authChecks++; return { schoolId: "school-a" }; }, requireCompletedAdminSchoolSetup: async () => { setupChecks++; } },
    "@/src/lib/services/admin-teacher-accountability": { getAdminTeacherAccountability: async (schoolId, now, teacherId, full) => { assert.equal(schoolId, "school-a"); assert.equal(teacherId, "teacher&1"); assert.equal(full, true); return { details, notes: [] }; } },
  };
  const code = ts.transpileModule(readFileSync("src/app/(dashboard)/admin/accountability/follow-up/page.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)((id) => mocks[id] ?? nodeRequire(id), loaded, loaded.exports);
  const render = async (params) => renderToStaticMarkup(await loaded.exports.default({ searchParams: Promise.resolve(params) }));
  const html = await render({ teacherId: "teacher&1", activityId: "17" });
  assert.ok(html.includes("Selected spelling duty"));
  assert.equal(html.includes("Unrelated activity"), false);
  assert.equal(html.includes("Foreign teacher"), false);
  assert.ok((await render({ teacherId: "teacher&1", activityId: "99" })).includes("No follow-ups"));
  for (const params of [{ activityId: "17" }, { teacherId: "teacher&1", activityId: "17x" }, { teacherId: ["teacher&1"], activityId: "17" }]) assert.ok((await render(params)).includes("selection is invalid"));
  assert.equal(authChecks, 5);
  assert.equal(setupChecks, 5);
});
