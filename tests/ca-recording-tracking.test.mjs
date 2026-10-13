import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const nodeRequire = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const m = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)((id) => Object.hasOwn(mocks, id) ? mocks[id] : id === "server-only" ? {} : id.startsWith("@/") ? load(`${id.slice(2)}.ts`, mocks) : nodeRequire(id), m, m.exports);
  return m.exports;
}
const at = new Date("2026-10-13T09:30:00Z");
const student = { id: "s1", classId: 1, createdAt: new Date("2026-09-01"), classJoinedAt: new Date("2026-09-01") };
const teacher = { id: "t1", schoolId: "school-a", status: "ACTIVE", name: "Ama", surname: "Mensah", sex: "FEMALE" };
const policy = { caScorePublishWindowSchoolDays: 3, teacherCloseoutTime: "16:00", allowEarlyAttendanceMarking: true, attendanceOpenMinutesBeforeLesson: 10, attendanceGraceMinutesAfterLesson: 10, attendanceEscalateMinutesAfterLesson: 30 };
const score = (studentId, rawScore) => ({ id: 7, studentId, rawScore, normalizedContribution: 999 });
const activity = (overrides = {}) => ({ id: 3, bucketId: 2, schoolId: "school-a", classId: 1, subjectId: 1, teacherId: "t1", teacher, title: "Reading", activityDate: new Date("2026-10-08T09:00:00Z"), rawMaxScore: 10, allocationMarks: null, isLocked: false, scores: [], ...overrides });
const bucket = (activities, overrides = {}) => ({ id: 2, classId: 1, subjectId: 1, schoolId: "school-a", academicYear: "2026/2027", term: "TERM_1", name: "Classwork", type: "CLASSWORK", allocationMarks: 30, aggregationMode: "AVERAGE_TO_BUCKET", isLocked: false, activities, ...overrides });
function fixture(options = {}) {
  const queries = [];
  const read = (name, value) => async (q) => { assert.equal(q.where.schoolId, "school-a"); queries.push({ name, q }); return value; };
  const db = {
    student: { findMany: read("student", options.students ?? [student]) },
    cABucket: { findMany: read("bucket", options.buckets ?? [bucket(options.activities ?? [activity()])]) },
    publishedTimetableLesson: { findMany: read("lesson", options.lessons ?? [{ classId: 1, subjectId: 1, teacherId: "t1", day: "TUESDAY", startTime: new Date("2000-01-01T09:00:00Z"), endTime: new Date("2000-01-01T10:00:00Z"), subjectName: "Reading" }]) },
    teacherObligation: { findMany: read("obligation", options.obligations ?? []) },
    teacherCorrectionRequest: { findMany: read("correction", options.corrections ?? []) },
  };
  const mocks = {
    "@/src/lib/prisma": {},
    "@/src/lib/services/timetable": { listLiveTimetableLessons: () => { throw new Error("No independent query permitted"); } },
    "@/src/lib/services/teacher-accountability-settings": { getTeacherAccountabilitySettings: () => { throw new Error("No settings writes permitted"); } },
  };
  const rules = { invalidAssignmentCount: 0, period: { academicYear: "2026/2027", term: "TERM_1", classworkWeight: 30, examWeight: 70 }, publicationId: "pub", scope: [{ classId: 1, subjectId: 1, teacherId: "t1" }], caPolicy: policy, operating: { timezone: "Africa/Accra", activeDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] }, ...options.rules };
  const { getCARecordingTracking } = load("src/lib/services/ca-recording-tracking.ts", mocks);
  return { queries, run: () => getCARecordingTracking({ schoolId: "school-a", rules, now: options.now ?? at, db, reportPublications: options.publications ?? [] }) };
}
test("no activities is not missing or overdue teacher work", async () => {
  const f = fixture({ buckets: [] });
  const result = await f.run();
  assert.equal(result.subjects[0].label, "No CA activity recorded yet");
  assert.equal(result.totals.overdueActivities, 0);
  assert.equal(result.totals.activities, 0);
  assert.equal(result.subjects[0].termCAComplete, false);
  assert.equal(f.queries.length, 5);
});
test("saved zero counts; no score row does not, and cached contributions are ignored", async () => {
  const f = fixture({ students: [student, { ...student, id: "s2" }], activities: [activity({ scores: [score("s1", 0)] })] });
  const result = await f.run();
  const row = result.activities[0];
  assert.equal(row.eligibleStudents, 2); assert.equal(row.scoresRecorded, 1); assert.equal(row.scoresRemaining, 1);
  assert.equal(row.label, "Scores remaining"); assert.equal(row.recordingPermittedNow, true);
  assert.equal(row.teacherName, "Ms. Ama Mensah");
});
test("deadline is inclusive and overdue starts only after the configured instant", async () => {
  const deadline = new Date("2026-10-13T16:00:00Z");
  assert.equal((await fixture({ now: deadline }).run()).activities[0].state, "REMAINING");
  assert.equal((await fixture({ now: new Date(deadline.getTime() + 1) }).run()).activities[0].label, "Scores overdue");
});
test("late entry is still permitted during a published lesson; deadline and permission are separate", async () => {
  const result = await fixture({ activities: [activity({ activityDate: new Date("2026-10-05T09:00:00Z") })] }).run();
  assert.equal(result.activities[0].state, "OVERDUE");
  assert.equal(result.activities[0].recordingPermittedNow, true);
  const outside = await fixture({ now: new Date("2026-10-13T14:00:00Z") }).run();
  assert.equal(outside.activities[0].state, "REMAINING");
  assert.equal(outside.activities[0].recordingPermittedNow, false);
});
test("all actual scores can be complete while term allocations remain incomplete", async () => {
  const result = await fixture({ buckets: [bucket([activity({ scores: [score("s1", 0)] })], { allocationMarks: 10 })] }).run();
  assert.equal(result.activities[0].label, "Activity scores complete");
  assert.equal(result.subjects[0].allocation.configuredMarks, 10);
  assert.equal(result.subjects[0].allocation.bucketsFulfilled, false);
  assert.equal(result.subjects[0].termCAComplete, false);
});
test("SUM buckets require activities to fulfill the bucket allocation, not only bucket totals", async () => {
  const result = await fixture({ buckets: [bucket([activity({ allocationMarks: 10, scores: [score("s1", 0)] })], { aggregationMode: "SUM_ACTIVITIES" })] }).run();
  assert.equal(result.activities[0].state, "COMPLETE");
  assert.equal(result.subjects[0].allocation.bucketsFulfilled, true);
  assert.equal(result.subjects[0].allocation.activitiesFulfilled, false);
  assert.equal(result.subjects[0].termCAComplete, false);
});
test("complete CA with explicit zeros does not depend on exam entries", async () => {
  const result = await fixture({ activities: [activity({ scores: [score("s1", 0)], isLocked: true })] }).run();
  assert.equal(result.activities[0].state, "COMPLETE");
  assert.equal(result.activities[0].recordingPermittedNow, false);
  assert.equal(result.subjects[0].termCAComplete, true);
  assert.equal(result.totals.completeTermCASubjects, 1);
});
test("late joins never inherit overdue duties but earlier missing evidence remains a placement review", async () => {
  const result = await fixture({ students: [{ ...student, classJoinedAt: new Date("2026-10-12") }], now: new Date("2026-10-14T12:00:00Z") }).run();
  assert.equal(result.activities[0].eligibleStudents, 0);
  assert.equal(result.activities[0].state, "NO_ELIGIBLE_STUDENTS");
  assert.equal(result.totals.overdueActivities, 0);
  assert.equal(result.subjects[0].placementReviewEntries, 1);
  assert.equal(result.subjects[0].termCAComplete, false);
});
test("unknown placement cannot be assumed eligible or complete", async () => {
  const result = await fixture({ students: [{ ...student, classJoinedAt: null }] }).run();
  assert.equal(result.activities[0].state, "PLACEMENT_REVIEW");
  assert.equal(result.activities[0].placementUnknownStudents, 1);
  assert.equal(result.totals.overdueActivities, 0);
});
test("future activities do not produce current overdue or required-score counts", async () => {
  const result = await fixture({ activities: [activity({ activityDate: new Date("2026-10-15") })] }).run();
  assert.equal(result.activities[0].state, "PLANNED");
  assert.equal(result.activities[0].recordingPermittedNow, false);
  assert.equal(result.totals.scoresRequired, 0);
  assert.equal(result.subjects[0].termCAComplete, false);
  const corrupt = await fixture({ activities: [activity({ activityDate: new Date("2026-10-15"), scores: [score("s1", 0)] })] }).run();
  assert.equal(corrupt.activities[0].state, "NEEDS_REVIEW");
  assert.equal(corrupt.totals.scoresRequired, 0);
});
test("locked incomplete sets require review, not impossible normal recording", async () => {
  for (const changes of [{ activities: [activity({ isLocked: true })] }, { publications: [{ classId: 1, status: "SUBMITTED" }] }, { buckets: [bucket([activity()], { isLocked: true })] }]) {
    const result = await fixture(changes).run();
    assert.equal(result.activities[0].state, "NEEDS_REVIEW");
    assert.equal(result.activities[0].recordingPermittedNow, false);
    assert.equal(result.subjects[0].termCAComplete, false);
  }
});
test("invalid/duplicate raw scores never mask a missing eligible student's score", async () => {
  for (const scores of [[score("s1", 90)], [score("s1", -1)], [score("s1", null)], [score("s1", 0), score("s1", 0)]]) {
    const result = await fixture({ activities: [activity({ scores })] }).run();
    assert.equal(result.activities[0].state, "NEEDS_REVIEW");
    assert.equal(result.subjects[0].termCAComplete, false);
  }
});
test("out-of-scope teachers/misfiled activities are excluded and cannot certify term completion", async () => {
  for (const changes of [{ teacherId: "old" }, { classId: 99 }, { teacher: { ...teacher, schoolId: "school-b" } }]) {
    const result = await fixture({ activities: [activity({ ...changes, scores: [score("s1", 0)] })] }).run();
    assert.equal(result.totals.activities, 0); assert.equal(result.totals.ignoredActivities, 1);
    assert.equal(result.subjects[0].state, "NEEDS_REVIEW"); assert.equal(result.subjects[0].termCAComplete, false);
  }
});
test("missing deadline policy keeps remaining counts but never invents zero overdue work", async () => {
  const result = await fixture({ rules: { caPolicy: null } }).run();
  assert.equal(result.totals.overdueActivities, null);
  assert.equal(result.activities[0].state, "DEADLINE_UNAVAILABLE");
  assert.equal(result.activities[0].scoresRemaining, 1);
  assert.equal(result.activities[0].recordingPermittedNow, null);
});
test("accepted exceptions suppress renewed overdue accusations; stale completion requires review", async () => {
  const row = { teacherId: "t1", sourceKey: "ca-score-publishing:activity:3", sourceModel: "CAActivity", sourceId: "3", status: "ESCALATED", completedAt: null, escalations: [{ status: "DISMISSED" }] };
  const result = await fixture({ now: new Date("2026-10-14"), obligations: [row] }).run();
  assert.equal(result.activities[0].state, "REMAINING"); assert.equal(result.activities[0].followUpClosed, true);
  const stale = await fixture({ obligations: [{ ...row, status: "COMPLETED", escalations: [] }] }).run();
  assert.equal(stale.activities[0].state, "NEEDS_REVIEW");
});
test("activity lists are capped after full counts; query count does not grow per student", async () => {
  const activities = Array.from({ length: 9 }, (_, i) => activity({ id: i + 3 }));
  const f = fixture({ activities, students: Array.from({ length: 30 }, (_, i) => ({ ...student, id: `s${i}` })) });
  const result = await f.run();
  assert.equal(result.activities.length, 5); assert.equal(result.totals.activities, 9);
  assert.equal(result.totals.scoresRequired, 270); assert.equal(f.queries.length, 5);
  const q = f.queries.find((entry) => entry.name === "bucket").q;
  assert.equal(q.where.academicYear, "2026/2027"); assert.equal(q.where.term, "TERM_1");
  assert.equal(q.include.activities.include.scores.where.schoolId, "school-a");
});
test("CA-free periods require no activities and never imply missing CA scores", async () => {
  const result = await fixture({ buckets: [], rules: { period: { academicYear: "2026/2027", term: "TERM_1", classworkWeight: 0, examWeight: 100 }, caPolicy: null } }).run();
  assert.equal(result.subjects[0].state, "NOT_REQUIRED"); assert.equal(result.subjects[0].termCAComplete, true);
  assert.equal(result.totals.overdueActivities, 0); assert.equal(result.totals.subjectsWithoutActivities, 0);
});

test("pending CA corrections preserve recorded scores but prevent term CA certification", async () => {
  const result = await fixture({ activities: [activity({ scores: [score("s1", 0)] })], corrections: [{ sourceId: "7" }, { sourceId: "999" }] }).run();
  assert.equal(result.activities[0].state, "COMPLETE");
  assert.equal(result.subjects[0].pendingScoreCorrections, 1);
  assert.equal(result.subjects[0].state, "NEEDS_REVIEW");
  assert.equal(result.subjects[0].termCAComplete, false);
});

test("no independent snapshot/settings reads are used when evaluating actual CA permission", async () => {
  const result = await fixture({ now: new Date("2026-10-13T08:49:59Z") }).run();
  assert.equal(result.activities[0].recordingPermittedNow, false);
  assert.equal((await fixture({ now: new Date("2026-10-13T08:50:00Z") }).run()).activities[0].recordingPermittedNow, true);
  assert.equal((await fixture({ now: new Date("2026-10-13T10:30:00Z") }).run()).activities[0].recordingPermittedNow, true);
  assert.equal((await fixture({ now: new Date("2026-10-13T10:30:00.001Z") }).run()).activities[0].recordingPermittedNow, false);
});

test("another student's saved score never substitutes for a missing roster score", async () => {
  const result = await fixture({ activities: [activity({ scores: [score("another-class-student", 10)] })] }).run();
  assert.equal(result.activities[0].scoresRecorded, 0);
  assert.equal(result.activities[0].scoresRemaining, 1);
  assert.equal(result.subjects[0].termCAComplete, false);
});

test("mismatched obligation sources cannot excuse the actual activity", async () => {
  const obligations = [{ teacherId: "t1", sourceKey: "ca-score-publishing:activity:3", sourceModel: "CAActivity", sourceId: "999", status: "CANCELLED", completedAt: null, escalations: [{ status: "DISMISSED" }] }];
  const result = await fixture({ now: new Date("2026-10-14"), obligations }).run();
  assert.equal(result.activities[0].state, "OVERDUE");
  assert.equal(result.activities[0].followUpClosed, false);
});

test("school-local deadline calculation is shared and invalid policy cannot invent an overdue count", async () => {
  const local = await fixture({ rules: { operating: { timezone: "America/New_York", activeDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] } } }).run();
  assert.equal(local.activities[0].deadline, "2026-10-13T20:00:00.000Z");
  const invalid = await fixture({ rules: { caPolicy: { ...policy, teacherCloseoutTime: "24:00" } } }).run();
  assert.equal(invalid.totals.overdueActivities, null);
  assert.equal(invalid.activities[0].state, "DEADLINE_UNAVAILABLE");
});

test("next lesson is ordered by school clock time, not an irrelevant stored calendar date", () => {
  const { evaluateTeacherCAEntryWindowStatus } = load("src/lib/services/teacher-ca-entry-window.ts", { "@/src/lib/prisma": {}, "@/src/lib/services/timetable": {}, "@/src/lib/services/teacher-accountability-settings": {} });
  const result = evaluateTeacherCAEntryWindowStatus({ now: new Date("2026-10-13T07:00:00Z"), settings: policy, subjectId: 1, lessons: [
    { subjectId: 1, day: "TUESDAY", startTime: new Date("2000-01-01T14:00:00Z"), endTime: new Date("2000-01-01T15:00:00Z"), subject: { name: "Reading" } },
    { subjectId: 1, day: "TUESDAY", startTime: new Date("2026-10-13T09:00:00Z"), endTime: new Date("2026-10-13T10:00:00Z"), subject: { name: "Reading" } },
  ] });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /08:50/);
});

test("valid former-teacher scores stay in canonical term evidence, but are never current teacher duties", async () => {
  const result = await fixture({ activities: [activity({ teacherId: "old-teacher", teacher: { ...teacher, id: "old-teacher", status: "LEFT_SCHOOL" }, scores: [score("s1", 0)] })] }).run();
  assert.equal(result.totals.activities, 0);
  assert.equal(result.totals.ignoredActivities, 1);
  assert.equal(result.totals.overdueActivities, 0);
  assert.equal(result.subjects[0].termCAComplete, true);
  assert.equal(result.subjects[0].completeStudentCAEntries, 1);
});
