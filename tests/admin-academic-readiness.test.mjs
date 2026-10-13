import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const nodeRequire = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const loadedModule = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", "console", code)((id) => Object.hasOwn(mocks, id) ? mocks[id] : id === "server-only" ? {} : id.startsWith("@/") ? load(`${id.slice(2)}.ts`, mocks) : nodeRequire(id), loadedModule, loadedModule.exports, mocks.console ?? console);
  return loadedModule.exports;
}
function fixture(options = {}) {
  const calls = { auth: 0, transactions: 0, rules: 0, reports: 0, accountability: 0, queries: [], logs: [] };
  const classes = options.classes ?? Array.from({ length: 8 }, (_, i) => ({ id: i + 1, name: `Class ${i + 1}`, _count: { students: options.students ?? 2 } }));
  const period = { academicYear: "2026/2027", term: "TERM_1", classworkWeight: 30, examWeight: 70 };
  const rules = { invalidAssignmentCount: 0, period, publicationId: "published", caPolicy: { caScorePublishWindowSchoolDays: 3, teacherCloseoutTime: "16:00" }, operating: null, issues: [], scope: classes.map((cls) => ({ classId: cls.id, subjectId: 1, teacherId: "teacher-a" })), examWindows: classes.map((cls) => ({ classId: cls.id, state: "OPEN" })), ...options.rules };
  const guard = (query) => { assert.equal(query.where.schoolId, "school-a"); calls.queries.push(query); };
  const tx = {};
  for (const model of ["class", "student", "teacher", "subject", "publishedTimetableLesson", "cABucket", "cAActivity", "cAActivityScore", "continuousAssessment", "teacherObligation", "teacherEscalation", "teacherCorrectionRequest"]) {
    tx[model] = { count: async (query) => { guard(query); return options.counts?.[model] ?? (model === "class" ? classes.length : model === "student" ? classes.reduce((sum, cls) => sum + cls._count.students, 0) : 0); } };
  }
  tx.class.findMany = async (query) => { guard(query); return classes; };
  tx.cAActivity.groupBy = async (query) => { guard(query); return options.activityCounts ?? []; };
  tx.cABucket.groupBy = async (query) => { guard(query); return []; };
  tx.reportCardPublication = { findMany: async (query) => { guard(query); return options.publications ?? [{ classId: 1, status: "SUBMITTED" }]; } };
  const mocks = {
    "@/src/lib/services/ca-recording-tracking": { getCARecordingTracking: async (input) => { assert.equal(input.schoolId, "school-a"); assert.equal(input.db, tx); assert.equal(input.rules, rules); assert.ok(input.now instanceof Date); return { state: "AVAILABLE", totals: { activities: 0 }, activities: [], subjects: [], issues: [] }; } },
    console: { error: (...args) => { calls.logs.push(args); } },
    "@/src/lib/authz": { requireRole: async (roles) => { calls.auth++; assert.deepEqual(roles, ["admin"]); if (options.denied) throw new Error("Forbidden"); return { schoolId: "school-a", role: "admin", userId: "admin-a" }; } },
    "@/src/lib/prisma": { $transaction: async (work, config) => { calls.transactions++; assert.equal(calls.auth, 1); assert.equal(config.isolationLevel, "RepeatableRead"); if (options.databaseError) throw options.databaseError instanceof Error ? options.databaseError : new Error("Database unavailable"); return work(tx); } },
    "@/src/lib/services/academic-readiness-rules": { getAcademicReadinessRules: async (school, db) => { calls.rules++; assert.equal(school, "school-a"); assert.equal(db, tx); return rules; } },
    "@/src/lib/services/report-card-readiness": { getClassReportReadiness: async (input, db, now) => {
      calls.reports++; assert.equal(db, tx); assert.equal(input.schoolId, "school-a"); assert.equal(input.academicYear, period.academicYear); assert.equal(input.term, period.term); assert.ok(now instanceof Date);
      assert.deepEqual(input.subjectIds, [...new Set(rules.scope.filter((scope) => scope.classId === input.classId).map((scope) => scope.subjectId))]);
      const cls = classes.find((row) => row.id === input.classId);
      return { currentPeriod: true, studentCount: cls._count.students, subjectCount: 1, expectedEntryCount: cls._count.students, readyEntryCount: 1, readyStudentCount: 1, caStartedEntryCount: 1, examEvidence: [{ subjectId: 1, subjectName: "English", expected: cls._count.students, recorded: 1, missing: cls._count.students - 1, invalid: 0 }], isReady: false, issues: [], blockers: [{ studentId: "private-student", studentName: "Private Name", subjectId: 1, subjectName: "English", reason: "PLACEMENT_REVIEW" }], ...options.readiness };
    } },
    "@/src/lib/services/admin-teacher-accountability": { getAdminTeacherAccountability: async (school, now, teacher, details, opts) => { calls.accountability++; assert.equal(school, "school-a"); assert.equal(details, false); assert.equal(opts.db, tx); assert.equal(opts.academicOnly, true); return { totals: { overdue: 3, escalations: 1, corrections: 2, teachers: 2 }, followUps: [], details: [], notes: [], evaluatedAt: now.toISOString() }; } },
  };
  return { ...load("src/lib/services/admin-academic-readiness.ts", mocks), calls, tx };
}

test("snapshot authenticates before reading; every reader shares one school and transaction", async () => {
  const f = fixture();
  const result = await f.getAdminAcademicReadinessSnapshot({ schoolId: "school-b" });
  assert.equal(f.calls.transactions, 1);
  assert.equal(result.state, "AVAILABLE");
  assert.equal(result.totals.expectedEntries, 16);
  assert.equal(result.totals.readyEntries, 8);
  assert.equal(result.accountability.totals.overdue, 3);
  assert.equal(f.calls.reports, 8);
  assert.equal(result.classes.length, 5);
  assert.equal(result.totals.awaitingApprovalClasses, 1);
  assert.equal(JSON.stringify(result).includes("Private Name"), false);
  assert.equal(JSON.stringify(result).includes("private-student"), false);
  assert.equal(result.classes[0].blockerCounts.PLACEMENT_REVIEW, 1);
  assert.equal(result.examTracking.totals.expected, 16);
  assert.equal(result.examTracking.totals.recorded, 8);
  assert.equal(result.examTracking.classes.length, 5);
});

test("exam tracking uses canonical evidence, not report blocker precedence", async () => {
  const f = fixture({ rules: { examWindows: [{ classId: 1, state: "CLOSED" }] },
    readiness: { examEvidence: [{ subjectId: 1, subjectName: "English", expected: 2, recorded: 1, missing: 1, invalid: 0 }] } });
  const result = await f.getAdminAcademicReadinessSnapshot();
  assert.equal(result.examTracking.totals.recorded, 8);
  assert.equal(result.examTracking.totals.unresolvedAfterClose, 1);
  assert.equal(result.examTracking.totals.setupRequiredClasses, 7);
  assert.equal(result.examTracking.classes[0].ordinaryEntryWindowOpen, false);
});

test("foreign exam subject evidence cannot be returned by the snapshot", async () => {
  const result = await fixture({ readiness: { examEvidence: [{ subjectId: 999, subjectName: "Foreign", expected: 2, recorded: 2, missing: 0, invalid: 0 }] } }).getAdminAcademicReadinessSnapshot();
  assert.equal(result.code, "INCONSISTENT_EXAM_SCOPE");
  assert.equal(result.totals, null);
  assert.equal(result.examTracking, null);
});

test("non-admin rejection never opens a transaction", async () => {
  const f = fixture({ denied: true });
  await assert.rejects(f.getAdminAcademicReadinessSnapshot(), /Forbidden/);
  assert.equal(f.calls.transactions, 0);
});

test("missing and ambiguous setup produces unavailable totals, not healthy zeros", async () => {
  for (const rules of [{ period: null }, { publicationId: null }, { scope: [] }, { invalidAssignmentCount: 1, issues: ["Teaching scope requires review."] }]) {
    const f = fixture({ rules });
    const result = await f.getAdminAcademicReadinessSnapshot();
    assert.notEqual(result.state, "AVAILABLE");
    assert.equal(result.totals, null);
    assert.equal(f.calls.reports, 0);
    assert.equal(f.calls.accountability, 0);
  }
});

test("budget overflow stops evidence loading and never shows partial totals", async () => {
  for (const counts of [{ cAActivityScore: 100001 }, { teacherObligation: 20001 }, { publishedTimetableLesson: 10001 }, { student: 3001 }]) {
    const f = fixture({ counts });
    const result = await f.getAdminAcademicReadinessSnapshot();
    assert.equal(result.code, "EVALUATION_LIMIT");
    assert.equal(result.totals, null);
    assert.equal(f.calls.rules, counts.student || counts.publishedTimetableLesson ? 0 : 1);
    assert.equal(f.calls.reports, 0);
  }
  const f = fixture({ students: 5000 });
  assert.equal((await f.getAdminAcademicReadinessSnapshot()).code, "EVALUATION_LIMIT");
  assert.equal(f.calls.reports, 0);
});

test("report reads scale with classes, not students", async () => {
  const f = fixture({ students: 300 });
  assert.equal((await f.getAdminAcademicReadinessSnapshot()).totals.expectedEntries, 2400);
  assert.equal(f.calls.reports, 8);
});

test("dense histories are refused before loading canonical student evidence", async () => {
  const f = fixture({ students: 300, activityCounts: [{ classId: 1, _count: { _all: 10000 } }] });
  const result = await f.getAdminAcademicReadinessSnapshot();
  assert.equal(result.code, "EVALUATION_LIMIT");
  assert.equal(result.totals, null);
  assert.equal(f.calls.reports, 0);
});

test("missing or invalid CA deadlines do not manufacture zero overdue duties", async () => {
  for (const caPolicy of [null, { caScorePublishWindowSchoolDays: -1, teacherCloseoutTime: "16:00" }, { caScorePublishWindowSchoolDays: 3, teacherCloseoutTime: "24:00" }]) {
    const f = fixture({ rules: { caPolicy } });
    const result = await f.getAdminAcademicReadinessSnapshot();
    assert.equal(result.state, "AVAILABLE");
    assert.equal(result.accountability, null);
    assert.notEqual(result.accountabilityState, "AVAILABLE");
    assert.ok(result.accountabilityIssues.length);
    assert.equal(f.calls.accountability, 0);
  }
});

test("classes without published subjects cannot disappear into a school-ready result", async () => {
  const f = fixture({ rules: { scope: [{ classId: 1, subjectId: 1, teacherId: "teacher-a" }] } });
  const result = await f.getAdminAcademicReadinessSnapshot();
  assert.equal(result.state, "SETUP_REQUIRED");
  assert.equal(result.totals.classesWithoutTeachingScope, 7);
  assert.equal(result.totals.trackedClasses, 1);
  assert.equal(f.calls.reports, 1);
});

test("empty roster is setup-required, and database failure is never a successful empty result", async () => {
  const f = fixture({ students: 0 });
  const result = await f.getAdminAcademicReadinessSnapshot();
  assert.equal(result.code, "NO_ELIGIBLE_STUDENTS");
  assert.equal(result.totals, null);
  await assert.rejects(fixture({ databaseError: true }).getAdminAcademicReadinessSnapshot(), /Database unavailable/);
});

test("rules reader accepts the caller's transaction without opening another snapshot", async () => {
  const query = (value) => async (input) => { assert.equal(input.where.schoolId, "school-a"); return value; };
  const tx = {
    cAConfig: { findMany: query([]) }, timetablePublication: { findMany: query([]) },
    teacherAccountabilitySetting: { findUnique: query(null) }, schoolNotificationSetting: { findUnique: query(null) },
    teacher: { findMany: query([]) }, class: { findMany: query([]) }, subject: { findMany: query([]) },
  };
  const service = load("src/lib/services/academic-readiness-rules.ts", { "@/src/lib/prisma": { $transaction: () => { throw new Error("Nested transaction"); } } });
  const result = await service.getAcademicReadinessRules("school-a", tx);
  assert.equal(result.period, null);
  assert.equal(result.publicationId, null);
});

test("empty classes never inflate blocked counts or displace populated classes", async () => {
  const classes = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, name: `Class ${i + 1}`, _count: { students: i === 7 ? 2 : 0 } }));
  const f = fixture({ classes });
  const result = await f.getAdminAcademicReadinessSnapshot();
  assert.equal(f.calls.reports, 1);
  assert.equal(result.classes.length, 1);
  assert.equal(result.classes[0].classId, 8);
  assert.equal(result.totals.emptyClasses, 7);
  assert.equal(result.totals.classesNeedingReview, 1);
});

test("published and submitted complete reports are not offered for another review", async () => {
  const classes = [{ id: 1, name: "KG1", _count: { students: 2 } }, { id: 2, name: "KG2", _count: { students: 2 } }];
  const f = fixture({ classes, readiness: { isReady: true, readyEntryCount: 2, readyStudentCount: 2, blockers: [] }, publications: [{ classId: 1, status: "PUBLISHED" }, { classId: 2, status: "SUBMITTED" }] });
  const result = await f.getAdminAcademicReadinessSnapshot();
  assert.equal(result.totals.readyForReviewClasses, 0);
  assert.equal(result.totals.publishedClasses, 1);
  assert.equal(result.totals.awaitingApprovalClasses, 1);
  assert.equal(result.totals.classesNeedingReview, 0);
  assert.equal(result.classes.length, 1);
  assert.equal(result.classes[0].reportState, "AWAITING_REVIEW");
  assert.equal(result.classes[0].readyForReview, false);
});

test("stale published evidence is flagged for reconciliation without rewriting publication history", async () => {
  const f = fixture({ publications: [{ classId: 1, status: "PUBLISHED" }] });
  const result = await f.getAdminAcademicReadinessSnapshot();
  const cls = result.classes.find((row) => row.classId === 1);
  assert.equal(cls.publicationStatus, "PUBLISHED");
  assert.equal(cls.reportState, "NEEDS_RECONCILIATION");
  assert.equal(cls.readyForReview, false);
  assert.equal(result.totals.needsReconciliationClasses, 1);
});

test("missing published scope contributes to the full school's incomplete count", async () => {
  const f = fixture({ rules: { scope: [{ classId: 1, subjectId: 1, teacherId: "teacher-a" }] } });
  const result = await f.getAdminAcademicReadinessSnapshot();
  assert.equal(result.totals.studentsWithoutTeachingScope, 14);
  assert.equal(result.totals.classesNeedingReview, 8);
});

test("invalid same-school student placement cannot silently disappear from totals", async () => {
  const f = fixture({ counts: { student: 17 } });
  const result = await f.getAdminAcademicReadinessSnapshot();
  assert.equal(result.code, "INVALID_STUDENT_PLACEMENT");
  assert.equal(result.totals, null);
  assert.equal(f.calls.reports, 0);
});

test("canonical current-period and roster/subject scope must agree before returning totals", async () => {
  for (const readiness of [{ currentPeriod: false }, { studentCount: 99 }, { subjectCount: 99 }]) {
    const result = await fixture({ readiness }).getAdminAcademicReadinessSnapshot();
    assert.equal(result.code, "INCONSISTENT_SOURCE_SCOPE");
    assert.equal(result.totals, null);
    assert.equal(result.classes.length, 0);
  }
});

test("evidence budgets are restricted to the active term, not unrelated score history", async () => {
  const f = fixture();
  const checks = [];
  for (const model of ["cABucket", "cAActivity", "cAActivityScore", "continuousAssessment"]) {
    f.tx[model].count = async (query) => { checks.push(query); assert.equal(query.where.schoolId, "school-a"); const context = model === "cAActivity" ? query.where.bucket : model === "cAActivityScore" ? query.where.activity.bucket : query.where; assert.equal(context.academicYear, "2026/2027"); assert.equal(context.term, "TERM_1"); assert.equal(context.schoolId, "school-a"); return 0; };
  }
  assert.equal((await f.getAdminAcademicReadinessSnapshot()).state, "AVAILABLE");
  assert.equal(checks.length, 4);
});

test("publishing only empty classes does not pretend that populated classes need more students", async () => {
  const classes = [{ id: 1, name: "Empty", _count: { students: 0 } }, { id: 2, name: "Populated", _count: { students: 2 } }];
  const f = fixture({ classes, rules: { scope: [{ classId: 1, subjectId: 1, teacherId: "teacher-a" }] } });
  const result = await f.getAdminAcademicReadinessSnapshot();
  assert.equal(result.code, "NO_ELIGIBLE_TEACHING_SCOPE");
  assert.equal(result.totals, null);
  assert.equal(f.calls.reports, 0);
});

test("known database interruptions return unavailable without leaking provider/query details", async () => {
  for (const code of ["P1001", "P1002", "P1017", "P2024", "P2028", "P2034"]) {
    const error = Object.assign(new Error("Sensitive database connection details"), { code });
    const f = fixture({ databaseError: error });
    const result = await f.getAdminAcademicReadinessSnapshot();
    assert.equal(result.code, "DATABASE_UNAVAILABLE");
    assert.equal(result.state, "UNAVAILABLE");
    assert.equal(result.totals, null);
    assert.equal(JSON.stringify(result).includes("Sensitive"), false);
    assert.equal(f.calls.logs.length, 1);
    assert.equal(JSON.stringify(f.calls.logs).includes("Sensitive"), false);
  }
});

test("authorization and unexpected coding/data errors are not masked as temporary database failures", async () => {
  const f = fixture({ denied: true });
  await assert.rejects(f.getAdminAcademicReadinessSnapshot(), /Forbidden/);
  assert.equal(f.calls.transactions, 0);
  const broken = fixture();
  broken.tx.reportCardPublication.findMany = async () => { throw new Error("Unexpected publication invariant"); };
  await assert.rejects(broken.getAdminAcademicReadinessSnapshot(), /Unexpected publication invariant/);
});

test("transaction failure after setup/roster reads never returns partial class totals", async () => {
  const f = fixture();
  f.tx.reportCardPublication.findMany = async () => { throw Object.assign(new Error("Transaction expired"), { code: "P2028" }); };
  const result = await f.getAdminAcademicReadinessSnapshot();
  assert.equal(result.code, "DATABASE_UNAVAILABLE");
  assert.equal(result.totals, null);
  assert.deepEqual(result.classes, []);
});
