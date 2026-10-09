import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const nodeRequire = createRequire(import.meta.url);
function load(path, mocks = {}, extra = "") {
  const module = { exports: {} };
  const source = readFileSync(path, "utf8") + extra;
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : id === "server-only" ? {} : id.startsWith("@/") ? load(`${id.slice(2)}.ts`, mocks) : nodeRequire(id);
  new Function("require", "module", "exports", code)(require, module, module.exports);
  return module.exports;
}
const now = new Date("2026-10-08T12:00:00Z");
const duty = { id: "duty-1", schoolId: "school-a", teacherId: "teacher-a", type: "ATTENDANCE", sourceModel: "Lesson", sourceId: "1", sourceKey: "attendance:2026-10-08:lesson:1", title: "Mark attendance", status: "PENDING", priority: "NORMAL", expectedAt: new Date("2026-10-08T10:00:00Z"), completedAt: null, updatedAt: now, metadata: { date: "2026-10-08", reminderAt: "2026-10-08T10:00:00Z", missedAt: "2026-10-08T10:30:00Z" } };

function storeFixture(overrides = {}) {
  let row = overrides.row ?? null;
  const audits = [], skips = [];
  const tx = {
    teacher: { findFirst: async () => overrides.inactive ? null : { id: duty.teacherId } },
    teacherObligation: {
      createMany: async ({ data, skipDuplicates }) => { assert.equal(skipDuplicates, true); if (row) return { count: 0 }; row = { ...duty, ...data[0] }; return { count: 1 }; },
      findUniqueOrThrow: async ({ where }) => { assert.equal(where.schoolId_teacherId_sourceKey.schoolId, duty.schoolId); return row; },
      update: async ({ data }) => { row = { ...row, ...data }; return row; },
    },
    teacherEscalation: { findFirst: async () => overrides.closed ? { id: "closed" } : null },
    teacherReminder: { updateMany: async (q) => { skips.push(q); return { count: 1 }; } },
    teacherAccountabilityAuditLog: { create: async (q) => { audits.push(q.data); return q.data; } },
  };
  const service = load("src/lib/services/teacher-obligation-store.ts", { "@/src/lib/prisma": { $transaction: async (work, options) => { assert.equal(options.isolationLevel, "Serializable"); return work(tx); } } });
  return { service, audits, skips, get row() { return row; } };
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
  assert.equal(attempts, 3);
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
    student: { findMany: async (q) => { assert.equal(q.where.status, "ACTIVE"); assert.equal(q.where.schoolId, duty.schoolId); assert.equal(q.where.classId, 1); assert.ok(q.where.createdAt.lte); return overrides.students ?? [{ id: "s1" }]; } },
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
  const roster = actions.slice(actions.indexOf("async function assertCAStudents"), actions.indexOf("async function assertTeacherUsesActivePeriod"));
  assert.match(roster, /schoolId, classId, status: "ACTIVE"/);
  for (const name of ["createCA", "updateCA", "bulkUpsertCA"]) {
    const start = actions.indexOf(`export async function ${name}`);
    assert.match(actions.slice(start, actions.indexOf("\nexport async function", start + 1)), /await assertCAStudents/);
  }
  const update = actions.slice(actions.indexOf("export async function updateCA"), actions.indexOf("export async function deleteCA"));
  assert.match(update, /teacherId, studentId: parsed.studentId/);
  assert.match(update, /subjectId: parsed.subjectId/);
  assert.match(update, /Saved exam scores require an approved correction request/);
  const deletion = actions.slice(actions.indexOf("export async function deleteCA"), actions.indexOf("export type BulkCARow"));
  assert.match(deletion, /history cannot be deleted/);
  assert.doesNotMatch(deletion, /continuousAssessment.delete/);
});
