import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const nodeRequire = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)((id) => Object.hasOwn(mocks, id) ? mocks[id] : id === "server-only" ? {} : id === "@/src/lib/dashboard-read-budget" ? load("src/lib/dashboard-read-budget.ts") : nodeRequire(id), loaded, loaded.exports);
  return loaded.exports;
}
const core = load("src/lib/attendance-review.ts");
const now = new Date("2026-10-12T14:00:00Z");
function mark(lessonId, status, id = lessonId, studentId = "s1", date = "2026-10-12") { return { id, studentId, lessonId, status, date: new Date(`${date}T12:00:00Z`), updatedAt: now }; }
const lessons = [1, 2].map((sourceId) => ({ sourceId, classId: 1, className: "Primary Six", subjectName: "Math", teacherId: "t1", teacherName: "Ama", day: "MONDAY", startTime: new Date(`1970-01-01T${sourceId === 1 ? "08" : "10"}:00:00Z`), endTime: new Date(`1970-01-01T${sourceId === 1 ? "09" : "11"}:00:00Z`) }));
const publication = { id: "p1", publishedAt: new Date("2026-09-01T00:00:00Z"), archivedAt: null, lessons };
test("daily absence requires every distinct expected lesson; duplicates cannot fill gaps", () => {
  assert.equal(core.schoolDayPosition([mark(1, "ABSENT"), mark(1, "ABSENT", 3)], [1, 2]), "UNKNOWN");
  assert.equal(core.schoolDayPosition([mark(1, "ABSENT"), mark(2, "ABSENT")], [1, 2]), "ABSENT");
  assert.equal(core.schoolDayPosition([mark(1, "ABSENT"), mark(2, "EXCUSED")], [1, 2]), "UNKNOWN");
  assert.equal(core.schoolDayPosition([mark(1, "EXCUSED"), mark(2, "EXCUSED")], [1, 2]), "EXCUSED");
  assert.equal(core.schoolDayPosition([mark(1, "ABSENT"), mark(2, "ABSENT")], [1, 2], false), "UNKNOWN");
});
test("positive evidence wins over absence without multiplying students", () => {
  assert.equal(core.schoolDayPosition([mark(1, "PRESENT"), mark(2, "ABSENT")], [1, 2]), "PRESENT");
  assert.equal(core.schoolDayPosition([mark(1, "PRESENT"), mark(2, "LATE")], [1, 2]), "LATE");
  assert.equal(core.schoolDayPosition([mark(9, "PRESENT")], [1, 2]), "UNKNOWN");
  assert.equal(core.schoolDayPosition([], []), "NO_LESSONS");
});
test("latest correction replaces the earlier mark deterministically", () => {
  assert.equal(core.schoolDayPosition([mark(1, "ABSENT", 1), mark(1, "PRESENT", 3)], [1]), "PRESENT");
  assert.equal(core.latestAttendanceMarks([mark(1, "ABSENT", 5, "s1"), mark(1, "ABSENT", 6, "s2")]).length, 2);
});
test("school dates and day bounds respect timezone and DST, not server local date", () => {
  assert.equal(core.schoolAttendanceDate(new Date("2026-10-12T00:30:00Z"), "America/New_York"), "2026-10-11");
  const b = core.attendanceDateBounds("2026-03-08", "America/New_York");
  assert.equal(b.end - b.start, 23 * 3600000);
  assert.equal(core.attendanceClock("2026-10-12", new Date("1970-01-01T08:00:00Z"), "America/New_York").toISOString(), "2026-10-12T12:00:00.000Z");
});
test("only effective published lessons count; schedule changes make absence uncertain", () => {
  assert.equal(core.attendanceSchedule([], "2026-10-12", "Africa/Accra", ["MONDAY"], now).lessons.length, 0);
  assert.equal(core.attendanceSchedule([publication], "2026-10-12", "Africa/Accra", ["TUESDAY"], now).lessons.length, 0);
  const replacement = { ...publication, id: "p2", publishedAt: new Date("2026-10-12T09:30:00Z") };
  const data = core.attendanceSchedule([{ ...publication, archivedAt: replacement.publishedAt }, replacement], "2026-10-12", "Africa/Accra", ["MONDAY"], now);
  assert.equal(data.ambiguous, true);
  assert.deepEqual(data.lessons.map((l) => l.sourceId), [2]);
  assert.equal(core.attendanceSchedule([{ ...publication, archivedAt: new Date("2026-10-12T09:30:00Z") }], "2026-10-12", "Africa/Accra", ["MONDAY"], now).ambiguous, true);
});
function fixture({ records, empty = false, moved = false, joined = false, inactive = false, changed = false } = {}) {
  const queries = [];
  const students = [{ id: "s1", name: "Ama", surname: "A", classId: 1, createdAt: new Date("2026-01-01") }, { id: "s2", name: "Kojo", surname: "B", classId: 1, createdAt: new Date("2026-01-01") }];
  if (moved) students[0].classId = 2;
  if (joined) students[1].createdAt = new Date("2026-10-12T09:30:00Z");
  const dataRecords = records ?? [mark(1, "ABSENT"), mark(2, "ABSENT"), mark(1, "ABSENT", 5, "s2"), mark(1, "ABSENT", 6, "s2")];
  const track = (value) => async (q) => { queries.push(q); return typeof value === "function" ? value(q) : value; };
  const db = {
    schoolNotificationSetting: { findUnique: track({ timezone: "Africa/Accra", activeDays: ["MONDAY"] }) },
    teacherAccountabilitySetting: { findUnique: track({ allowEarlyAttendanceMarking: true, attendanceOpenMinutesBeforeLesson: 10, attendanceEscalateMinutesAfterLesson: 30 }) },
    class: { findMany: track([{ id: 1, name: "Primary Six" }, { id: 2, name: "Primary Five" }]) },
    student: { findMany: track((q) => empty || q.where.id ? [] : students.filter((s) => s.createdAt <= q.where.createdAt.lte)), findFirst: track((q) => inactive && q.where.id === "old" ? { ...students[0], id: "old", status: "WITHDRAWN" } : students.find((s) => s.id === q.where.id) ?? null) },
    timetablePublication: { findFirst: track(changed ? { ...publication, archivedAt: new Date("2026-10-12T09:30:00Z") } : publication), findMany: track(changed ? [{ ...publication, id: "p2", publishedAt: new Date("2026-10-12T09:30:00Z") }] : []) },
    attendance: { findMany: track((q) => dataRecords.filter((r) => (!q.where.studentId || q.where.studentId.in.includes(r.studentId)) && (!q.where.lessonId || q.where.lessonId.in.includes(r.lessonId)) && r.date >= q.where.date.gte && r.date < q.where.date.lt)) },
  };
  const query = load("src/lib/queries/admin-attendance-review.ts", { "@/src/lib/attendance-review": core, "@/src/lib/services/teacher-accountability-settings": { DEFAULT_TEACHER_ACCOUNTABILITY_SETTINGS: {} }, "@/src/lib/authz": { requireRole: async (roles) => { assert.deepEqual(roles, ["admin"]); return { schoolId: "school-a" }; } }, "@/src/lib/prisma": { $transaction: async (work, opts) => { assert.equal(opts.isolationLevel, "RepeatableRead"); return work(db); } } });
  return { query, queries };
}
test("admin daily review deduplicates student totals and marking completeness independently", async () => {
  const f = fixture();
  const data = await f.query.getAdminAttendanceReview({}, now);
  assert.equal(data.totals.ABSENT, 1);
  assert.equal(data.totals.UNKNOWN, 1);
  assert.equal(data.lessons[0].marked, 2);
  assert.equal(data.lessons[1].marked, 1);
  assert.equal(data.lessons[1].state, "WINDOW_CLOSED");
  assert.ok(f.queries.every((q) => q.where.schoolId === "school-a"));
  assert.equal(f.queries.find((q) => q.include?.lessons).include.lessons.where.schoolId, "school-a");
});
test("recurring absence counts days, not the number of missed lesson marks", async () => {
  const records = ["2026-09-28", "2026-10-05", "2026-10-12"].flatMap((date, index) => [mark(1, "ABSENT", index * 10 + 1, "s1", date), mark(2, "ABSENT", index * 10 + 2, "s1", date)]);
  const data = await fixture({ records }).query.getAdminAttendanceReview({ studentId: "s1" }, now);
  assert.equal(data.recurring[0].absentDays, 3);
  assert.equal(data.history.filter((day) => day.status === "ABSENT").length, 3);
  assert.equal(data.history.find((day) => day.date === "2026-10-06").status, "NO_LESSONS");
});
test("invalid or foreign filters expose no attendance rows", async () => {
  for (const params of [{ date: "2026-02-30" }, { date: "2026-10-13" }, { classId: "999" }, { studentId: "foreign" }, { classId: ["1"] }, { page: "0" }]) {
    const data = await fixture().query.getAdminAttendanceReview(params, now);
    assert.ok(data.error);
    assert.equal(data.rows.length, 0);
    assert.equal(data.history.length, 0);
  }
});
test("past reviews do not claim that historical lesson rosters were complete", async () => {
  const data = await fixture().query.getAdminAttendanceReview({ date: "2026-10-05" }, now);
  assert.ok(data.lessons.every((lesson) => lesson.expected === null && lesson.state === "HISTORICAL"));
});

test("history without recorded placement never invents old lessons from today's class", async () => {
  const data = await fixture({ records: [] }).query.getAdminAttendanceReview({ studentId: "s1", date: "2026-10-05" }, now);
  const day = data.history.find((row) => row.date === "2026-10-05");
  assert.equal(day.status, "UNKNOWN");
  assert.equal(day.expected, null);
  assert.equal(day.classId, null);
  assert.equal(day.className, "Class not recorded");
});
test("intraday publication changes cannot show complete on the page but incomplete in the pulse", async () => {
  const data = await fixture({ changed: true, records: [mark(2, "ABSENT"), mark(2, "ABSENT", 4, "s2")] }).query.getAdminAttendanceReview({}, now);
  assert.equal(data.ambiguous, true);
  assert.equal(data.lessons[0].state, "REVIEW");
  assert.equal(data.totals.ABSENT, 0);
  const pulse = load("src/lib/admin-attendance-pulse.ts").applyAttendanceReviewToPulse({ classDutySummary: [] }, data);
  assert.equal(pulse.lessonsMarkedToday, 0);
  assert.equal(pulse.closedUnmarkedLessons, 0);
});
test("opening an inactive student's history cannot alter historical lesson totals", async () => {
  const records = [mark(1, "ABSENT", 1, "s1", "2026-10-05"), mark(1, "ABSENT", 2, "old", "2026-10-05")];
  const f = fixture({ inactive: true, records });
  const normal = await f.query.getAdminAttendanceReview({ date: "2026-10-05" }, now);
  const detail = await f.query.getAdminAttendanceReview({ date: "2026-10-05", studentId: "old" }, now);
  assert.equal(normal.lessons[0].marked, 2);
  assert.deepEqual(detail.lessons, normal.lessons);
  assert.equal(detail.rosterCount, normal.rosterCount);
});
test("moved students cannot make their old lesson roster look complete or become falsely absent", async () => {
  const data = await fixture({ moved: true, records: [mark(1, "ABSENT"), mark(2, "ABSENT"), mark(1, "PRESENT", 3, "s2"), mark(2, "PRESENT", 4, "s2")] }).query.getAdminAttendanceReview({}, now);
  assert.equal(data.rows.find((row) => row.student.id === "s1").status, "UNKNOWN");
  assert.equal(data.rows.find((row) => row.student.id === "s1").classId, 2);
  assert.ok(data.lessons.every((lesson) => lesson.state === "REVIEW"));
  assert.equal(data.lessons[0].recorded, 2);
  assert.equal(data.lessons[0].marked, 1);
});
test("later enrollment does not retroactively create missing marks for earlier lessons", async () => {
  const data = await fixture({ joined: true, records: [mark(1, "PRESENT"), mark(2, "PRESENT")] }).query.getAdminAttendanceReview({}, now);
  assert.equal(data.lessons[0].expected, 1);
  assert.equal(data.lessons[0].state, "COMPLETE");
  assert.equal(data.lessons[1].expected, 2);
  assert.equal(data.rows.find((row) => row.student.id === "s2").expected, 1);
  assert.equal(data.rows.find((row) => row.student.id === "s2").status, "UNKNOWN");
});
test("daily totals partition the roster and status filters do not change summaries or lesson totals", async () => {
  const f = fixture();
  const full = await f.query.getAdminAttendanceReview({}, now);
  const filtered = await f.query.getAdminAttendanceReview({ status: "ABSENT" }, now);
  assert.equal(Object.values(full.totals).reduce((a, b) => a + b, 0), full.rosterCount);
  assert.deepEqual(filtered.totals, full.totals);
  assert.deepEqual(filtered.lessons, full.lessons);
  assert.equal(filtered.rows.length, 1);
  assert.equal((await f.query.getAdminAttendanceReview({ status: "NO_LESSONS" }, now)).error, null);
});

test("duty synchronization uses the same per-lesson enrollment eligibility as the review", async () => {
  const saved = [];
  const rows = [mark(1, "PRESENT")];
  const service = load("src/lib/services/teacher-attendance-obligations.ts", {
    "@/src/lib/attendance-review": core,
    "@/src/lib/prisma": { teacher: { findMany: async () => [{ id: "t1" }] }, student: { findMany: async (q) => { assert.equal(q.select.createdAt, true); return [{ id: "s1", classId: 1, createdAt: new Date("2026-01-01") }, { id: "s2", classId: 1, createdAt: new Date("2026-10-12T09:30:00Z") }]; } }, attendance: { findMany: async () => rows } },
    "@/src/lib/services/teacher-accountability-settings": { getTeacherAccountabilitySettings: async () => ({ allowEarlyAttendanceMarking: true, attendanceOpenMinutesBeforeLesson: 10, attendanceGraceMinutesAfterLesson: 10, attendanceEscalateMinutesAfterLesson: 30 }) },
    "@/src/lib/services/timetable": { getActiveTimetablePublication: async () => publication, listLiveTimetableLessons: async () => lessons.map((l) => ({ ...l, id: l.sourceId, subjectId: 1, teacher: { name: "Ama", surname: "A" }, class: { name: l.className }, subject: { name: l.subjectName } })) },
    "@/src/lib/services/school-operating-hours": { getSchoolOperatingWindowStatus: async () => ({ activeDays: ["MONDAY"] }) },
    "@/src/lib/services/teacher-obligation-store": { saveTeacherObligation: async (input) => { saved.push(input); return { id: `o${saved.length}`, ...input }; } },
  });
  await service.syncAttendanceObligationsForDate({ schoolId: "school-a", date: now, now });
  assert.equal(saved[0].metadata.studentCount, 1);
  assert.equal(saved[0].metadata.attendanceCount, 1);
  assert.match(saved[0].status, /^COMPLETED/);
  assert.equal(saved[1].metadata.studentCount, 2);
});
test("school pulse uses the same distinct daily counts and excludes upcoming lessons from overdue alerts", async () => {
  const data = await fixture().query.getAdminAttendanceReview({}, now);
  const adapter = load("src/lib/admin-attendance-pulse.ts");
  const result = adapter.applyAttendanceReviewToPulse({ classDutySummary: [] }, data);
  assert.equal(result.absent, 1);
  assert.equal(result.unknown, 1);
  assert.equal(result.lessonsMarkedToday, 1);
  assert.equal(result.unmarkedLessonsToday, 1);
  assert.equal(result.closedUnmarkedLessons, 1);
  const early = await fixture({ records: [] }).query.getAdminAttendanceReview({}, new Date("2026-10-12T07:00:00Z"));
  assert.equal(adapter.applyAttendanceReviewToPulse({ classDutySummary: [] }, early).closedUnmarkedLessons, 0);
});
test("management route is read-only and preserves teacher-only attendance recording", () => {
  const page = readFileSync("src/app/(dashboard)/list/attendance/page.tsx", "utf8");
  assert.match(page, /requirePageSession\(\["admin", "teacher"\]\)/);
  assert.match(page, /role === "teacher".*redirect\("\/list\/attendance\/take"\)/);
  const ui = readFileSync("src/components/AdminAttendanceReview.tsx", "utf8");
  assert.doesNotMatch(ui, /saveAttendance|attendanceActions|\/attendance\/take|method="post"/);
  assert.match(readFileSync("src/lib/services/attendance.ts", "utf8"), /actorRole !== "teacher"/);
});

function access({ linked = false, teacher = false, supervisor = null } = {}) {
  return load("src/lib/services/attendance-read-access.ts", {
    "@/src/lib/prisma": { student: { findFirst: async (q) => { assert.equal(q.where.schoolId, "school-a"); return q.where.id === "s1" ? { id: "s1", classId: 1 } : null; } }, class: { findFirst: async (q) => { assert.equal(q.where.schoolId, "school-a"); return q.where.id === 1 ? { supervisorId: supervisor } : null; } } },
    "@/src/lib/authz": { AuthorizationError: class extends Error {} },
    "@/src/lib/services/parent-student-relationships": { parentCanAccessStudent: async (q) => { assert.equal(q.schoolId, "school-a"); return linked; } },
    "@/src/lib/services/timetable": { listLiveTimetableLessons: async (schoolId, q) => { assert.equal(schoolId, "school-a"); assert.equal(q.teacherId, "t1"); return teacher ? [{}] : []; } },
  }).assertAttendanceStatsAccess;
}
test("statistics API denies school-wide parent/student requests and unlinked wards", async () => {
  const ctx = { userId: "p1", schoolId: "school-a", role: "parent" };
  await assert.rejects(access()(ctx, {}));
  await assert.rejects(access()(ctx, { studentId: "s1" }));
  await assert.rejects(access({ linked: true })(ctx, { studentId: "s1", classId: 1 }));
  await access({ linked: true })(ctx, { studentId: "s1" });
  await assert.rejects(access()({ ...ctx, role: "student", userId: "other" }, { studentId: "s1" }));
  await access()({ ...ctx, role: "student", userId: "s1" }, { studentId: "s1" });
});
test("teacher statistics require published class scope or class-teacher responsibility", async () => {
  const ctx = { userId: "t1", schoolId: "school-a", role: "teacher" };
  await assert.rejects(access()(ctx, {}));
  await assert.rejects(access()(ctx, { classId: 1 }));
  await assert.rejects(access({ teacher: true })(ctx, { studentId: "s1", classId: 2 }));
  await access({ teacher: true })(ctx, { studentId: "s1" });
  await access({ supervisor: "t1" })(ctx, { classId: 1 });
  assert.match(readFileSync("src/app/api/attendance/stats/route.ts", "utf8"), /await assertAttendanceStatsAccess\(context, parsed.data\)/);
});
