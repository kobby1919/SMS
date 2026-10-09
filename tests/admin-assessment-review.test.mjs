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
function fixture(options = {}) {
  const queries = [];
  const progress = { classworkWeight: 30, earnedMarks: 0, totalAllocatedMarks: 30, buckets: [{ allocationMarks: 30, aggregationMode: "AVERAGE_TO_BUCKET", activityCount: 1, activities: [{ rawScore: 0, rawMaxScore: 10 }] }] };
  const prisma = {
    class: { findMany: async (q) => { queries.push(q); return [{ id: 1, name: "Class 1" }]; } },
    cAConfig: { findMany: async (q) => { queries.push(q); return [{ academicYear: "2026/27", classworkWeight: 30, examWeight: 70 }]; }, findUnique: async () => ({ academicYear: "2026/27", classworkWeight: 30, examWeight: 70 }) },
    subject: { findMany: async (q) => { queries.push(q); return [{ id: 2, name: "Math" }]; } },
    student: { count: async (q) => { queries.push(q); return 1; }, findMany: async (q) => { queries.push(q); return [{ id: "s1", name: "Student", surname: "One", admissionNumber: "EDJ-001" }]; } },
    continuousAssessment: { findMany: async (q) => { queries.push(q); return [{ studentId: "s1", examScore: 50, updatedAt: now }]; } },
    cAActivityScore: { findMany: async (q) => { queries.push(q); return []; } },
    cAActivity: { count: async (q) => { queries.push(q); return 0; } },
  };
  prisma.$transaction = async (work, options) => { assert.equal(options.isolationLevel, "RepeatableRead"); return work(prisma); };
  const calls = [];
  const service = load("src/lib/queries/admin-assessment-review.ts", {
    "@/src/lib/prisma": prisma,
    "@/src/lib/authz": { requireRole: async (roles) => { assert.deepEqual(roles, ["admin"]); return { schoolId: "school-a" }; } },
    "@/src/lib/services/academic-period": { getActiveAcademicPeriod: async () => ({ academicYear: "2026/27", currentTerm: "TERM_1" }) },
    "@/src/lib/services/timetable": { listLiveTimetableLessons: async (schoolId) => { assert.equal(schoolId, "school-a"); return [{ subjectId: 2, subject: { id: 2, name: "Math" }, teacher: { name: "Teacher", surname: "One" } }]; } },
    "@/src/lib/services/ca-activity": { getSubjectCAProgress: async (input) => { calls.push(input); if (options.progressError) throw new Error(options.progressError); return progress; } },
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
  for (const params of [{ classId: "999" }, { subjectId: "999" }, { year: "foreign-year" }, { classId: "1garbage" }, { term: "INVALID" }, { page: "-1" }, { classId: ["1"] }, { subjectId: ["2", "99"] }, { classId: "1e0" }, { page: ["1"] }]) {
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
  assert.deepEqual(query.include.activities.where, { schoolId: "a", classId: 1, subjectId: 2 });
});

test("historical review uses period evidence rather than a student's current class", async () => {
  const f = fixture();
  await f.service.getAdminAssessmentReview({ term: "TERM_2", search: "Student" }, now);
  const rosterQuery = f.queries.find((q) => q.take === 25);
  assert.equal(rosterQuery.where.classId, undefined);
  assert.equal(rosterQuery.where.status, undefined);
  assert.equal(rosterQuery.where.OR[0].continuousAssessments.some.classId, 1);
  assert.equal(rosterQuery.where.OR[0].continuousAssessments.some.term, "TERM_2");
  assert.equal(rosterQuery.where.OR[1].caActivityScores.some.schoolId, "school-a");
  assert.ok(rosterQuery.where.AND[0].OR.length > 0);
});

test("invalid raw scores and impossible totals cannot masquerade as complete results", () => {
  for (const change of [
    (progress) => { progress.earnedMarks = NaN; },
    (progress) => { progress.earnedMarks = 31; },
    (progress) => { progress.buckets[0].activities[0].rawScore = 90; },
    (progress) => { progress.buckets[0].activities[0].rawMaxScore = 0; },
  ]) {
    const { service, progress } = fixture();
    change(progress);
    const result = service.assessmentPosition(progress, 50, 70);
    assert.equal(result.status, "Needs review");
    assert.equal(result.ca, null);
    assert.equal(result.total, null);
  }
});

test("canonical progress uses the supplied transaction reader, never the global client", async () => {
  let query;
  const service = load("src/lib/services/ca-activity.ts", {
    "@/src/lib/prisma": {}, "@/src/lib/services/timetable": {}, "@/src/lib/caGrades": {},
  });
  const db = { cAConfig: { findUnique: async () => ({ classworkWeight: 30 }) }, cABucket: { findMany: async (q) => { query = q; return []; } } };
  await service.getSubjectCAProgress({ schoolId: "a", classId: 1, subjectId: 2, studentId: "s1", academicYear: "2026/27", term: "TERM_1", asOf: now }, db);
  assert.equal(query.where.schoolId, "a");
  assert.equal(query.include.activities.where.schoolId, "a");
});

test("known invalid score data is flagged without disguising infrastructure failures", async () => {
  const f = fixture({ progressError: "Raw score cannot exceed the activity maximum score." });
  const result = await f.service.getAdminAssessmentReview({}, now);
  assert.equal(result.rows[0].position.status, "Needs review");
  assert.equal(result.rows[0].position.total, null);
  const broken = fixture({ progressError: "Database unavailable" });
  await assert.rejects(() => broken.service.getAdminAssessmentReview({}, now), /Database unavailable/);
});
