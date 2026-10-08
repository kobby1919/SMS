import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const loadedModule = { exports: {} };
  const source = readFileSync(path, "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : id === "server-only" ? {} : id.startsWith("@/") ? load(`${id.slice(2)}.ts`, mocks) : nodeRequire(id);
  new Function("require", "module", "exports", code)(require, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const pure = load("src/lib/queries/admin-teacher-follow-up.ts");
const now = new Date("2026-10-08T12:00:00Z");
const teacher = { id: "teacher-1", name: "Ama", surname: "Mensah", sex: "FEMALE" };
const lesson = { sourceId: 1, teacherId: teacher.id, classId: 1, subjectId: 1, className: "KG1", subjectName: "Reading", day: "THURSDAY", startTime: new Date("2000-01-01T09:00:00Z"), endTime: new Date("2000-01-01T10:00:00Z") };
const policy = { attendanceEscalateMinutesAfterLesson: 30, caScorePublishWindowSchoolDays: 3, homeworkCheckWindowSchoolDays: 2, teacherCloseoutTime: "16:00" };
const student = { id: "student-1", classId: 1, createdAt: new Date("2026-09-01T00:00:00Z") };
const obligation = { id: "obligation-1", teacherId: teacher.id, type: "ATTENDANCE", sourceModel: "Lesson", sourceId: "1", sourceKey: "attendance:2026-10-08:lesson:1", status: "ESCALATED", completedAt: null, expectedAt: new Date("2026-10-08T10:00:00Z"), metadata: { classId: 1, subjectId: 1, date: "2026-10-08" }, escalations: [] };

async function snapshot(overrides = {}, teacherId, at = now) {
  const queries = [];
  const data = { policy, publication: { id: "publication-1", publishedAt: new Date("2026-10-01T00:00:00Z") }, config: { academicYear: "2026/2027", currentTerm: "TERM_1" }, teachers: [teacher], lessons: [lesson], students: [student], obligations: [], assignments: [], activities: [], corrections: [], attendance: [], ...overrides };
  const model = (name, method, get) => ({ [method]: async (query) => { queries.push({ name, query }); return get(query); } });
  const tx = {
    teacherAccountabilitySetting: model("policy", "findUnique", () => data.policy),
    schoolNotificationSetting: model("operating", "findUnique", () => data.operating ?? null),
    timetablePublication: model("publication", "findFirst", () => data.publication),
    cAConfig: model("config", "findFirst", () => data.config),
    teacher: model("teacher", "findMany", () => data.teachers),
    publishedTimetableLesson: model("lessons", "findMany", () => data.lessons),
    student: model("student", "findMany", () => data.students),
    teacherObligation: model("obligation", "findMany", () => data.obligations),
    teacherEscalation: model("escalation", "findMany", () => data.escalations ?? data.obligations.filter((row) => row.status !== "CANCELLED").flatMap((row) => row.escalations.filter((esc) => ["OPEN", "ACKNOWLEDGED"].includes(esc.status)).map((esc) => ({ ...esc, teacherId: row.teacherId, teacher, obligation: { title: "Attendance", teacherId: row.teacherId } })))),
    attendance: model("attendance", "findMany", (q) => q.select.studentId ? data.attendance : data.attendanceSources ?? []),
    assignment: model("assignment", "findMany", () => data.assignments),
    cAActivity: model("activity", "findMany", () => data.activities.map((row) => ({ bucket: { classId: row.classId, subjectId: row.subjectId }, ...row }))),
    teacherCorrectionRequest: model("correction", "findMany", () => data.corrections),
    homeworkSubmission: model("homeworkSource", "findMany", () => []),
    cAActivityScore: model("caSource", "findMany", () => []),
    continuousAssessment: model("examSource", "findMany", () => []),
  };
  const prisma = { $transaction: async (fn, options) => { assert.equal(options.isolationLevel, "RepeatableRead"); return fn(tx); } };
  const service = load("src/lib/services/admin-teacher-accountability.ts", { "@/src/lib/prisma": prisma, "@/src/generated/prisma": { Prisma: { TransactionIsolationLevel: { RepeatableRead: "RepeatableRead" } } } });
  return { result: await service.getAdminTeacherAccountability("school-a", at, teacherId, true), queries };
}

test("overdue excludes open windows, completed work, cancelled duties and accepted exceptions", () => {
  const base = { deadline: new Date("2026-10-08T11:59:00Z"), complete: false };
  assert.equal(pure.isOutstandingDuty(base, now), true);
  for (const change of [{ deadline: now }, { deadline: new Date("invalid") }, { complete: true }, { status: "COMPLETED" }, { status: "COMPLETED_LATE" }, { status: "CANCELLED" }, { completedAt: now }, { exception: true }]) assert.equal(pure.isOutstandingDuty({ ...base, ...change }, now), false);
});

test("totals include the entire backlog before top-five display and deduplicate issues", () => {
  const items = Array.from({ length: 8 }, (_, i) => ({ id: `issue-${i}`, teacherId: `teacher-${i}`, teacherName: "Teacher", kind: "ATTENDANCE", at: now.toISOString() }));
  const result = pure.summarizeTeacherFollowUps([...items, items[0], { ...items[0], id: "correction", kind: "CORRECTION" }]);
  assert.equal(result.totals.overdue, 8);
  assert.equal(result.totals.corrections, 1);
  assert.equal(result.totals.teachers, 8);
  assert.equal(result.followUps.length, 5);
  assert.equal(pure.teacherFollowUpName(teacher), "Ms. Ama Mensah");
});

test("attendance becomes overdue only after the final marking window", async () => {
  assert.equal((await snapshot({}, undefined, new Date("2026-10-08T10:30:00Z"))).result.totals.overdue, 0);
  assert.equal((await snapshot()).result.totals.overdue, 1);
});

test("actual completion overrides stale escalated status but preserves management review", async () => {
  const row = { ...obligation, escalations: [{ id: "escalation-1", status: "OPEN", reason: "Review delay", escalatedAt: now }] };
  const { result } = await snapshot({ obligations: [row], attendance: [{ studentId: student.id, lessonId: 1, date: now }, { studentId: student.id, lessonId: 1, date: now }] });
  assert.equal(result.totals.overdue, 0);
  assert.equal(result.totals.escalations, 1);
});

test("cancelled and dismissed duties do not reappear", async () => {
  assert.equal((await snapshot({ obligations: [{ ...obligation, status: "CANCELLED" }] })).result.totals.overdue, 0);
  assert.equal((await snapshot({ obligations: [{ ...obligation, escalations: [{ id: "closed", status: "DISMISSED", escalatedAt: now, reason: "Approved exception" }] }] })).result.totals.overdue, 0);
});

test("no policy, no published timetable and empty rosters are not false healthy evaluations", async () => {
  for (const input of [{ policy: null }, { publication: null, lessons: [] }, { students: [] }, { publication: { id: "p", publishedAt: now } }]) {
    const { result } = await snapshot(input);
    assert.equal(result.totals.overdue, 0);
    if (!input.students && !input.publication?.publishedAt) assert.ok(result.notes.length);
  }
});

test("historical unresolved duties are not truncated to this week; obsolete sources are excluded", async () => {
  const old = { ...obligation, sourceKey: "attendance:2026-10-01:lesson:1", metadata: { classId: 1, subjectId: 1, date: "2026-10-01" } };
  const { result } = await snapshot({ obligations: [old, { ...old, id: "legacy", sourceId: "999", sourceKey: "attendance:2026-10-01:lesson:999" }] });
  assert.equal(result.totals.overdue, 2);
  assert.ok(result.details.some((item) => item.at.startsWith("2026-10-01")));
});

test("duplicate attendance rows cannot mask another student's missing mark", async () => {
  const { result } = await snapshot({ students: [student, { ...student, id: "student-2" }], attendance: [{ studentId: student.id, lessonId: 1, date: now }, { studentId: student.id, lessonId: 1, date: now }] });
  assert.equal(result.totals.overdue, 1);
  assert.match(result.details[0].detail, /1 of 2/);
});

test("homework and CA use configured school-day deadlines and published teacher scope", async () => {
  const assignment = { id: 2, title: "Reading task", lessonId: 1, dueDate: new Date("2026-10-02T00:00:00Z"), lesson: { teacherId: teacher.id, classId: 1, subjectId: 1 }, homeworkSubmissions: [] };
  const activity = { id: 3, title: "Reading activity", activityDate: new Date("2026-10-02T00:00:00Z"), teacherId: teacher.id, classId: 1, subjectId: 1, scores: [] };
  const { result } = await snapshot({ assignments: [assignment, { ...assignment, id: 9, lesson: { ...assignment.lesson, teacherId: "old-teacher" } }], activities: [activity, { ...activity, id: 10, subjectId: 999 }] });
  assert.equal(result.totals.overdue, 3);
  assert.equal(result.followUps[0].homework, 1);
  assert.equal(result.followUps[0].ca, 1);
  assert.ok(result.details.some((row) => row.at === "2026-10-06T16:00:00.000Z"));
  assert.ok(result.details.some((row) => row.at === "2026-10-07T16:00:00.000Z"));
});

test("corrections remain separate and require a real same-school source record", async () => {
  const correction = { id: "request-1", teacherId: teacher.id, teacher, sourceModel: "Attendance", sourceId: "11", reason: "Wrong mark", createdAt: now };
  const { result } = await snapshot({ policy: null, corrections: [correction, { ...correction, id: "bad", sourceId: "12" }], attendanceSources: [{ id: 11 }] });
  assert.equal(result.totals.overdue, 0);
  assert.equal(result.totals.corrections, 1);
  assert.equal(result.details[0].reviewId, "request-1");
  assert.equal((await snapshot({ policy: null, corrections: [correction], attendanceSources: [{ id: 11 }] }, "outside-school")).result.details.length, 0);
});

test("later enrolments do not become missing records for previous homework or CA", async () => {
  const assignment = { id: 2, title: "Reading task", lessonId: 1, dueDate: new Date("2026-10-02T00:00:00Z"), lesson: { teacherId: teacher.id, classId: 1, subjectId: 1 }, homeworkSubmissions: [{ studentId: student.id, status: "CHECKED", checkedAt: now }] };
  const activity = { id: 3, title: "Reading activity", activityDate: new Date("2026-10-02T00:00:00Z"), teacherId: teacher.id, classId: 1, subjectId: 1, scores: [{ studentId: student.id }] };
  const { result } = await snapshot({ students: [student, { ...student, id: "new-student", createdAt: now }], assignments: [assignment], activities: [activity] });
  assert.equal(result.followUps[0].homework, 0);
  assert.equal(result.followUps[0].ca, 0);
});

test("exact review navigation cannot lose older requests behind capped lists", () => {
  const query = readFileSync("src/lib/queries/teacher-accountability-dashboard.ts", "utf8");
  assert.match(query, /focusedEscalationId \? \{ id: focusedEscalationId \}/);
  assert.equal(query.match(/focusedCorrectionId \? \{ id: focusedCorrectionId \}/g).length, 3);
  const page = readFileSync("src/app/(dashboard)/admin/accountability/page.tsx", "utf8");
  assert.match(page, /reviewParamsSchema.safeParse/);
  assert.match(page, /requireCompletedAdminSchoolSetup\(session\)/);
});

test("every database read is scoped and rendering is read-only", async () => {
  const { queries } = await snapshot();
  for (const { name, query } of queries) assert.equal(query.where.schoolId, "school-a", name);
  assert.equal(queries.find((q) => q.name === "publication").query.where.status, "ACTIVE");
  assert.equal(queries.find((q) => q.name === "lessons").query.where.publicationId, "publication-1");
  assert.equal(queries.find((q) => q.name === "student").query.where.status, "ACTIVE");
  const service = readFileSync("src/lib/services/admin-teacher-accountability.ts", "utf8");
  assert.doesNotMatch(service, /\.upsert\(|\.create\(|\.update\(|getTeacherAccountabilitySettings\(/);
});

test("main dashboard removes legacy blocks and follow-up routes are admin-only", () => {
  const dashboard = readFileSync("src/components/AdminDashboard.tsx", "utf8");
  assert.doesNotMatch(dashboard, /CountChart|AttendanceBarChart|EventCalendar|UserCardClient|timetableSnapshot|syllabusSnapshot/);
  assert.match(dashboard, /AdminFinanceSnapshot[\s\S]*AdminTeacherAccountability/);
  const route = readFileSync("src/app/(dashboard)/admin/accountability/follow-up/page.tsx", "utf8");
  assert.match(route, /requirePageSession\(\["admin"\]\)/);
  assert.match(route, /requireCompletedAdminSchoolSetup\(session\)/);
  assert.match(route, /paramsSchema.safeParse/);
  assert.doesNotMatch(route, /CorrectionReviewActions|recordPayment|CAEntry/);
});

test("closed school days cannot create overdue attendance", async () => {
  const { result } = await snapshot({ operating: { activeDays: ["MONDAY"] }, obligations: [obligation] });
  assert.equal(result.totals.overdue, 0);
});

test("open escalations survive missing setup, roster changes and timetable replacement", async () => {
  const row = { id: "historical-escalation", teacherId: teacher.id, teacher, reason: "Review previous delay", escalatedAt: now, obligation: { title: "Previous published lesson", teacherId: teacher.id } };
  for (const change of [{ policy: null }, { publication: null, lessons: [] }, { students: [] }, { teachers: [] }]) {
    const { result } = await snapshot({ ...change, escalations: [row] });
    assert.equal(result.totals.escalations, 1);
    assert.equal(result.details.find((item) => item.kind === "ESCALATION").reviewId, row.id);
  }
  assert.equal((await snapshot({ escalations: [{ ...row, obligation: { ...row.obligation, teacherId: "different-teacher" } }] })).result.totals.escalations, 0);
});

test("CA buckets must match the activity class and subject", async () => {
  const activity = { id: 3, title: "Reading", activityDate: new Date("2026-10-02T00:00:00Z"), teacherId: teacher.id, classId: 1, subjectId: 1, bucket: { classId: 999, subjectId: 1 }, scores: [] };
  assert.equal((await snapshot({ activities: [activity] })).result.followUps[0].ca, 0);
});

function escalationReviewFixture({ wrongTeacher = false, role = "admin", completed = false } = {}) {
  let status = "OPEN";
  const audits = [];
  const paths = [];
  const checks = [];
  const tx = {
    teacherEscalation: { updateMany: async ({ where, data }) => {
      checks.push(where);
      if (where.status !== status) return { count: 0 };
      status = data.status;
      return { count: 1 };
    } },
    teacherObligation: { updateMany: async ({ where }) => { checks.push(where); return { count: 1 }; } },
    teacherCorrectionRequest: { updateMany: async ({ where }) => { checks.push(where); return { count: 0 }; } },
    teacherAccountabilityAuditLog: { create: async ({ data }) => { audits.push(data); } },
  };
  const prisma = {
    teacherEscalation: { findFirst: async ({ where }) => {
      checks.push(where);
      return { id: "escalation-1", status, schoolId: "school-a", teacherId: teacher.id, obligationId: "obligation-1", obligation: { id: "obligation-1", teacherId: wrongTeacher ? "other-teacher" : teacher.id, status: completed ? "COMPLETED_LATE" : "ESCALATED", completedAt: completed ? now : null, priority: "HIGH", title: "Attendance" } };
    } },
    $transaction: async (fn) => fn(tx),
  };
  const actions = load("src/lib/actions/teacherEscalationActions.ts", {
    "@/src/lib/prisma": prisma,
    "@/src/lib/authz": { requireRole: async (roles) => { if (!roles.includes(role)) throw new Error("Forbidden"); return { schoolId: "school-a", userId: "admin-1", role }; } },
    "next/cache": { revalidatePath: (path) => paths.push(path) },
    "@/src/lib/services/school-operating-hours": {},
    "@/src/lib/validation/parse": { parseActionInput: (schema, input) => schema.parse(input) },
  });
  return { actions, audits, paths, checks, get status() { return status; } };
}

test("competing escalation reviewers cannot overwrite decisions or double-log approval", async () => {
  const fixture = escalationReviewFixture();
  const reviews = await Promise.allSettled([
    fixture.actions.reviewTeacherEscalation({ escalationId: "escalation-1", action: "RESOLVE", note: "Reviewed and resolved" }),
    fixture.actions.reviewTeacherEscalation({ escalationId: "escalation-1", action: "DISMISS", note: "Approved exception" }),
  ]);
  assert.equal(reviews.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(fixture.audits.length, 1);
  assert.equal(fixture.status, "RESOLVED");
  for (const where of fixture.checks) assert.equal(where.schoolId, "school-a");
  assert.ok(fixture.paths.includes("/admin/accountability/follow-up"));
  assert.ok(fixture.paths.includes("/admin"));
});

test("escalation review rejects non-admins and mismatched duty ownership before writes", async () => {
  for (const options of [{ role: "teacher" }, { role: "bursar" }, { wrongTeacher: true }]) {
    const fixture = escalationReviewFixture(options);
    await assert.rejects(fixture.actions.reviewTeacherEscalation({ escalationId: "escalation-1", action: "RESOLVE", note: "Reviewed and resolved" }));
    assert.equal(fixture.status, "OPEN");
    assert.equal(fixture.audits.length, 0);
  }
});

test("dismissing an escalation preserves already completed teaching work", async () => {
  const fixture = escalationReviewFixture({ completed: true });
  await fixture.actions.reviewTeacherEscalation({ escalationId: "escalation-1", action: "DISMISS", note: "Completed work reviewed" });
  assert.equal(fixture.status, "DISMISSED");
  assert.equal(fixture.audits[0].after.obligationStatus, "COMPLETED_LATE");
  assert.ok(!fixture.checks.some((where) => where.id === "obligation-1"));
});

test("Section 3 typography matches the established dashboard without crowded mobile grids", () => {
  const ui = readFileSync("src/components/AdminTeacherAccountability.tsx", "utf8");
  assert.match(ui, /text-xl font-black text-gray-950/);
  assert.match(ui, /bg-gray-50 p-3/);
  assert.match(ui, /grid-cols-1 gap-3 sm:grid-cols-3/);
  assert.match(ui, /min-w-0 flex-1 basis-48/);
  assert.match(ui, /flex-wrap items-center justify-between/);
});
