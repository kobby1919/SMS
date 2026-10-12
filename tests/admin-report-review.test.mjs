import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const nodeRequire = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)((id) => Object.hasOwn(mocks, id) ? mocks[id] : id === "server-only" ? {} : id.startsWith("@/") ? load(`${id.slice(2)}.ts`, mocks) : nodeRequire(id), loaded, loaded.exports);
  return loaded.exports;
}
const now = new Date("2026-10-12T12:00:00Z");
const context = { schoolId: "school-a", classId: 1, term: "TERM_1", academicYear: "2026/27" };
function evidence(options = {}) {
  const queries = [];
  const config = { academicYear: "2026/27", currentTerm: "TERM_1", isActive: true, classworkWeight: 30, examWeight: 70, ...options.config };
  const students = [{ id: "s1", name: "Ama", surname: "Mensah", admissionNumber: "EDJ-2026-0001", status: "ACTIVE" }, { id: "old", name: "Kojo", surname: "A", admissionNumber: null, status: "WITHDRAWN" }];
  const record = { studentId: "s1", subjectId: 2, classworkScore: 0, examScore: 60, totalScore: 60, ...options.record };
  const activity = { id: 1, subjectId: options.wrongSubject ? 3 : 2, title: "Reading", rawMaxScore: 10, allocationMarks: 30, activityDate: new Date("2026-10-10"), teacher: { name: "Victoria", surname: "Mensah" }, scores: options.noScores ? [] : [{ studentId: "s1", rawScore: options.rawScore ?? 0, normalizedContribution: options.contribution ?? 0 }] };
  const bucket = { id: 1, subjectId: 2, name: "Classwork", type: "CLASSWORK", aggregationMode: options.sum ? "SUM_ACTIVITIES" : "AVERAGE_TO_BUCKET", allocationMarks: 30, activities: [activity, ...(options.future ? [{ ...activity, id: 2, activityDate: new Date("2026-10-13") }] : [])] };
  const track = (value) => async (q) => { queries.push(q); assert.equal(q.where.schoolId ?? q.where.schoolId_academicYear?.schoolId, "school-a"); return typeof value === "function" ? value(q) : value; };
  const db = { class: { findFirst: track(options.foreign ? null : { id: 1 }) }, cAConfig: { findUnique: track(options.noConfig ? null : config), findFirst: track(options.historical ? { ...config, academicYear: "2027/28" } : config) }, publishedTimetableLesson: { findMany: track(options.noSubjects ? [] : [{ subjectId: 2, subjectName: "Reading" }, { subjectId: 2, subjectName: "Reading" }]) }, subject: { findMany: track([{ id: 2, name: "Reading" }]) }, student: { findMany: track((q) => q.where.status ? students.filter((s) => s.status === q.where.status) : students) }, continuousAssessment: { findMany: track(options.noRecord ? [] : [record]) }, cABucket: { findMany: track([bucket]) } };
  const prisma = { ...db, $transaction: async (fn, opts) => { assert.equal(opts.isolationLevel, "RepeatableRead"); return fn(db); } };
  return { service: load("src/lib/services/report-card-readiness.ts", { "@/src/lib/prisma": prisma, "@/src/lib/services/timetable": {}, "@/src/lib/caGrades": {} }), db, queries };
}
test("report readiness respects recorded zero CA, deduplicates published subjects and excludes inactive pupils", async () => {
  const f = evidence();
  const r = await f.service.getClassReportReadiness(context);
  assert.equal(r.isReady, true);
  assert.equal(r.readyEntryCount, 1);
  assert.equal(r.expectedEntryCount, 1);
  assert.equal(r.readyStudentCount, 1);
  assert.equal(r.studentCount, 1);
  assert.equal(r.caStartedEntryCount, 1);
});
test("positive exam alone cannot hide incomplete CA, future work, invalid raw marks or stale totals", async () => {
  for (const [options, reason] of [[{ noScores: true }, "MISSING_CA"], [{ future: true }, "FUTURE_ACTIVITY"], [{ rawScore: 90 }, "INVALID_SCORE"], [{ record: { totalScore: 99 } }, "STALE_TOTAL"], [{ record: { classworkScore: 30, totalScore: 90 } }, "STALE_TOTAL"], [{ record: { examScore: 0, totalScore: 0 } }, "MISSING_EXAM"], [{ record: { examScore: 90, totalScore: 90 } }, "INVALID_SCORE"]]) {
    const r = await evidence(options).service.getClassReportReadiness(context);
    assert.equal(r.isReady, false);
    assert.equal(r.blockers[0].reason, reason);
    assert.equal(r.blockers[0].studentId, "s1");
    assert.equal(r.blockers[0].subjectId, 2);
  }
});
test("misfiled activity evidence blocks report readiness", async () => {
  const r = await evidence({ wrongSubject: true }).service.getClassReportReadiness(context);
  assert.equal(r.isReady, false);
  assert.equal(r.blockers[0].reason, "INVALID_SCORE");
});

test("summed activities recompute contributions from raw evidence rather than trusting a corrupt cached contribution", async () => {
  const r = await evidence({ sum: true, contribution: 1000, record: { classworkScore: 30, totalScore: 90 } }).service.getClassReportReadiness(context);
  assert.equal(r.isReady, false);
  assert.equal(r.blockers[0].reason, "STALE_TOTAL");
  assert.equal((await evidence({ sum: true, contribution: 1000 }).service.getClassReportReadiness(context)).isReady, true);
});
test("missing setup and an explicitly empty subject scope are never ready", async () => {
  for (const options of [{ noSubjects: true }, { noConfig: true }, { config: { classworkWeight: 50, examWeight: 70 } }]) {
    const r = await evidence(options).service.getClassReportReadiness(context);
    assert.equal(r.isReady, false);
    assert.ok(r.issues.length);
  }
  const r = await evidence().service.getClassReportReadiness({ ...context, subjectIds: [] });
  assert.equal(r.subjectCount, 0);
  assert.equal(r.isReady, false);
  await assert.rejects(evidence({ foreign: true }).service.getClassReportReadiness(context), /school/);
});
test("historical reports use recorded period subjects and placements, not today's published timetable", async () => {
  const f = evidence({ historical: true });
  const r = await f.service.getClassReportReadiness(context, f.db, now);
  assert.equal(r.currentPeriod, false);
  assert.equal(r.studentCount, 2);
  assert.ok(f.queries.some((q) => q.where.OR?.[0]?.continuousAssessments));
  assert.ok(!f.queries.some((q) => q.where.publication));
});
function review() {
  const calls = [];
  const track = (value) => async (q) => { calls.push(q); return value; };
  const db = { class: { findMany: track([{ id: 1, name: "KG1" }]) }, cAConfig: { findMany: track([{ academicYear: "2026/27", currentTerm: "TERM_1", isActive: true }]) }, reportCardPublication: { findUnique: track({ id: 1, status: "SUBMITTED", updatedAt: now, submittedBy: "t1" }) }, examEntryWindow: { findUnique: track({ status: "OPEN" }) }, cAAuditLog: { findMany: track([]) }, teacher: { findFirst: track({ name: "Victoria", surname: "Mensah" }) } };
  const readiness = { isReady: false, currentPeriod: true, issues: [], blockers: Array.from({ length: 26 }, (_, i) => ({ studentId: `s${i}`, subjectId: 2, reason: "MISSING_CA" })) };
  const service = load("src/lib/queries/admin-report-review.ts", { "@/src/lib/authz": { requireRole: async (roles) => { assert.deepEqual(roles, ["admin"]); return { schoolId: "school-a" }; } }, "@/src/lib/prisma": { $transaction: async (fn, opts) => { assert.equal(opts.isolationLevel, "RepeatableRead"); return fn(db); } }, "@/src/lib/services/report-card-readiness": { getClassReportReadiness: async (input, reader) => { assert.equal(input.schoolId, "school-a"); assert.equal(reader, db); return readiness; } } });
  return { service, calls };
}
test("report review rejects malformed and foreign selections and paginates actual blockers", async () => {
  for (const params of [{ classId: "999" }, { classId: "1junk" }, { classId: ["1"] }, { year: "foreign" }, { term: "invalid" }, { page: "0" }]) {
    const r = await review().service.getAdminReportReview(params, now);
    assert.ok(r.error);
    assert.equal(r.rows.length, 0);
  }
  const f = review();
  const r = await f.service.getAdminReportReview({ page: "2" }, now);
  assert.equal(r.rows.length, 1);
  assert.equal(r.pageCount, 2);
  assert.equal(r.submittedByName, "Victoria Mensah");
  assert.ok(f.calls.every((q) => (q.where.schoolId ?? q.where.schoolId_classId_term_academicYear?.schoolId) === "school-a"));
});
function publication(options = {}) {
  let row = options.status === null ? null : { id: 1, status: options.status ?? "SUBMITTED", updatedAt: now, ...context };
  const audits = [];
  const db = {
    class: { findFirst: async (q) => { assert.equal(q.where.schoolId, "school-a"); return options.foreign ? null : { id: 1, name: "KG1", supervisorId: "t1" }; } },
    teacher: { findFirst: async (q) => { assert.equal(q.where.schoolId, "school-a"); return options.inactive ? null : { id: q.where.id }; } },
    reportCardPublication: { findUnique: async (q) => { assert.equal(q.where.schoolId_classId_term_academicYear.schoolId, "school-a"); return row ? structuredClone(row) : null; }, updateMany: async (q) => { assert.equal(q.where.schoolId, "school-a"); if (options.lost || row.status !== q.where.status || row.updatedAt.getTime() !== q.where.updatedAt.getTime()) return { count: 0 }; row = { ...row, ...q.data, updatedAt: new Date(now.getTime() + 1) }; return { count: 1 }; }, create: async ({ data }) => { row = { id: 1, updatedAt: now, ...data }; return row; } },
    examEntryWindow: { findUnique: async () => options.locked ? null : { status: "CLOSED" } },
    cAAuditLog: { create: async ({ data }) => { if (options.auditFailure) throw new Error("Audit unavailable"); audits.push(data); } },
  };
  const prisma = { $transaction: async (fn, opts) => { assert.equal(opts.isolationLevel, "Serializable"); const before = structuredClone(row), count = audits.length; try { return await fn(db); } catch (error) { row = before; audits.splice(count); throw error; } } };
  const service = load("src/lib/services/report-publication.ts", { "@/src/lib/prisma": prisma, "@/src/lib/services/report-card-readiness": { getClassReportReadiness: async (input, reader) => { assert.equal(input.schoolId, "school-a"); assert.equal(reader, db); return { examRequired: options.examRequired !== false, isReady: !options.incomplete, currentPeriod: !options.historical, missingCount: options.incomplete ? 1 : 0, issues: [], studentCount: 1, subjectCount: 1 }; } } });
  return { service, audits, get row() { return row; } };
}
const admin = { userId: "admin", role: "admin", schoolId: "school-a" };
const input = { classId: 1, term: "TERM_1", academicYear: "2026/27", expectedUpdatedAt: now.toISOString(), notes: "Reviewed" };
test("approval requires submitted, ready, active-period evidence and an authorized same-school admin", async () => {
  for (const options of [{ status: "UNPUBLISHED" }, { status: "PUBLISHED" }, { incomplete: true }, { historical: true }, { foreign: true }, { locked: true }]) await assert.rejects(publication(options).service.transitionClassReports("PUBLISH", input, admin, now));
  await assert.rejects(publication().service.transitionClassReports("PUBLISH", input, { ...admin, role: "bursar" }, now));
  const f = publication();
  await f.service.transitionClassReports("PUBLISH", input, admin, now);
  assert.equal(f.row.status, "PUBLISHED");
  assert.equal(f.audits.length, 1);
  assert.equal(f.audits[0].actorId, "admin");
});
test("stale, competing and repeated review decisions cannot overwrite each other or double-audit", async () => {
  await assert.rejects(publication().service.transitionClassReports("PUBLISH", { ...input, expectedUpdatedAt: undefined }, admin, now), /changed/);
  await assert.rejects(publication({ lost: true }).service.transitionClassReports("PUBLISH", input, admin, now), /reviewer/);
  const f = publication();
  await f.service.transitionClassReports("PUBLISH", input, admin, now);
  await assert.rejects(f.service.transitionClassReports("REJECT", input, admin, now), /changed/);
  assert.equal(f.row.status, "PUBLISHED");
  assert.equal(f.audits.length, 1);
});
test("audit failure rolls back release; rejection and withdrawal require reasons and valid states", async () => {
  const f = publication({ auditFailure: true });
  await assert.rejects(f.service.transitionClassReports("PUBLISH", input, admin, now), /Audit/);
  assert.equal(f.row.status, "SUBMITTED");
  for (const mode of ["REJECT", "UNPUBLISH"]) await assert.rejects(publication({ status: mode === "REJECT" ? "SUBMITTED" : "PUBLISHED" }).service.transitionClassReports(mode, { ...input, notes: "" }, admin, now), /reason/);
  await assert.rejects(publication().service.transitionClassReports("UNPUBLISH", input, admin, now));
});
test("only an active assigned class teacher can submit a complete set", async () => {
  const teacher = { ...admin, role: "teacher", userId: "t1" };
  for (const options of [{ inactive: true }, { incomplete: true }, { historical: true }]) await assert.rejects(publication({ ...options, status: null }).service.transitionClassReports("SUBMIT", input, teacher, now));
  await assert.rejects(publication({ status: null }).service.transitionClassReports("SUBMIT", input, { ...teacher, userId: "other" }, now));
  const f = publication({ status: null });
  await f.service.transitionClassReports("SUBMIT", input, teacher, now);
  assert.equal(f.row.status, "SUBMITTED");
  assert.equal(f.audits[0].actorId, "t1");
});

test("CA-only reports do not require an irrelevant exam entry window", async () => {
  const f = publication({ locked: true, examRequired: false });
  await f.service.transitionClassReports("PUBLISH", input, admin, now);
  assert.equal(f.row.status, "PUBLISHED");
});
test("academic menu has exactly five admin destinations and retains class/accountability homework evidence", () => {
  const source = readFileSync("src/components/MenuClient.tsx", "utf8");
  const academic = source.slice(source.indexOf('title: "Academic"'), source.indexOf('title: "Communication"'));
  const adminItems = [...academic.matchAll(/label: "([^"]+)"[\s\S]*?visible: \[([^\]]*)\]/g)].filter((match) => match[2].includes('"admin"')).map((match) => match[1]);
  assert.deepEqual(adminItems, ["Timetable", "Curriculum", "Attendance Review", "Assessments", "Reports & Approval"]);
  assert.match(readFileSync("src/app/(dashboard)/list/classes/[classId]/overview/page.tsx", "utf8"), /homework/i);
  assert.match(readFileSync("src/lib/services/admin-teacher-accountability.ts", "utf8"), /HOMEWORK_CHECKING/);
  assert.match(readFileSync("src/components/AdminReportReview.tsx", "utf8"), /studentId: row.studentId/);
  assert.match(readFileSync("src/lib/queries/admin-assessment-review.ts", "utf8"), /selection.studentId \? \{ id: selection.studentId \}/);
});
