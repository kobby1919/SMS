import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { dirname, resolve } from "node:path";
const nodeRequire = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const m = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)((id) => Object.hasOwn(mocks, id) ? mocks[id] : id === "server-only" ? {} : id.startsWith("@/") ? load(`${id.slice(2)}.ts`, mocks) : id.startsWith(".") ? load(`${resolve(dirname(path), id)}.ts`, mocks) : nodeRequire(id), m, m.exports);
  return m.exports;
}
const rules = load("src/lib/academic-readiness-rules.ts");
const now = new Date("2026-10-13T12:00:00Z");
const caCalculator = load("src/lib/services/ca-activity.ts", { "@/src/lib/prisma": {}, "@/src/lib/services/timetable": {} }).buildSubjectCAProgress;
test("explicit zero is recorded; default zero, invalid marks and invalid timestamps are not", () => {
  assert.equal(rules.hasRecordedExam({ examScore: 0 }), false);
  assert.equal(rules.hasRecordedExam({ examScore: 0, examRecordedAt: now }), true);
  assert.equal(rules.hasRecordedExam({ examScore: 0, examRecordedAt: "invalid" }), false);
  assert.equal(rules.hasRecordedExam({ examScore: -1, examRecordedAt: now }), false);
  assert.equal(rules.hasRecordedExam({ examScore: NaN, examRecordedAt: now }), false);
  assert.equal(rules.hasRecordedExam({ examScore: 10 }), true);
});
test("exam lifecycle never treats not-configured or not-opened windows as overdue", () => {
  assert.equal(rules.examEntryState(0, null), "NOT_REQUIRED");
  assert.equal(rules.examEntryState(70, null), "NOT_CONFIGURED");
  assert.equal(rules.examEntryState(70, { status: "LOCKED", openedAt: null }), "NOT_OPENED");
  assert.equal(rules.examEntryState(70, { status: "LOCKED", openedAt: now }), "NEEDS_REVIEW");
  assert.equal(rules.examEntryState(70, { status: "CLOSED", openedAt: now }), "CLOSED");
  assert.equal(rules.examEntryState(70, { status: "OPEN", openedAt: now }), "OPEN");
  assert.equal(rules.examEntryState(70, { status: "OPEN" }), "NEEDS_REVIEW");
  assert.equal(rules.examEntryState(70, { status: "UNKNOWN" }), "NEEDS_REVIEW");
  assert.equal(rules.examEntryState(70, { status: "OPEN", openedAt: new Date("invalid") }), "NEEDS_REVIEW");
});
test("late admissions and transfers do not inherit earlier CA duties", () => {
  const oldAccount = new Date("2020-01-01");
  const before = new Date(now.getTime() - 1);
  const after = new Date(now.getTime() + 1);
  assert.equal(rules.activityEligibility({ createdAt: oldAccount, classJoinedAt: now }, before), "NOT_YET_JOINED");
  assert.equal(rules.activityEligibility({ createdAt: now, classJoinedAt: oldAccount }, before), "NOT_YET_JOINED");
  assert.equal(rules.activityEligibility({ createdAt: oldAccount, classJoinedAt: now }, after), "ELIGIBLE");
  assert.equal(rules.activityEligibility({ createdAt: oldAccount, classJoinedAt: null }, before), "PLACEMENT_UNKNOWN");
});
test("CA deadlines respect school operating days and timezone, not the server timezone", () => {
  assert.equal(rules.caRecordingDeadline(new Date("2026-10-09T10:00:00Z"), 3, "16:00").toISOString(), "2026-10-14T16:00:00.000Z");
  assert.equal(rules.caRecordingDeadline(new Date("2026-10-09T10:00:00Z"), 1, "16:00", { timezone: "America/New_York", activeDays: ["SATURDAY"] }).toISOString(), "2026-10-10T20:00:00.000Z");
  assert.throws(() => rules.caRecordingDeadline(now, -1, "16:00"), /invalid/);
  assert.throws(() => rules.caRecordingDeadline(now, 1, "24:00"), /invalid/);
  assert.throws(() => rules.caRecordingDeadline(now, 1, "16:00", { activeDays: ["BAD"] }), /valid school/);
  assert.throws(() => rules.caRecordingDeadline(now, 1, "16:00", { activeDays: ["MONDAY", "BAD"] }), /valid school/);
});
test("empty strings cannot be coerced into explicitly recorded exam zeroes", () => {
  const { caBulkEntrySchema } = load("src/lib/validation/ca.ts");
  const input = { rows: [{ studentId: "s", classworkScore: 0, examScore: "" }], classId: 1, subjectId: 1, term: "TERM_1", academicYear: "2026/27" };
  assert.equal(caBulkEntrySchema.safeParse(input).success, false);
  assert.equal(caBulkEntrySchema.safeParse({ ...input, rows: [{ ...input.rows[0], examScore: 0 }] }).success, true);
});
test("CA score precision matches storage and blank values never become recorded zero", () => {
  const { rawActivityMarkSchema } = load("src/lib/validation/ca.ts");
  for (const value of ["", "0", 0.001, NaN, Infinity]) assert.equal(rawActivityMarkSchema.safeParse(value).success, false);
  for (const value of [0, 0.01, 9.99, 1000]) assert.equal(rawActivityMarkSchema.safeParse(value).success, true);
});
function fixture(options = {}) {
  const state = { records: new Map(), audits: [], commits: 0 };
  if (options.existing) state.records.set("s", options.existing);
  const config = { id: 1, academicYear: "2026/27", currentTerm: "TERM_1", classworkWeight: 30, examWeight: 70 };
  const guard = (q) => { assert.equal(q.where.schoolId ?? q.where.schoolId_classId_term_academicYear?.schoolId, "school-a"); };
  const prisma = { $transaction: async (work, opts) => {
    assert.equal(opts.isolationLevel, "Serializable");
    const records = new Map(state.records), audits = [];
    const tx = {
      cAConfig: { findMany: async (q) => { guard(q); return options.noConfig ? [] : options.multipleConfigs ? [config, config] : [config]; } },
      teacher: { findFirst: async (q) => { guard(q); assert.equal(q.where.status, "ACTIVE"); return options.inactive ? null : { id: "t" }; } },
      timetablePublication: { findMany: async (q) => { guard(q); return options.noPublication ? [] : options.multiplePublications ? [{ id: "p1" }, { id: "p2" }] : [{ id: "pub" }]; } },
      class: { findFirst: async (q) => { guard(q); return { id: 1 }; } },
      subject: { findFirst: async (q) => { guard(q); return { id: 2 }; } },
      publishedTimetableLesson: { findFirst: async (q) => { guard(q); assert.equal(q.where.teacherId, "t"); assert.equal(q.where.publication.status, "ACTIVE"); return options.wrongScope ? null : { id: 1 }; } },
      examEntryWindow: { findUnique: async (q) => { guard(q); return options.window ?? { status: options.closed ? "CLOSED" : "OPEN", openedAt: now }; } },
      student: { count: async (q) => { guard(q); assert.equal(q.where.status, "ACTIVE"); return options.otherStudent ? 0 : q.where.id.in.length; } },
      continuousAssessment: {
        findUnique: async (q) => records.get(q.where.schoolId_studentId_subjectId_classId_term_academicYear.studentId) ?? null,
        upsert: async (q) => { const key = q.where.schoolId_studentId_subjectId_classId_term_academicYear.studentId; const row = { id: 1, ...(records.has(key) ? q.update : q.create) }; records.set(key, row); return row; },
      },
      cAAuditLog: { create: async (q) => { if (options.auditFail) throw new Error("Audit unavailable"); audits.push(q.data); } },
    };
    const result = await work(tx);
    state.records = records; state.audits.push(...audits); state.commits++; return result;
  } };
  const service = load("src/lib/services/exam-recording.ts", { "@/src/lib/prisma": prisma, "@/src/lib/services/report-publication": { assertReportSetEditable: async () => { if (options.published) throw new Error("Report locked"); } }, "@/src/lib/services/ca-activity": { getSubjectCAProgress: async () => ({ earnedMarks: options.invalidCA ? NaN : 20 }) } });
  return { ...service, state, input: { schoolId: "school-a", teacherId: "t", classId: 1, subjectId: 2, term: "TERM_1", academicYear: "2026/27", rows: [{ studentId: "s", examScore: 0 }] } };
}
test("zero recording is atomic, auditable, idempotent, and cannot be overwritten without correction", async () => {
  const f = fixture();
  await f.recordExamScores(f.input, now);
  assert.equal(f.state.records.get("s").examRecordedAt, now);
  assert.equal(f.state.records.get("s").totalScore, 20);
  assert.equal(f.state.audits.length, 1);
  await f.recordExamScores(f.input, new Date(now.getTime() + 1000));
  assert.equal(f.state.audits.length, 1);
  assert.equal(f.state.records.get("s").examRecordedAt, now);
  await assert.rejects(f.recordExamScores({ ...f.input, rows: [{ studentId: "s", examScore: 1 }] }), /correction/);
});
test("invalid scope, windows, roster, periods, release locks and audit failures roll back exam writes", async () => {
  for (const opts of [{ noConfig: true }, { multipleConfigs: true }, { invalidCA: true }, { inactive: true }, { noPublication: true }, { multiplePublications: true }, { wrongScope: true }, { otherStudent: true }, { closed: true }, { published: true }, { auditFail: true }]) {
    const f = fixture(opts); await assert.rejects(f.recordExamScores(f.input)); assert.equal(f.state.commits, 0); assert.equal(f.state.records.size, 0);
  }
  const f = fixture();
  await assert.rejects(f.recordExamScores({ ...f.input, academicYear: "2025/26" }), /active/);
  await assert.rejects(f.recordExamScores({ ...f.input, rows: [...f.input.rows, ...f.input.rows] }), /once/);
  for (const examScore of [71, -1, Infinity, NaN]) await assert.rejects(f.recordExamScores({ ...f.input, rows: [{ studentId: "s", examScore }] }), /between/);
  assert.equal(f.state.commits, 0);
});
test("a later invalid row rolls back the entire exam batch", async () => {
  const f = fixture();
  await assert.rejects(f.recordExamScores({ ...f.input, rows: [...f.input.rows, { studentId: "s2", examScore: 71 }] }), /between/);
  assert.equal(f.state.commits, 0);
  assert.equal(f.state.records.size, 0);
  assert.equal(f.state.audits.length, 0);
});

test("malformed existing exam evidence cannot be silently overwritten as missing", async () => {
  for (const existing of [{ examScore: -1 }, { examScore: Number.NaN }, { examScore: 90 }, { examScore: 0, examRecordedAt: "invalid" }]) {
    const f = fixture({ existing });
    await assert.rejects(f.recordExamScores(f.input, now), /correction workflow/);
    assert.equal(f.state.commits, 0);
    assert.equal(f.state.audits.length, 0);
  }
  for (const window of [{ status: "OPEN" }, { status: "OPEN", openedAt: now, closedAt: now }, { status: "OPEN", openedAt: new Date("invalid") }]) {
    const f = fixture({ window });
    await assert.rejects(f.recordExamScores(f.input, now), /not open/);
    assert.equal(f.state.commits, 0);
  }
});

test("exam evidence and window classifiers fail closed on corrupt metadata", () => {
  assert.equal(rules.hasRecordedExam({ examScore: 20, examRecordedAt: "invalid" }), false);
  assert.equal(rules.examEvidenceState({ examScore: 20, examRecordedAt: "invalid" }, 70), "INVALID");
  assert.equal(rules.examEvidenceState({ examScore: 60 }, 0), "NOT_REQUIRED");
  assert.equal(rules.examEntryState(Number.NaN, { status: "OPEN", openedAt: now }), "NEEDS_REVIEW");
  assert.equal(rules.examEntryState(70, { status: "CLOSED", openedAt: now, closedAt: new Date(now.getTime() - 1) }), "NEEDS_REVIEW");
});
test("shared readiness rules use one school, reject conflicting setup and omit inactive teacher scopes", async () => {
  const config = { academicYear: "2026/27", currentTerm: "TERM_1", classworkWeight: 30, examWeight: 70 };
  async function run(options = {}) {
    const scoped = (result) => async (query) => { assert.equal(query.where.schoolId, "school-a"); return result; };
    const db = {
      cAConfig: { findMany: scoped(options.conflict ? [config, config] : options.empty ? [] : [config]) },
      timetablePublication: { findMany: scoped(options.empty ? [] : [{ id: "pub" }]) },
      teacherAccountabilitySetting: { findUnique: scoped(options.empty ? null : { caScorePublishWindowSchoolDays: 3 }) },
      schoolNotificationSetting: { findUnique: scoped({ timezone: "Africa/Accra", activeDays: ["MONDAY"] }) },
      publishedTimetableLesson: { findMany: scoped([{ classId: 1, subjectId: 2, teacherId: "t" }, { classId: 1, subjectId: 2, teacherId: "t" }]) },
      teacher: { findMany: scoped(options.inactive ? [] : [{ id: "t" }]) },
      class: { findMany: scoped([{ id: 1 }]) }, subject: { findMany: scoped([{ id: 2 }]) },
      examEntryWindow: { findMany: scoped([]) },
    };
    const { getAcademicReadinessRules } = load("src/lib/services/academic-readiness-rules.ts", { "@/src/lib/prisma": { $transaction: async (work, opts) => { assert.equal(opts.isolationLevel, "RepeatableRead"); return work(db); } } });
    return getAcademicReadinessRules("school-a");
  }
  const ready = await run();
  assert.equal(ready.scope.length, 1);
  assert.equal(ready.invalidAssignmentCount, 0);
  assert.equal(ready.examWindows[0].state, "NOT_CONFIGURED");
  assert.equal(ready.operating.timezone, "Africa/Accra");
  assert.equal((await run({ conflict: true })).period, null);
  const empty = await run({ empty: true });
  assert.equal(empty.period, null); assert.equal(empty.publicationId, null); assert.equal(empty.scope.length, 0); assert.equal(empty.issues.length, 3);
  const inactive = await run({ inactive: true });
  assert.equal(inactive.invalidAssignmentCount, 2);
  assert.equal(inactive.scope.length, 0); assert.match(inactive.issues[0], /assignments/);
});
function caFixture(options = {}) {
  const state = { saved: [], totals: [], locked: false, audits: [] };
  const service = load("src/lib/services/ca-score-recording.ts", {
    "@/src/lib/services/teacher-accountability-settings": {},
    "@/src/lib/services/timetable": {},
    "@/src/lib/prisma": { $transaction: async (work, opts) => {
      assert.equal(opts.isolationLevel, "Serializable");
      const pending = { saved: [], totals: [], locked: false, audits: [] };
      const tx = {
        cAConfig: { findMany: async () => [{ academicYear: "2026/27", currentTerm: "TERM_1", classworkWeight: 30, examWeight: 70 }] },
        cAActivity: { findFirst: async (q) => { assert.equal(q.where.schoolId, "school-a"); assert.equal(q.where.teacherId, "t"); return { id: 1, classId: 1, subjectId: 2, rawMaxScore: 10, activityDate: new Date("2026-10-10"), updatedAt: now, isLocked: options.locked ?? false, bucket: { classId: 1, subjectId: 2, isLocked: false } }; }, updateMany: async () => { pending.locked = true; return { count: options.race ? 0 : 1 }; } },
        timetablePublication: { findMany: async () => [{ id: "pub" }] }, publishedTimetableLesson: { findMany: async () => options.wrongScope ? [] : [{ subjectId: 2, subjectName: "Reading", day: "TUESDAY", startTime: new Date(options.closedWindow ? "2000-01-01T14:00:00Z" : "2000-01-01T11:30:00Z"), endTime: new Date(options.closedWindow ? "2000-01-01T15:00:00Z" : "2000-01-01T12:30:00Z") }] },
        teacherAccountabilitySetting: { findUnique: async () => options.noPolicy ? null : { allowEarlyAttendanceMarking: true, attendanceOpenMinutesBeforeLesson: 10, attendanceGraceMinutesAfterLesson: 10, attendanceEscalateMinutesAfterLesson: 30 } },
        schoolNotificationSetting: { findUnique: async () => ({ timezone: options.timezone ?? "Africa/Accra" }) },
        cABucket: { findMany: async () => [{ id: 1, name: "Classwork", type: "CLASSWORK", subjectId: 2, classId: 1, aggregationMode: "AVERAGE_TO_BUCKET", allocationMarks: options.allocation ?? 30, activities: [{ id: 1, teacherId: "t", subjectId: 2, rawMaxScore: 10, activityDate: new Date("2026-10-10"), teacher: { id: "t", schoolId: "school-a", name: "Teacher", surname: "A" } }] }] },
        student: { findMany: async () => [{ id: "s", createdAt: new Date("2026-09-01"), classJoinedAt: new Date("2026-09-01") }, { id: "transfer", createdAt: new Date("2020-01-01"), classJoinedAt: now }] },
        cAAuditLog: { create: async (q) => { if (options.auditFail) throw new Error("Audit failed"); pending.audits.push(q.data); } },
        pending,
      };
      const result = await work(tx); Object.assign(state, pending); return result;
    } },
    "@/src/lib/services/report-publication": { assertReportSetEditable: async () => { if (options.published) throw new Error("Published report locked"); } },
    "@/src/lib/services/ca-activity": { buildSubjectCAProgress: caCalculator, upsertCAActivityScore: async (input, tx) => { tx.pending.saved.push(input); return { changed: true, score: { id: 1, studentId: input.studentId } }; }, syncComputedCARecord: async (input, tx) => { if (options.totalFail) throw new Error("Invalid computed total"); tx.pending.totals.push(input); } },
  });
  return { ...service, recordCAActivityScores: (input) => service.recordCAActivityScores(input, now), state, input: { schoolId: "school-a", teacherId: "t", activityId: 1, rows: [{ studentId: "s", rawScore: 0 }] } };
}
test("CA score batches save scores, totals, audit and lock atomically without inherited transfer duties", async () => {
  const f = caFixture(); await f.recordCAActivityScores(f.input);
  assert.equal(f.state.saved.length, 1); assert.equal(f.state.saved[0].rawScore, 0);
  assert.equal(f.state.totals.length, 1); assert.equal(f.state.locked, true); assert.equal(f.state.audits.length, 1);
});
test("failed CA audit, totals, competing lock, report lock or scope leaves no partial scores", async () => {
  for (const options of [{ auditFail: true }, { totalFail: true }, { race: true }, { published: true }, { locked: true }, { wrongScope: true }]) {
    const f = caFixture(options); await assert.rejects(f.recordCAActivityScores(f.input));
    assert.equal(f.state.saved.length, 0); assert.equal(f.state.totals.length, 0); assert.equal(f.state.locked, false); assert.equal(f.state.audits.length, 0);
  }
  for (const rows of [[{ studentId: "transfer", rawScore: 1 }], [{ studentId: "s", rawScore: 90 }], [{ studentId: "s", rawScore: NaN }], [{ studentId: "s", rawScore: 0 }, { studentId: "s", rawScore: 0 }]]) {
    const f = caFixture(); await assert.rejects(f.recordCAActivityScores({ ...f.input, rows })); assert.equal(f.state.saved.length, 0);
  }
});

test("CA writes independently recheck lesson window, school clock and allocation inside the transaction", async () => {
  for (const options of [{ closedWindow: true }, { noPolicy: true }, { timezone: "America/New_York" }, { timezone: "Bad/Zone" }, { allocation: 40 }, { allocation: -1 }]) {
    const f = caFixture(options);
    await assert.rejects(f.recordCAActivityScores(f.input));
    assert.equal(f.state.saved.length, 0);
    assert.equal(f.state.audits.length, 0);
    assert.equal(f.state.locked, false);
  }
});
