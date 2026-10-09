import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)((id) => Object.hasOwn(mocks, id) ? mocks[id] : id === "server-only" ? {} : nodeRequire(id), module, module.exports);
  return module.exports;
}
const now = new Date("2026-10-09T12:00:00Z");
function fixture() {
  const queries = [];
  const progress = { classworkWeight: 30, earnedMarks: 0, totalAllocatedMarks: 30, buckets: [{ allocationMarks: 30, aggregationMode: "AVERAGE_TO_BUCKET", activityCount: 1, activities: [{ rawScore: 0 }] }] };
  const prisma = {
    class: { findMany: async (q) => { queries.push(q); return [{ id: 1, name: "Class 1" }]; } },
    cAConfig: { findMany: async (q) => { queries.push(q); return [{ academicYear: "2026/27", classworkWeight: 30, examWeight: 70 }]; } },
    student: { count: async (q) => { queries.push(q); return 1; }, findMany: async (q) => { queries.push(q); return [{ id: "s1", name: "Student", surname: "One", admissionNumber: "EDJ-001" }]; } },
    continuousAssessment: { findMany: async (q) => { queries.push(q); return [{ studentId: "s1", examScore: 50, updatedAt: now }]; } },
    cAActivityScore: { findMany: async (q) => { queries.push(q); return []; } },
    cAActivity: { count: async (q) => { queries.push(q); return 0; } },
  };
  const calls = [];
  const service = load("src/lib/queries/admin-assessment-review.ts", {
    "@/src/lib/prisma": prisma,
    "@/src/lib/authz": { requireRole: async (roles) => { assert.deepEqual(roles, ["admin"]); return { schoolId: "school-a" }; } },
    "@/src/lib/services/academic-period": { getActiveAcademicPeriod: async () => ({ academicYear: "2026/27", currentTerm: "TERM_1" }) },
    "@/src/lib/services/timetable": { listLiveTimetableLessons: async (schoolId) => { assert.equal(schoolId, "school-a"); return [{ subjectId: 2, subject: { id: 2, name: "Math" }, teacher: { name: "Teacher", surname: "One" } }]; } },
    "@/src/lib/services/ca-activity": { getSubjectCAProgress: async (input) => { calls.push(input); return progress; } },
  });
  return { service, queries, calls, progress };
}
test("admin assessment totals preserve recorded zero and withhold incomplete or future results", () => {
  const { service, progress } = fixture();
  assert.equal(service.assessmentPosition(progress, 50, 70).ca, 0);
  assert.equal(service.assessmentPosition(progress, 50, 70).total, 50);
  assert.equal(service.assessmentPosition(progress, 0, 70).total, null);
  assert.equal(service.assessmentPosition(progress, 50, 70, 1).total, null);
  assert.equal(service.assessmentPosition(progress, 50, 0).total, 0);
  progress.buckets[0].activities[0].rawScore = null;
  assert.equal(service.assessmentPosition(progress, 50, 70).ca, null);
  assert.equal(service.assessmentPosition(progress, 50, 70).status, "Incomplete");
});
test("all review queries use the authorized school and canonical progress with an as-of cutoff", async () => {
  const f = fixture();
  const result = await f.service.getAdminAssessmentReview({ classId: "1", subjectId: "2", search: "Student" }, now);
  assert.equal(result.rows.length, 1);
  assert.ok(f.queries.every((q) => q.where.schoolId === "school-a"));
  assert.equal(f.calls[0].asOf, now);
  assert.equal(f.calls[0].term, "TERM_1");
  assert.equal(f.calls[0].academicYear, "2026/27");
  assert.ok(f.queries.some((q) => q.take === 25));
});
test("foreign class, unpublished subject, unknown year and malformed filters never load student scores", async () => {
  for (const params of [{ classId: "999" }, { subjectId: "999" }, { year: "foreign-year" }, { classId: "1garbage" }, { term: "INVALID" }, { page: "-1" }]) {
    const f = fixture();
    const result = await f.service.getAdminAssessmentReview(params, now);
    assert.ok(result.error);
    assert.equal(f.calls.length, 0);
    assert.equal(result.rows.length, 0);
  }
});
test("partial allocation and incomplete sum buckets cannot become final results", () => {
  const { service, progress } = fixture();
  progress.totalAllocatedMarks = 20;
  assert.equal(service.assessmentPosition(progress, 50, 70).total, null);
  progress.totalAllocatedMarks = 30;
  progress.buckets[0].aggregationMode = "SUM_ACTIVITIES";
  progress.buckets[0].activities[0].allocationMarks = 10;
  assert.equal(service.assessmentPosition(progress, 50, 70).total, null);
});
test("canonical progress excludes future activities only when an as-of date is requested", async () => {
  let query;
  const service = load("src/lib/services/ca-activity.ts", {
    "@/src/lib/prisma": { cAConfig: { findUnique: async () => ({ classworkWeight: 30 }) }, cABucket: { findMany: async (q) => { query = q; return []; } } },
    "@/src/lib/services/timetable": {}, "@/src/lib/caGrades": {},
  });
  const context = { schoolId: "a", classId: 1, subjectId: 2, studentId: "s1", academicYear: "2026/27", term: "TERM_1" };
  await service.getSubjectCAProgress({ ...context, asOf: now });
  assert.equal(query.include.activities.where.activityDate.lte, now);
  assert.deepEqual(query.include.activities.include.scores.where, { studentId: "s1", schoolId: "a" });
  await service.getSubjectCAProgress(context);
  assert.equal(query.include.activities.where, undefined);
});
