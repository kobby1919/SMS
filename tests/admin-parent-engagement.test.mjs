import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const nodeRequire = createRequire(import.meta.url);
const now = new Date("2026-10-16T16:00:00Z");
class FixedDate extends Date { constructor(value) { super(value === undefined ? now.getTime() : value); } }
function load(path, mocks) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", "Date", code)((id) => { if (Object.hasOwn(mocks, id)) return mocks[id]; if (id === "server-only") return {}; if (!id.startsWith("@/")) return nodeRequire(id); const file = id.slice(2); return load(existsSync(file) ? file : `${file}.ts`, mocks); }, loaded, loaded.exports, FixedDate);
  return loaded.exports;
}
function fixture(options = {}) {
  const calls = { auth: 0, transactions: 0, queries: [] };
  const parent = (id) => ({ id, schoolId: "school-a", email: "private-parent@gmail.com", phone: "0241234567", notificationPreference: null, _count: { studentRelationships: id === "p1" ? 1 : 0 } });
  const data = {
    students: [{ id: "s1", parentId: "p1" }, { id: "s2", parentId: "p2" }],
    parents: [parent("p1"), parent("p2")],
    relationships: [{ schoolId: "school-a", studentId: "s1", parentId: "p1", status: "ACTIVE", canViewFees: true, canViewReports: true, canMessageSchool: true }],
    invites: [{ acceptedParentId: "p1", acceptedBy: "p1" }],
    requests: [{ parentId: "p1", studentId: "s1", status: "ACKNOWLEDGED", priority: "HIGH", lastParentMessageAt: new Date("2026-10-16T12:00:00Z"), lastTeacherResponseAt: null, respondedAt: null, responseDueAt: new Date("2026-10-16T15:00:00Z") }],
    summaries: [{ id: "n1", schoolId: "school-a", parentId: "p1", sourceModel: "ParentWeeklySummary", sourceKey: "weekly-summary:p1:2026-10-12:2026-10-18" }],
    notifications: [{ schoolId: "school-a", sourceId: "n1", recipientId: "p1", deliveries: [{ id: "d1", schoolId: "school-a", channel: "EMAIL", status: "DELIVERED", providerMessageId: "private-provider-id", sentAt: new Date("2026-10-16T15:20:00Z"), deliveredAt: new Date("2026-10-16T15:25:00Z"), updatedAt: new Date("2026-10-16T15:30:00Z") }] }],
    ...options.data,
  };
  const db = {};
  let inTransaction = false;
  const query = (name, result) => async (q) => { assert.ok(inTransaction); assert.equal(q.where.schoolId, "school-a"); calls.queries.push({ name, q }); return typeof result === "function" ? result() : result; };
  for (const [model, key] of [["student", "students"], ["parent", "parents"], ["parentStudentRelationship", "relationships"], ["parentInvite", "invites"], ["parentTeacherContactRequest", "requests"], ["parentNotification", "summaries"], ["appNotification", "notifications"]]) db[model] = { count: query(`${model}.count`, () => options.counts?.[model] ?? data[key].length), findMany: query(`${model}.findMany`, () => data[key]) };
  db.appNotificationDelivery = { count: query("delivery.count", () => options.deliveryCount ?? data.notifications.flatMap((row) => row.deliveries).length) };
  db.schoolNotificationSetting = { findUnique: query("summary-setting", options.missingSettings ? null : { timezone: "Africa/Accra", summaryCadence: options.disabled ? "OFF" : "WEEKLY", weeklySummarySendDay: "FRIDAY", weeklySummarySendTime: "15:15", emailEnabled: true }) };
  db.appNotificationSetting = { findUnique: query("app-setting", options.missingSettings ? null : { emailEnabled: true, sendParentSummariesByEmail: true }) };
  db.schoolCommunicationPolicy = { findUnique: query("policy", options.missingPolicy ? null : { enabled: !options.disabled, allowParentTeacherMessaging: !options.disabled }) };
  db.appNotificationPreference = { findMany: query("preferences", options.appPreferences ?? []) };
  const mocks = {
    "@/src/lib/authz": { requireRole: async (roles) => { calls.auth++; assert.deepEqual(roles, ["admin"]); if (options.denied) throw new Error("Forbidden"); return { schoolId: "school-a" }; } },
    "@/src/lib/prisma": { $transaction: async (work, config) => { calls.transactions++; assert.equal(calls.auth, 1); assert.equal(config.isolationLevel, "RepeatableRead"); if (options.failure) throw options.failure; inTransaction = true; try { return await work(db); } finally { inTransaction = false; } } },
  };
  return { run: load("src/lib/services/admin-parent-engagement.ts", mocks).getAdminParentEngagementSnapshot, calls, data };
}
test("snapshot authenticates first, ignores caller tenant and keeps every read in one scoped transaction", async () => {
  const f = fixture();
  const result = await f.run({ schoolId: "school-b" });
  assert.equal(result.state, "AVAILABLE");
  assert.equal(f.calls.transactions, 1);
  assert.deepEqual(result.cohort, { students: 2, parents: 2 });
  assert.equal(result.summaries.delivered, 1);
  assert.equal(result.requests.awaitingResponse, 1);
  assert.equal(result.requests.overdue, 1);
  assert.equal(result.contacts.studentsWithUnknownPortal, 1);
  assert.equal(JSON.stringify(result).includes("private-parent"), false);
  assert.equal(JSON.stringify(result).includes("private-provider-id"), false);
});
test("non-admin rejection never starts any database read", async () => {
  const f = fixture({ denied: true });
  await assert.rejects(f.run(), /Forbidden/);
  assert.equal(f.calls.transactions, 0);
  assert.equal(f.calls.queries.length, 0);
});
test("disabled messaging does not erase outstanding requests and missing setup does not fabricate summary totals", async () => {
  const disabled = await fixture({ disabled: true }).run();
  assert.equal(disabled.newMessagingState, "DISABLED");
  assert.equal(disabled.schedule.state, "DISABLED");
  assert.equal(disabled.summaries, null);
  assert.equal(disabled.requests.awaitingResponse, 1);
  const missing = await fixture({ missingSettings: true, missingPolicy: true }).run();
  assert.equal(missing.newMessagingState, "SETUP_REQUIRED");
  assert.equal(missing.schedule.state, "SETUP_REQUIRED");
  assert.equal(missing.deliverySettingsState, "SETUP_REQUIRED");
  assert.equal(missing.summaries, null);
});
test("revoked guardian access cannot be revived by legacy Student.parentId", async () => {
  const f = fixture();
  f.data.relationships[0].status = "REVOKED";
  f.data.summaries = [];
  f.data.notifications = [];
  const result = await f.run();
  assert.equal(result.cohort.parents, 1);
  assert.equal(result.contacts.studentsWithoutActiveGuardian, 1);
  assert.equal(result.requests.awaitingResponse, 0);
});
test("cross-school preference/relationship and wrong-recipient bridge evidence fail without partial totals", async () => {
  for (const corrupt of ["preference", "relationship", "recipient"]) {
    const f = fixture();
    if (corrupt === "preference") f.data.parents[0].notificationPreference = { schoolId: "school-b" };
    if (corrupt === "relationship") f.data.relationships[0].parentId = "foreign-parent";
    if (corrupt === "recipient") f.data.notifications[0].recipientId = "p2";
    const result = await f.run();
    assert.equal(result.code, "EVIDENCE_INCONSISTENT");
    assert.equal(result.cohort, null);
    assert.equal(result.summaries, null);
  }
});
test("legacy summary with no central bridge is unavailable, not proof email was never queued", async () => {
  const f = fixture(); f.data.notifications = [];
  const result = await f.run();
  assert.equal(result.summaries.summariesAvailable, 1);
  assert.equal(result.summaries.unavailable, 1);
  assert.equal(result.summaries.notQueued, 0);
});
test("opt-outs do not erase actual historical delivery evidence", async () => {
  const f = fixture({ appPreferences: [{ schoolId: "school-a", recipientId: "p1", emailEnabled: false }] });
  f.data.parents[0].notificationPreference = { schoolId: "school-a", weeklySummaryEnabled: false, emailEnabled: false };
  const result = await f.run();
  assert.equal(result.preferences.weeklyOptOut, 1);
  assert.equal(result.preferences.emailOptOut, 1);
  assert.equal(result.summaries.delivered, 1);
});
test("accepted invite must bind the exact account, not just a reused email", async () => {
  const f = fixture(); f.data.invites[0].acceptedBy = "different-account";
  assert.equal((await f.run()).contacts.studentsWithUnknownPortal, 2);
});
test("oversized histories never return truncated healthy totals", async () => {
  for (const model of ["student", "parent", "parentStudentRelationship", "parentTeacherContactRequest", "parentInvite", "parentNotification", "appNotification"]) {
    const result = await fixture({ counts: { [model]: 1000000 } }).run();
    assert.equal(result.code, "EVALUATION_LIMIT");
    assert.equal(result.requests, null);
  }
  assert.equal((await fixture({ deliveryCount: 1000000 }).run()).code, "EVALUATION_LIMIT");
});
test("known database interruption is unavailable without details; unknown failures are not disguised", async () => {
  const failure = Object.assign(new Error("PRIVATE connection details"), { code: "P1001" });
  const result = await fixture({ failure }).run();
  assert.equal(result.code, "DATABASE_UNAVAILABLE");
  assert.equal(JSON.stringify(result).includes("PRIVATE"), false);
  await assert.rejects(fixture({ failure: new Error("Unexpected bug") }).run(), /Unexpected bug/);
});
test("wrong-period summaries and foreign delivery evidence are not silently counted", async () => {
  for (const type of ["period", "delivery"]) {
    const f = fixture();
    if (type === "period") f.data.summaries[0].sourceKey = "weekly-summary:p1:2026-10-05:2026-10-11";
    else f.data.notifications[0].deliveries[0].schoolId = "school-b";
    assert.equal((await f.run()).code, "EVIDENCE_INCONSISTENT");
  }
});
test("same-snapshot count/read disagreement refuses partial results", async () => {
  for (const counts of [{ student: 3 }, { parentInvite: 2 }, { parentNotification: 2 }, { appNotification: 2 }]) assert.equal((await fixture({ counts }).run()).code, "EVIDENCE_INCONSISTENT");
  assert.equal((await fixture({ deliveryCount: 2 }).run()).code, "EVIDENCE_INCONSISTENT");
});
test("empty active cohort is a useful empty result without importing old guardians or summaries", async () => {
  const result = await fixture({ data: { students: [], parents: [], relationships: [], requests: [], invites: [], summaries: [], notifications: [] } }).run();
  assert.equal(result.state, "AVAILABLE");
  assert.deepEqual(result.cohort, { students: 0, parents: 0 });
  assert.equal(result.summaries.summariesAvailable, 0);
  assert.equal(result.requests.awaitingResponse, 0);
});
