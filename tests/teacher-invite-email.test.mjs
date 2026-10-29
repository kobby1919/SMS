import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
function load(file, modules = {}) {
  const exports = {};
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function("exports", "require", compiled)(exports, (id) => id in modules ? modules[id] : require(id));
  return exports;
}
const emailHelpers = load("src/lib/migration/invite-email.ts");
const resultComponent = load("src/components/TeacherInviteResult.tsx").default;

function fixture(sendResult, duplicate = false, failSendLog = false) {
  const events = [];
  const audits = [];
  const updates = [];
  const invite = { id: "invite-one", schoolId: "school-one", name: "Test", surname: "Teacher", sex: "FEMALE", teacherType: "SUBJECT_TEACHER", email: "teacher@example.com", expiresAt: new Date("2030-01-01") };
  const school = { id: "school-one", name: "Test School", displayName: "School Display", emailFromName: "School Sender" };
  let resend = false;
  const db = {
    school: { findUnique: async () => school },
    teacher: { findFirst: async () => null },
    teacherInvite: {
      findFirst: async () => resend ? { ...invite, status: "PENDING", school } : duplicate ? invite : null,
      create: async () => { events.push("created"); return invite; },
      update: async ({ data }) => { if (failSendLog) throw new Error("PRIVATE database failure"); updates.push(data); },
      updateMany: async () => ({ count: 1 }),
    },
    teacherInviteAuditLog: { create: async ({ data }) => audits.push(data) },
  };
  db.$transaction = async (work) => work(db);
  const service = load("src/lib/services/teacher-invites.ts", {
    "@clerk/nextjs/server": {},
    "@/src/lib/prisma": { default: db },
    "@/src/lib/services/teacher-profile-completion": {},
    "@/src/lib/cacheTags": { revalidateDashboard() {}, revalidateReferenceData() {} },
    "@/src/lib/roles": {},
    "@/src/lib/services/teacher-invite-tokens": { createTeacherInviteTokenBundle: () => ({ token: "test-token", tokenHash: "test-hash", invitePath: "/onboarding/teacher/accept?token=test-token", inviteUrl: "https://example.com/invite", expiresAt: invite.expiresAt }) },
    "@/src/lib/migration/invite-email": emailHelpers,
    "@/src/lib/services/notifications": { sendTeacherInviteEmail: async (input) => {
      events.push("email");
      assert.equal(input.to, invite.email);
      assert.equal(input.schoolName, "School Sender");
      assert.equal(input.inviteUrl, "https://example.com/invite");
      if (sendResult instanceof Error) throw sendResult;
      return sendResult;
    } },
  });
  return { service, events, audits, updates, setResend: () => { resend = true; } };
}
const context = { schoolId: "school-one", userId: "admin-one", role: "admin" };
const input = { name: "Test", surname: "Teacher", sex: "FEMALE", email: "teacher@example.com", phone: "0240000000", teacherType: "SUBJECT_TEACHER" };

for (const [name, providerResult, expected] of [
  ["accepted", { ok: true, provider: "resend" }, "SENT"],
  ["rejected", { ok: false, provider: "resend", message: "PRIVATE raw provider response" }, "FAILED"],
  ["network uncertainty", new Error("PRIVATE network details"), "FAILED"],
  ["console mode", { ok: true, provider: "console" }, "NOT_SENT"],
]) {
  for (const operation of ["create", "resend"]) {
    test(`${operation}: ${name} is reported honestly without sending real email`, async () => {
      const f = fixture(providerResult);
      if (operation === "resend") f.setResend();
      const result = operation === "create"
        ? await f.service.createTeacherInvite(input, context)
        : await f.service.resendTeacherInvite({ inviteId: "invite-one" }, context);
      assert.equal(result.emailStatus, expected);
      assert.equal(f.events.filter((e) => e === "email").length, 1);
      if (operation === "create") assert.deepEqual(f.events, ["created", "email"]);
      assert.equal(f.updates.length, expected === "SENT" ? 1 : 0);
      assert.equal(f.audits.at(-1).metadata.outcome, expected);
      assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
      assert.doesNotMatch(JSON.stringify(f.audits), /PRIVATE|test-token/);
      if (expected !== "SENT") assert.ok(result.emailWarning);
    });
  }
}

test("existing pending invitation is not duplicated or emailed again by creation", async () => {
  const f = fixture({ ok: true, provider: "resend" }, true);
  await assert.rejects(f.service.createTeacherInvite(input, context), /active pending invite/);
  assert.equal(f.events.length, 0);
});

for (const status of ["SENT", "FAILED", "NOT_SENT"]) {
  test(`notice: ${status} has truthful wording and keeps manual link collapsed`, () => {
    const html = renderToStaticMarkup(React.createElement(resultComponent, {
      invite: { email: input.email, emailStatus: status, inviteUrl: "https://example.com/invite" },
      copied: false, onCopy() {},
    }));
    assert.match(html, /role="status"/);
    assert.match(html, /<details class=/);
    assert.doesNotMatch(html, /<details[^>]*\bopen(?:=|\s|>)/);
    assert.doesNotMatch(html, /test link|next parts|delivered successfully/);
    if (status === "SENT") {
      assert.match(html, /Invitation email sent/);
      assert.match(html, /Inbox delivery is not yet confirmed/);
      assert.match(html, /bg-emerald-50/);
    } else {
      assert.doesNotMatch(html, /Invitation email sent/);
      assert.match(html, /bg-amber-50/);
      assert.match(html, /rather than creating a duplicate/);
    }
  });
}

test("teacher modal no longer shows the obsolete test-link message", () => {
  const source = readFileSync("src/components/TeacherInviteModal.tsx", "utf8");
  assert.doesNotMatch(source, /Copy this test link|Email\/SMS delivery comes in/);
  assert.match(source, /<TeacherInviteResult invite=\{result.invite\}/);
  assert.match(source, /Sending invitation/);
  const resend = readFileSync("src/components/TeacherInviteActions.tsx", "utf8");
  assert.match(resend, /result.invite.emailStatus === "SENT"/);
  assert.doesNotMatch(resend, /Invite resent\. Copy/);
});

test("post-send log failure cannot turn an accepted teacher email into a failed creation", async () => {
  const f = fixture({ ok: true, provider: "resend" }, false, true);
  const result = await f.service.createTeacherInvite(input, context);
  assert.equal(result.emailStatus, "SENT");
  assert.match(result.emailWarning, /send log could not be updated/);
  assert.deepEqual(f.events, ["created", "email"]);
  assert.doesNotMatch(result.emailWarning, /PRIVATE/);
});
