import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const nodeRequire = createRequire(import.meta.url);
function load(path, mocks = {}, extra = "") {
  const loadedModule = { exports: {} };
  const source = readFileSync(path, "utf8") + extra;
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : id === "server-only" ? {} : id.startsWith("@/") ? load(`${id.slice(2)}.ts`, mocks) : nodeRequire(id);
  new Function("require", "module", "exports", code)(require, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const now = new Date("2026-10-08T12:00:00Z");
const duty = { id: "duty-1", schoolId: "school-a", teacherId: "teacher-a", type: "ATTENDANCE", sourceModel: "Lesson", sourceId: "1", sourceKey: "attendance:2026-10-08:lesson:1", title: "Mark attendance", status: "PENDING", priority: "NORMAL", expectedAt: new Date("2026-10-08T10:00:00Z"), completedAt: null, updatedAt: now, metadata: { date: "2026-10-08", reminderAt: "2026-10-08T10:00:00Z", missedAt: "2026-10-08T10:30:00Z" } };

function storeFixture(overrides = {}) {
  let row = overrides.row ?? null;
  const audits = [], skips = [], writes = [];
  const tx = {
    teacher: { findFirst: async () => overrides.inactive ? null : { id: duty.teacherId } },
    teacherObligation: {
      findUnique: async () => row,
      createMany: async ({ data, skipDuplicates }) => { writes.push("create"); assert.equal(skipDuplicates, true); if (row) return { count: 0 }; row = { ...duty, ...data[0] }; return { count: 1 }; },
      findUniqueOrThrow: async ({ where }) => { assert.equal(where.schoolId_teacherId_sourceKey.schoolId, duty.schoolId); return row; },
      update: async ({ data }) => { writes.push("update"); row = { ...row, ...data }; return row; },
    },
    teacherEscalation: { findFirst: async () => overrides.closed ? { id: "closed" } : null },
    teacherReminder: { updateMany: async (q) => { skips.push(q); return { count: 1 }; } },
    teacherAccountabilityAuditLog: { create: async (q) => { audits.push(q.data); return q.data; } },
  };
  const service = load("src/lib/services/teacher-obligation-store.ts", { "@/src/lib/prisma": { $transaction: async (work, options) => { assert.equal(options.isolationLevel, "Serializable"); return work(tx); } } });
  return { service, audits, skips, writes, get row() { return row; } };
}

test("synchronization creates one duty and one creation audit across retries", async () => {
  const f = storeFixture();
  await f.service.saveTeacherObligation(duty);
  await f.service.saveTeacherObligation(duty);
  assert.equal(f.audits.length, 1);
  assert.equal(f.audits[0].action, "OBLIGATION_CREATED");
});
test("completed, cancelled and closed-reviewed duties cannot reopen", async () => {
  for (const overrides of [{ row: { ...duty, status: "COMPLETED", completedAt: now } }, { row: { ...duty, status: "CANCELLED" } }, { row: { ...duty, status: "ESCALATED" }, closed: true }]) {
    const f = storeFixture(overrides);
    await f.service.saveTeacherObligation({ ...duty, status: "MISSED" });
    assert.equal(f.row.status, overrides.row.status);
    assert.equal(f.audits.length, 0);
  }
});
test("completion skips pending reminders and keeps the status audit atomic", async () => {
  const f = storeFixture({ row: { ...duty, status: "ESCALATED" } });
  await f.service.saveTeacherObligation({ ...duty, status: "COMPLETED_LATE", completedAt: now });
  assert.equal(f.row.status, "COMPLETED_LATE");
  assert.equal(f.skips.length, 1);
  assert.equal(f.audits[0].action, "OBLIGATION_COMPLETED_LATE");
});
test("inactive teachers cannot acquire new duties", async () => {
  const f = storeFixture({ inactive: true });
  assert.equal(await f.service.saveTeacherObligation(duty), null);
  assert.equal(f.row, null);
});
test("serialization retries are bounded and unrelated failures are not swallowed", async () => {
  let attempts = 0;
  const service = load("src/lib/services/teacher-obligation-store.ts", { "@/src/lib/prisma": { $transaction: async () => { attempts++; throw Object.assign(new Error("conflict"), { code: "P2034" }); } } });
  await assert.rejects(service.accountabilityTransaction(async () => true), /conflict/);
  assert.equal(attempts, 5);
});

test("unchanged dashboard refreshes do not rewrite duties or reminders", async () => {
  const f = storeFixture({ row: { ...duty, status: "ESCALATED", priority: "HIGH" } });
  for (let i = 0; i < 3; i++) {
    await f.service.saveTeacherObligation({ ...duty, status: "MISSED", metadata: { ...duty.metadata }, expectedAt: new Date(duty.expectedAt) });
  }
  assert.deepEqual(f.writes, []);
  assert.deepEqual(f.skips, []);
  assert.equal(f.row.status, "ESCALATED");
});

test("changed duty metadata is still saved without reopening an escalation", async () => {
  const f = storeFixture({ row: { ...duty, status: "ESCALATED", priority: "HIGH" } });
  await f.service.saveTeacherObligation({ ...duty, status: "MISSED", metadata: { ...duty.metadata, attendanceCount: 1 } });
  assert.deepEqual(f.writes, ["update"]);
  assert.equal(f.row.metadata.attendanceCount, 1);
  assert.equal(f.row.status, "ESCALATED");
});

test("write conflict retries rerun the whole transaction and can recover", async () => {
  let attempts = 0;
  const service = load("src/lib/services/teacher-obligation-store.ts", {
    "@/src/lib/prisma": { $transaction: async (work) => {
      attempts++;
      if (attempts < 4) throw Object.assign(new Error("conflict"), { code: "P2034" });
      return work({ verifiedRetry: true });
    } },
  });
  assert.equal(await service.accountabilityTransaction(async (tx) => tx.verifiedRetry), true);
  assert.equal(attempts, 4);
});

test("unrelated database errors are not retried or swallowed", async () => {
  let attempts = 0;
  const failure = Object.assign(new Error("denied"), { code: "P2010" });
  const service = load("src/lib/services/teacher-obligation-store.ts", {
    "@/src/lib/prisma": { $transaction: async () => { attempts++; throw failure; } },
  });
  await assert.rejects(service.accountabilityTransaction(async () => true), (error) => error === failure);
  assert.equal(attempts, 1);
});

test("weekly dashboard catch-up does not overlap attendance synchronization writes", async () => {
  let active = 0, peak = 0, days = 0, escalated = false;
  const service = load("src/lib/services/teacher-accountability-view.ts", {
    "@/src/lib/services/teacher-obligation-store": { isAccountabilityWriteConflict: () => false },
    "@/src/lib/services/teacher-attendance-obligations": { syncAttendanceObligationsForDate: async () => {
      active++; peak = Math.max(peak, active); days++;
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
    } },
    "@/src/lib/services/teacher-ca-obligations": { syncCAActivityScorePublishingObligationsForSchool: async () => {} },
    "@/src/lib/services/teacher-homework-obligations": { syncHomeworkCheckingObligationsForSchool: async () => {} },
    "@/src/lib/services/teacher-accountability": { processTeacherWeekEscalationCatchup: async () => { escalated = true; } },
  });
  await service.prepareTeacherAccountabilityForView({ schoolId: "school-a", teacherId: "teacher-a", now: new Date("2026-10-30T12:00:00Z") });
  assert.equal(days, 5);
  assert.equal(peak, 1);
  assert.equal(escalated, true);
});

test("concurrent first loads commit one duty and one creation audit", async () => {
  let row = null, version = 0, conflicts = 0;
  const audits = [];
  const service = load("src/lib/services/teacher-obligation-store.ts", {
    "node:timers/promises": { setTimeout: async () => {} },
    "@/src/lib/prisma": { $transaction: async (work, options) => {
      assert.equal(options.isolationLevel, "Serializable");
      const readVersion = version;
      let local = row ? { ...row } : null, changed = false;
      const pendingAudits = [];
      const tx = {
        teacher: { findFirst: async () => ({ id: duty.teacherId }) },
        teacherObligation: {
          findUnique: async () => local,
          createMany: async ({ data }) => { changed = true; local = { ...duty, ...data[0] }; return { count: 1 }; },
          findUniqueOrThrow: async () => local,
          update: async ({ data }) => { changed = true; local = { ...local, ...data }; return local; },
        },
        teacherEscalation: { findFirst: async () => null },
        teacherReminder: { updateMany: async () => ({ count: 0 }) },
        teacherAccountabilityAuditLog: { create: async ({ data }) => { pendingAudits.push(data); return data; } },
      };
      const result = await work(tx);
      await new Promise((resolve) => setImmediate(resolve));
      if (changed && version !== readVersion) {
        conflicts++;
        throw Object.assign(new Error("serialization conflict"), { code: "P2034" });
      }
      if (changed) { row = local; audits.push(...pendingAudits); version++; }
      return result;
    } },
  });
  const results = await Promise.all(Array.from({ length: 10 }, () => service.saveTeacherObligation({ ...duty })));
  assert.equal(results.length, 10);
  assert.equal(conflicts, 9);
  assert.equal(version, 1);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "OBLIGATION_CREATED");
  assert.equal(row.status, "PENDING");
});

test("retries wait outside transactions with bounded exponential backoff", async () => {
  const pauses = [];
  let attempts = 0, transactionActive = false;
  const service = load("src/lib/services/teacher-obligation-store.ts", {
    "node:timers/promises": { setTimeout: async (ms) => { assert.equal(transactionActive, false); pauses.push(ms); } },
    "@/src/lib/prisma": { $transaction: async () => {
      attempts++; transactionActive = true;
      try { throw Object.assign(new Error("conflict"), { code: "P2034" }); }
      finally { transactionActive = false; }
    } },
  });
  await assert.rejects(service.accountabilityTransaction(async () => true), /conflict/);
  assert.equal(attempts, 5);
  assert.equal(pauses.length, 4);
  pauses.forEach((ms, index) => assert.ok(ms >= 50 * 2 ** index && ms < 50 * 2 ** index + 50));
});

test("a retry rereads a duty completed by a competing request instead of overwriting it", async () => {
  let attempts = 0, updates = 0;
  const completed = { ...duty, status: "COMPLETED", completedAt: now };
  const service = load("src/lib/services/teacher-obligation-store.ts", {
    "node:timers/promises": { setTimeout: async () => {} },
    "@/src/lib/prisma": { $transaction: async (work) => {
      attempts++;
      if (attempts === 1) throw Object.assign(new Error("conflict"), { code: "P2034" });
      return work({
        teacher: { findFirst: async () => ({ id: duty.teacherId }) },
        teacherObligation: { findUnique: async () => completed, update: async () => { updates++; } },
      });
    } },
  });
  assert.equal(await service.saveTeacherObligation({ ...duty, status: "MISSED" }), completed);
  assert.equal(attempts, 2);
  assert.equal(updates, 0);
});

function viewFixture(failure) {
  const store = load("src/lib/services/teacher-obligation-store.ts", { "@/src/lib/prisma": {} });
  return load("src/lib/services/teacher-accountability-view.ts", {
    "@/src/lib/services/teacher-obligation-store": store,
    "@/src/lib/services/teacher-attendance-obligations": { syncAttendanceObligationsForDate: async () => { if (failure) throw failure; } },
    "@/src/lib/services/teacher-ca-obligations": { syncCAActivityScorePublishingObligationsForSchool: async () => {} },
    "@/src/lib/services/teacher-homework-obligations": { syncHomeworkCheckingObligationsForSchool: async () => {} },
    "@/src/lib/services/teacher-accountability": { processTeacherWeekEscalationCatchup: async () => {} },
  });
}

test("exhausted write conflicts yield an explicit busy state without leaking personal data", async (t) => {
  const warning = t.mock.method(console, "warn", () => {});
  const service = viewFixture(Object.assign(new Error("private database detail"), { code: "P2034" }));
  assert.equal(await service.prepareTeacherAccountabilityForView({ schoolId: "school-a", teacherId: "teacher-a", now }), false);
  assert.deepEqual(warning.mock.calls[0].arguments, ["TEACHER_ACCOUNTABILITY_SYNC_BUSY", { code: "P2034" }]);
});

test("successful synchronization reports ready; other errors never become a busy state", async () => {
  const input = { schoolId: "school-a", teacherId: "teacher-a", now };
  assert.equal(await viewFixture().prepareTeacherAccountabilityForView(input), true);
  for (const failure of [new Error("unexpected"), Object.assign(new Error("denied"), { code: "P2010" }), Object.assign(new Error("timeout"), { code: "P2028" })]) {
    await assert.rejects(viewFixture(failure).prepareTeacherAccountabilityForView(input), (error) => error === failure);
  }
});

test("both teacher pages require authentication and withhold duty controls while synchronization is busy", () => {
  for (const path of ["src/app/(dashboard)/teacher/page.tsx", "src/app/(dashboard)/teacher/accountability/page.tsx"]) {
    const page = readFileSync(path, "utf8");
    assert.ok(page.indexOf('requirePageSession(["teacher"])') < page.indexOf("const accountabilityReady ="));
    assert.ok(page.includes("if (!accountabilityReady) return <TeacherAccountabilityBusy"));
    assert.ok(page.indexOf("if (!accountabilityReady)") < page.indexOf("const [", page.indexOf("const accountabilityReady =")));
  }
  const Busy = load("src/components/TeacherAccountabilityBusy.tsx").default;
  const markup = renderToStaticMarkup(React.createElement(Busy, { href: "/teacher" }));
  assert.match(markup, /Your duties are updating/);
  assert.match(markup, /href="\/teacher"/);
  assert.doesNotMatch(markup, /All.*duties.*clear|100%|<form/);
});

test("navbar and page share a sync with primitive tenant keys, but new requests resynchronize", async () => {
  let requestCache = new Map();
  const synced = [];
  const service = load("src/lib/services/teacher-accountability-view.ts", {
    react: { cache: (work) => (...args) => {
      assert.ok(args.every((arg) => typeof arg === "string"));
      const key = JSON.stringify(args);
      if (!requestCache.has(key)) requestCache.set(key, work(...args));
      return requestCache.get(key);
    } },
    "@/src/lib/services/teacher-obligation-store": { isAccountabilityWriteConflict: () => false },
    "@/src/lib/services/teacher-attendance-obligations": { syncAttendanceObligationsForDate: async () => {} },
    "@/src/lib/services/teacher-ca-obligations": { syncCAActivityScorePublishingObligationsForSchool: async ({ schoolId, teacherId }) => { synced.push([schoolId, teacherId]); } },
    "@/src/lib/services/teacher-homework-obligations": { syncHomeworkCheckingObligationsForSchool: async () => {} },
    "@/src/lib/services/teacher-accountability": { processTeacherWeekEscalationCatchup: async () => {} },
  });
  await Promise.all([
    service.prepareTeacherAccountabilityForView({ schoolId: "school-a", teacherId: "teacher-a" }),
    service.prepareTeacherAccountabilityForView({ schoolId: "school-a", teacherId: "teacher-a" }),
    service.prepareTeacherAccountabilityForView({ schoolId: "school-a", teacherId: "teacher-b" }),
    service.prepareTeacherAccountabilityForView({ schoolId: "school-b", teacherId: "teacher-a" }),
  ]);
  assert.equal(synced.length, 3);
  requestCache = new Map();
  await service.prepareTeacherAccountabilityForView({ schoolId: "school-a", teacherId: "teacher-a" });
  assert.equal(synced.length, 4);
  const page = readFileSync("src/app/(dashboard)/teacher/page.tsx", "utf8");
  const preparation = page.slice(page.indexOf("const accountabilityReady ="), page.indexOf("if (!accountabilityReady)"));
  assert.doesNotMatch(preparation, /now:/);
  const navbar = readFileSync("src/components/Navbar.tsx", "utf8");
  assert.match(navbar, /if \(accountabilityReady\) \{[\s\S]*?syncTeacherAlertsToAppNotifications/);
});
test("only one competing correction reviewer can claim a pending request", async () => {
  const service = storeFixture().service;
  let pending = true;
  const tx = { teacherCorrectionRequest: { updateMany: async (q) => {
    assert.equal(q.where.schoolId, duty.schoolId); assert.equal(q.where.teacherId, duty.teacherId); assert.equal(q.where.status, "PENDING");
    const count = pending ? 1 : 0; pending = false; return { count };
  } } };
  const input = { id: "correction", schoolId: duty.schoolId, teacherId: duty.teacherId, action: "APPROVE", reviewerId: "admin", at: now, note: "Reviewed" };
  const results = await Promise.allSettled([service.claimTeacherCorrectionReview(tx, input), service.claimTeacherCorrectionReview(tx, { ...input, action: "REJECT" })]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
});

function workerFixture(overrides = {}) {
  const row = { ...duty, ...overrides.duty };
  const audits = [], escalations = [], reminders = [];
  const tx = {
    teacherObligation: {
      findFirst: async (q) => { assert.equal(q.where.teacher.schoolId, duty.schoolId); assert.equal(q.where.teacher.status, "ACTIVE"); assert.deepEqual(q.where.escalations, { none: {} }); return ["PENDING", "MISSED"].includes(row.status) && !row.completedAt && !overrides.closed ? { ...row } : null; },
      updateMany: async (q) => { if (!q.where.status.in.includes(row.status) || row.completedAt) return { count: 0 }; Object.assign(row, q.data); return { count: 1 }; },
    },
    publishedTimetableLesson: { findFirst: async (q) => { assert.equal(q.where.schoolId, duty.schoolId); assert.equal(q.where.publication.schoolId, duty.schoolId); return overrides.unpublished ? null : { teacherId: duty.teacherId, classId: 1, day: "THURSDAY", startTime: new Date("2000-01-01T09:00:00Z"), publication: { publishedAt: overrides.publishedAt ?? new Date("2026-10-01T00:00:00Z") } }; } },
    schoolNotificationSetting: { findUnique: async () => ({ activeDays: overrides.activeDays ?? ["THURSDAY"] }) },
    attendance: { findMany: async () => overrides.marks ?? [] },
    cAConfig: { findMany: async () => overrides.conflictingConfig ? [] : [{ academicYear: "2026/27", currentTerm: "TERM_1", classworkWeight: 30, examWeight: 70 }] },
    cAActivity: { findFirst: async () => ({ id: 1, classId: 1, subjectId: 1, activityDate: new Date("2026-10-08T09:00:00Z"), bucket: { classId: 1, subjectId: 1 }, scores: overrides.marks ?? [] }) },
    student: { findMany: async (q) => { assert.equal(q.where.status, "ACTIVE"); assert.equal(q.where.schoolId, duty.schoolId); assert.equal(q.where.classId, 1); assert.ok(q.where.createdAt.lte); return (overrides.students ?? [{ id: "s1" }]).map((s) => ({ createdAt: new Date("2026-09-01T00:00:00Z"), ...s })); } },
    teacherEscalation: { create: async ({ data }) => { escalations.push(data); return data; } },
    teacherReminder: {
      updateMany: async () => ({ count: 1 }),
      createMany: async ({ data }) => { if (reminders.length) return { count: 0 }; reminders.push({ id: "reminder", ...data[0] }); return { count: 1 }; },
      findUniqueOrThrow: async () => reminders[0],
    },
    teacherAccountabilityAuditLog: { create: async ({ data }) => { audits.push(data); return data; } },
  };
  const mocks = {
    "@/src/lib/prisma": {}, "@/src/lib/services/teacher-attendance-obligations": {}, "@/src/lib/services/teacher-ca-obligations": {}, "@/src/lib/services/teacher-homework-obligations": {}, "@/src/lib/services/teacher-accountability-settings": {},
    "@/src/lib/services/teacher-obligation-store": { accountabilityTransaction: async (work) => work(tx) },
  };
  const service = load("src/lib/services/teacher-accountability.ts", mocks, "\nexport { actionableDuty, escalateIfNeeded, queueReminderIfNeeded };\n");
  return { service, tx, row, audits, escalations, reminders };
}

test("worker does not escalate a completed morning lesson because a pupil enrolled later", async () => {
  const f = workerFixture({ students: [{ id: "s1" }, { id: "new", createdAt: new Date("2026-10-08T11:00:00Z") }], marks: [{ studentId: "s1", updatedAt: now }] });
  assert.equal(await f.service.escalateIfNeeded({ obligation: f.row, now }), false);
  assert.equal(f.escalations.length, 0);
  assert.equal(f.row.status, "COMPLETED_LATE");
});
test("CA worker excludes transfers and later same-day admissions, just like dashboard eligibility", async () => {
  const f = workerFixture({ duty: { type: "CA_SCORE_PUBLISHING", sourceModel: "CAActivity" }, students: [{ id: "s1", classJoinedAt: new Date("2026-09-01") }, { id: "transfer", classJoinedAt: new Date("2026-10-08T11:00:00Z") }, { id: "admitted", createdAt: new Date("2026-10-08T11:00:00Z"), classJoinedAt: new Date("2026-10-08T11:00:00Z") }], marks: [{ studentId: "s1", updatedAt: now }] });
  assert.equal(await f.service.escalateIfNeeded({ obligation: f.row, now }), false);
  assert.equal(f.escalations.length, 0);
  assert.match(f.row.status, /^COMPLETED/);
});
test("later join score timestamps cannot falsely make an eligible completed CA duty late", async () => {
  const f = workerFixture({ duty: { type: "CA_SCORE_PUBLISHING", sourceModel: "CAActivity" }, students: [{ id: "s1", classJoinedAt: new Date("2026-09-01") }, { id: "transfer", classJoinedAt: new Date("2026-10-08T11:00:00Z") }], marks: [{ studentId: "s1", updatedAt: new Date("2026-10-08T09:30:00Z") }, { studentId: "transfer", updatedAt: now }] });
  assert.equal(await f.service.escalateIfNeeded({ obligation: f.row, now }), false);
  assert.equal(f.row.status, "COMPLETED");
});
test("summary overall rankings wait for every displayed subject to be canonically ready", () => {
  const Summary = load("src/components/CAClassSummary.tsx").default;
  const students = [{ id: "s1", name: "Complete", surname: "Student" }, { id: "s2", name: "Partial", surname: "Student" }];
  const subjects = [{ id: 1, name: "English" }, { id: 2, name: "Math" }];
  const base = { studentName: "", studentSurname: "Student", subjectName: "", term: "TERM_1", academicYear: "2026/27", classworkScore: 30, examScore: 60, totalScore: 90, grade: "A1", gradePoint: 1, remarks: "", reportReady: true };
  const markup = renderToStaticMarkup(React.createElement(Summary, { className: "KG1", students, subjects, caRecords: [{ ...base, id: 1, studentId: "s1", subjectId: 1 }, { ...base, id: 2, studentId: "s1", subjectId: 2 }, { ...base, id: 3, studentId: "s2", subjectId: 1 }] }));
  const start = markup.indexOf("Partial");
  const partial = markup.slice(start, markup.indexOf("</tr>", start));
  assert.match(partial, /Pending/);
  assert.doesNotMatch(partial.slice(partial.lastIndexOf("<td")), /2nd/);
});
test("worker skips completion, closed review, unpublished source and school closure", async () => {
  for (const overrides of [{ duty: { completedAt: now } }, { closed: true }, { unpublished: true }, { activeDays: ["MONDAY"] }, { students: [] }, { marks: [{ studentId: "s1" }] }, { publishedAt: now }, { duty: { sourceId: "1garbage" } }]) {
    const f = workerFixture(overrides);
    assert.equal(await f.service.escalateIfNeeded({ obligation: f.row, now }), false);
    assert.equal(f.escalations.length, 0); assert.ok(f.audits.every((row) => row.action === "OBLIGATION_CANCELLED"));
  }
});
test("duplicate marks cannot mask a missing student's attendance", async () => {
  const f = workerFixture({ students: [{ id: "s1" }, { id: "s2" }], marks: [{ studentId: "s1" }, { studentId: "s1" }, { studentId: "another-class" }] });
  assert.ok(await f.service.actionableDuty(f.tx, f.row));
});
test("competing workers create a single escalation with a single audit", async () => {
  const f = workerFixture();
  const result = await Promise.all([f.service.escalateIfNeeded({ obligation: { ...f.row }, now }), f.service.escalateIfNeeded({ obligation: { ...f.row }, now })]);
  assert.equal(result.filter(Boolean).length, 1);
  assert.equal(f.escalations.length, 1); assert.equal(f.audits.length, 1);
});
test("reminder retries deduplicate both the reminder and its audit", async () => {
  const f = workerFixture();
  await f.service.queueReminderIfNeeded({ obligation: f.row, now });
  await f.service.queueReminderIfNeeded({ obligation: f.row, now });
  assert.equal(f.reminders.length, 1); assert.equal(f.audits.length, 1);
});
test("escalation begins strictly after the final allowed marking instant", async () => {
  const f = workerFixture();
  assert.equal(await f.service.escalateIfNeeded({ obligation: f.row, now: new Date(f.row.metadata.missedAt) }), false);
});
test("actual completedAt overrides stale escalated status in teacher views", () => {
  const { effectiveObligationStatus } = load("src/lib/queries/teacher-accountability-status.ts");
  assert.equal(effectiveObligationStatus({ ...duty, status: "ESCALATED", completedAt: now }, now), "COMPLETED_LATE");
  assert.equal(effectiveObligationStatus(duty, new Date(duty.metadata.missedAt)), "PENDING");
});
test("every admin menu destination exists, has a unique job and excludes operational workspaces", () => {
  const menu = load("src/components/MenuClient.tsx", {
    "next/navigation": { usePathname: () => "/admin/accountability-settings" },
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
  }).default;
  const html = renderToStaticMarkup(React.createElement(menu, { role: "admin" }));
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(hrefs).size, hrefs.length);
  for (const href of hrefs) assert.ok(existsSync(`src/app/(dashboard)${href.split("?")[0]}/page.tsx`), href);
  for (const href of ["/bursar", "/collector", "/list/exams", "/list/results", "/list/finance/reports", "/list/attendance/take", "/admin/data-migration"]) assert.ok(!hrefs.includes(href), href);
  assert.ok(hrefs.includes("/admin/accountability/follow-up"));
  assert.ok(hrefs.includes("/list/ca?view=summary"));
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
  for (const href of ["/list/events", "/list/announcements", "/admin/communications", "/admin/communication-policy", "/admin/notification-settings", "/admin/notifications"]) assert.ok(hrefs.includes(href));
});
test("admin entry bypasses are blocked by server guards, not menu hiding alone", () => {
  assert.match(readFileSync("src/app/(dashboard)/list/attendance/take/page.tsx", "utf8"), /requirePageSession\(\["teacher"\]\)/);
  const api = readFileSync("src/app/api/attendance/route.ts", "utf8");
  assert.match(api.slice(api.indexOf("export async function POST"), api.indexOf("export async function DELETE")), /requireRole\(\["teacher"\]\)/);
  assert.match(readFileSync("src/app/(dashboard)/list/ca/page.tsx", "utf8"), /role === "admin"\) return <AdminAssessmentReview/);
  const actions = readFileSync("src/lib/actions/actions.ts", "utf8");
  for (const name of ["createResult", "updateResult", "deleteResult"]) assert.match(actions.slice(actions.indexOf(`export async function ${name}`), actions.indexOf(`export async function ${name}`) + 400), /requireRole\(\["teacher"\]\)/);
});

test("legacy CA writes validate the roster and cannot disguise a different assessment or delete history", () => {
  const actions = readFileSync("src/lib/actions/caActions.ts", "utf8");
  const service = readFileSync("src/lib/services/exam-recording.ts", "utf8");
  assert.match(service, /schoolId, classId, status: "ACTIVE"/);
  assert.match(service, /isolationLevel: "Serializable"/);
  assert.match(service, /examEntryState/);
  for (const name of ["createCA", "updateCA"]) {
    const start = actions.indexOf(`export async function ${name}`);
    assert.match(actions.slice(start, actions.indexOf("\nexport async function", start + 1)), /await bulkUpsertCA/);
  }
  const update = actions.slice(actions.indexOf("export async function updateCA"), actions.indexOf("export async function deleteCA"));
  assert.match(update, /schoolId, studentId: parsed.studentId/);
  assert.match(update, /subjectId: parsed.subjectId/);
  assert.match(service, /Saved exam scores, including zero, can only change through the correction workflow/);
  assert.match(actions.slice(actions.indexOf("export async function bulkUpsertCA"), actions.indexOf("export async function createCABucketAction")), /await recordExamScores/);
  const deletion = actions.slice(actions.indexOf("export async function deleteCA"), actions.indexOf("export type BulkCARow"));
  assert.match(deletion, /history cannot be deleted/);
  assert.doesNotMatch(deletion, /continuousAssessment.delete/);
});
