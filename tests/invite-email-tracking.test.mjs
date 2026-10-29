import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash, createHmac } from "node:crypto";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, modules = {}, globals = {}) {
  const exports = {};
  new Function("exports", "require", ...Object.keys(globals), ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(exports, (id) => id in modules ? modules[id] : require(id), ...Object.values(globals));
  return exports;
}
const clone = (value) => JSON.parse(JSON.stringify(value));
function matches(row, where = {}) {
  if (where.schoolId && row.schoolId !== where.schoolId) return false;
  if (where.inviteId && row.inviteId !== where.inviteId) return false;
  if (where.action && row.action !== where.action) return false;
  if (where.AND && !where.AND.every((filter) => matches(row, filter))) return false;
  if (where.OR && !where.OR.some((filter) => matches(row, filter))) return false;
  if (where.metadata) {
    const value = where.metadata.path?.reduce((value, part) => value?.[part], row.metadata) ?? row.metadata;
    if (JSON.stringify(value) !== JSON.stringify(where.metadata.equals)) return false;
  }
  return true;
}
function fixture() {
  const logs = {};
  const queries = [];
  let conflict = false;
  const db = {};
  const hash = createHash("sha256").update("PRIVATE-TOKEN").digest("hex");
  for (const [kind, model, audit] of [["TEACHER", "teacherInvite", "teacherInviteAuditLog"], ["PARENT", "parentInvite", "parentInviteAuditLog"], ["BURSAR", "bursarInvite", "bursarInviteAuditLog"], ["COLLECTOR", "collectorInvite", "collectorInviteAuditLog"], ["ADMIN", "schoolInvite", "onboardingAuditLog"]]) {
    logs[kind] = [];
    db[model] = {
      findUnique: async ({ where }) => where.tokenHash === hash ? { id: `invite-${kind}`, schoolId: "school-a", email: "recipient@example.com" } : null,
      findMany: async ({ where }) => { queries.push(where); return [{ id: `invite-${kind}`, acceptedAt: null, revokedAt: null, expiresAt: new Date("2030-01-01") }]; },
    };
    db[audit] = {
      create: async ({ data }) => { const row = { ...clone(data), createdAt: new Date() }; logs[kind].push(row); return row; },
      findFirst: async ({ where }) => clone(logs[kind].find((row) => matches(row, where)) || null),
      updateMany: async ({ where, data }) => {
        if (conflict) return { count: 0 };
        const rows = logs[kind].filter((row) => matches(row, where));
        rows.forEach((row) => { row.metadata = clone(data.metadata); });
        return { count: rows.length };
      },
      findMany: async ({ where }) => { queries.push(where); return logs[kind].filter((row) => matches(row, where)); },
    };
  }
  const tracking = load("src/lib/services/invite-email-tracking.ts", { "@/src/lib/prisma": { default: db } });
  return { tracking, logs, queries, db, conflict: () => { conflict = true; } };
}
const url = "https://example.com/onboarding/accept?token=PRIVATE-TOKEN";
function event(type, attempt, messageId = "message-one") {
  return { type, created_at: "2026-10-29T12:00:00Z", data: { email_id: messageId, to: ["recipient@example.com"], tags: { edujay_invite_attempt: attempt.attemptId } } };
}
for (const kind of ["TEACHER", "PARENT", "BURSAR", "COLLECTOR", "ADMIN"]) {
  test(`${kind}: tracks separate email attempts and terminal delivery outcomes`, async () => {
    const f = fixture();
    const first = await f.tracking.beginInviteEmail(kind, url, "recipient@example.com");
    await f.tracking.updateInviteEmail(first, "ACCEPTED", "message-one");
    await f.tracking.handleInviteEmailWebhook(event("email.delivered", first));
    await f.tracking.handleInviteEmailWebhook(event("email.sent", first));
    await f.tracking.handleInviteEmailWebhook(event("email.delivered", first));
    assert.equal(f.logs[kind][0].metadata.status, "DELIVERED");
    assert.equal(f.logs[kind][0].metadata.events.length, 2);
    await f.tracking.handleInviteEmailWebhook(event("email.bounced", first));
    await f.tracking.handleInviteEmailWebhook(event("email.delivered", first));
    assert.equal(f.logs[kind][0].metadata.status, "BOUNCED");
    const second = await f.tracking.beginInviteEmail(kind, url, "recipient@example.com");
    await f.tracking.updateInviteEmail(second, "ACCEPTED", "message-two");
    assert.equal(f.logs[kind][0].metadata.status, "BOUNCED");
    assert.equal(f.logs[kind][1].metadata.status, "ACCEPTED");
    assert.doesNotMatch(JSON.stringify(f.logs), /PRIVATE-TOKEN|tokenHash|https:\/\//);
    const rows = await f.tracking.listInviteEmailAttempts("school-a");
    assert.equal(rows.length, 2);
    assert.equal(rows[0].invitationState, "Pending acceptance");
    assert.ok(f.queries.every((where) => where.schoolId === "school-a"));
    assert.equal((await f.tracking.listInviteEmailAttempts("school-other")).length, 0);
  });
}
test("callbacks arriving before the send response bind by attempt tag without losing delivery", async () => {
  const f = fixture();
  const attempt = await f.tracking.beginInviteEmail("TEACHER", url, "recipient@example.com");
  await f.tracking.handleInviteEmailWebhook(event("email.delivered", attempt));
  await f.tracking.updateInviteEmail(attempt, "ACCEPTED", "message-one");
  assert.equal(f.logs.TEACHER[0].metadata.status, "DELIVERED");
  await assert.rejects(f.tracking.updateInviteEmail(attempt, "SENT", "wrong-id"), /does not match/);
});
test("wrong recipients, unknown tags and concurrent writes cannot overwrite a tracked attempt", async () => {
  const f = fixture();
  await assert.rejects(f.tracking.beginInviteEmail("TEACHER", url, "wrong@example.com"), /recipient/);
  const attempt = await f.tracking.beginInviteEmail("TEACHER", url, "recipient@example.com");
  const wrong = event("email.delivered", attempt);
  wrong.data.to = ["other@example.com"];
  await assert.rejects(f.tracking.handleInviteEmailWebhook(wrong), /recipient/);
  await assert.rejects(f.tracking.handleInviteEmailWebhook(event("email.delivered", { attemptId: "unknown" })), /Retry/);
  f.conflict();
  await assert.rejects(f.tracking.updateInviteEmail(attempt, "DELIVERED", "message-one"), /concurrently/);
  assert.equal(f.logs.TEACHER[0].metadata.status, "PENDING");
});
test("non-invitation events and open/click events never fabricate delivery", async () => {
  const f = fixture();
  assert.equal(await f.tracking.handleInviteEmailWebhook({ type: "email.delivered", data: { email_id: "unknown" } }), null);
  const attempt = await f.tracking.beginInviteEmail("TEACHER", url, "recipient@example.com");
  await f.tracking.handleInviteEmailWebhook(event("email.opened", attempt));
  assert.equal(f.logs.TEACHER[0].metadata.status, "PENDING");
});

for (const [name, mockResponse, expected] of [
  ["provider acceptance", { ok: true, json: async () => ({ id: "provider-id" }) }, "ACCEPTED"],
  ["provider rejection", { ok: false }, "FAILED"],
  ["network failure", new Error("PRIVATE response"), "UNKNOWN"],
  ["missing provider id", { ok: true, json: async () => ({}) }, "UNKNOWN"],
]) {
  test(`send path: ${name} records a truthful result without real email`, async () => {
    const f = fixture();
    let request;
    const notifications = load("src/lib/services/notifications.ts", { "@/src/lib/services/invite-email-tracking": f.tracking }, {
      process: { env: { RESEND_API_KEY: "unit-test-key" } }, console: { info() {} },
      fetch: async (_url, input) => { request = input; if (mockResponse instanceof Error) throw mockResponse; return mockResponse; },
    });
    const result = await notifications.sendTeacherInviteEmail({ to: "recipient@example.com", teacherName: "Test Teacher", schoolName: "Test", inviteUrl: url, expiresAt: new Date() });
    assert.equal(f.logs.TEACHER[0].metadata.status, expected);
    assert.equal(result.ok, expected === "ACCEPTED");
    assert.ok(JSON.parse(request.body).tags[0].value);
    assert.ok(request.headers["Idempotency-Key"]);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
  });
}
test("unconfigured email records Not sent and does not log the invitation token", async () => {
  const f = fixture();
  const consoleLogs = [];
  const notifications = load("src/lib/services/notifications.ts", { "@/src/lib/services/invite-email-tracking": f.tracking }, {
    process: { env: {} }, console: { info: (...args) => consoleLogs.push(args) }, fetch: () => assert.fail("Must not send"),
  });
  await notifications.sendTeacherInviteEmail({ to: "recipient@example.com", teacherName: "Test", schoolName: "Test", inviteUrl: url, expiresAt: new Date() });
  assert.equal(f.logs.TEACHER[0].metadata.status, "NOT_SENT");
  assert.doesNotMatch(JSON.stringify(consoleLogs), /PRIVATE-TOKEN/);
});
test("invitation callbacks retain the signed route boundary and signature checks", () => {
  const source = readFileSync("src/app/api/webhooks/notifications/resend/route.ts", "utf8");
  assert.ok(source.indexOf("if (!verified)") < source.indexOf("await handleResendEmailWebhook(payload)"));
  const webhooks = load("src/lib/services/notification-webhooks.ts", {
    "@/src/lib/prisma": { default: {} }, "@/src/lib/services/app-notifications": {}, "@/src/lib/services/invite-email-tracking": {},
  });
  const secret = Buffer.from("unit-test-signing-key").toString("base64");
  const body = JSON.stringify({ type: "email.delivered" });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", Buffer.from(secret, "base64")).update(`event-one.${timestamp}.${body}`).digest("base64");
  const args = { rawBody: body, svixId: "event-one", svixTimestamp: timestamp, svixSignature: `v1,${signature}`, secret };
  assert.equal(webhooks.verifyResendWebhookSignature(args), true);
  assert.equal(webhooks.verifyResendWebhookSignature({ ...args, rawBody: body + " " }), false);
  assert.equal(webhooks.verifyResendWebhookSignature({ ...args, svixTimestamp: "1" }), false);
});
test("activity pages enforce role and school scope before loading email history", () => {
  const admin = readFileSync("src/app/(dashboard)/admin/invite-emails/page.tsx", "utf8");
  const platform = readFileSync("src/app/(dashboard)/platform/invite-emails/page.tsx", "utf8");
  assert.match(admin, /requirePageSession\(\["admin"\]\)/);
  assert.match(admin, /listInviteEmailAttempts\(schoolId\)/);
  assert.match(platform, /requirePageSession\(\["platform_admin"\]\)/);
  assert.ok(platform.indexOf("requirePageSession") < platform.indexOf("prisma.school.findMany"));
});

test("shared webhook dispatch tracks invitations without changing existing app-notification routing", async () => {
  const f = fixture();
  const attempt = await f.tracking.beginInviteEmail("TEACHER", url, "recipient@example.com");
  let existingDelivery = null;
  let deliveredCalls = 0;
  f.db.appNotificationDelivery = { findFirst: async () => existingDelivery };
  const hooks = load("src/lib/services/notification-webhooks.ts", {
    "@/src/lib/prisma": { default: f.db }, "@/src/lib/services/invite-email-tracking": f.tracking,
    "@/src/lib/services/app-notifications": { markDelivered: async () => deliveredCalls++ },
  });
  assert.equal((await hooks.handleResendEmailWebhook(event("email.delivered", attempt))).status, "DELIVERED");
  assert.equal(f.logs.TEACHER[0].metadata.status, "DELIVERED");
  assert.equal(deliveredCalls, 0);
  existingDelivery = { id: "app-delivery", schoolId: "school-a", notificationId: "notice-one", status: "SENT" };
  await hooks.handleResendEmailWebhook(event("email.delivered", attempt));
  assert.equal(deliveredCalls, 1);
});
