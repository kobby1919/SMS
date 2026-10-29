import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
function load(file, modules = {}) {
  const exports = {};
  new Function("exports", "require", ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText)(exports, (id) => id in modules ? modules[id] : id.startsWith("@/") ? {} : require(id));
  return exports;
}
const emailHelpers = load("src/lib/migration/invite-email.ts");
const rules = load("src/lib/teacher-lifecycle-rules.ts");

function adminFixture({ conflict = false, rejected = false, logFailure = false } = {}) {
  const invite = { id: "invite-one", schoolId: "school-a", email: "admin@example.com", tokenHash: "old-hash", acceptedAt: null, revokedAt: null,
    expiresAt: new Date("2030-01-01"), school: { id: "school-a", name: "School" } };
  const events = [];
  const db = {
    schoolInvite: {
      findUnique: async () => ({ ...invite }),
      updateMany: async ({ where, data }) => {
        assert.equal(where.schoolId, "school-a");
        assert.equal(where.tokenHash, "old-hash");
        assert.equal(where.acceptedAt, null);
        assert.equal(where.revokedAt, null);
        if (conflict) return { count: 0 };
        invite.tokenHash = data.tokenHash;
        events.push("rotated");
        return { count: 1 };
      },
      update: async ({ data }) => { if (logFailure) throw new Error("PRIVATE logging failure"); if (data.lastSentAt) events.push("last-sent"); return invite; },
    },
    onboardingAuditLog: { create: async () => events.push("audit") },
  };
  db.$transaction = async (work) => work(db);
  const send = async (input) => {
    const token = new URL(input.inviteUrl).searchParams.get("token");
    assert.equal(createHash("sha256").update(token).digest("hex"), invite.tokenHash, "Persist the new token before tracking/sending");
    events.push("sent");
    return rejected ? { ok: false, provider: "resend", message: "Provider rejected this send." } : { ok: true, provider: "resend" };
  };
  const service = load("src/lib/services/onboarding.ts", {
    "@clerk/nextjs/server": {}, "@/src/lib/prisma": { default: db }, "@/src/lib/migration/invite-email": emailHelpers,
    "@/src/lib/services/notifications": { appBaseUrl: () => "https://example.com", sendFirstAdminInviteEmail: send, sendSchoolAdminInviteEmail: send },
  });
  return { service, invite, events };
}
for (const [fn, role] of [["resendSchoolInvite", "platform_admin"], ["resendCurrentSchoolAdminInvite", "admin"]]) {
  for (const rejected of [false, true]) {
    test(`${fn}: token is persisted before email and Last sent requires provider acceptance (${rejected ? "rejected" : "accepted"})`, async () => {
      const f = adminFixture({ rejected });
      const result = await f.service[fn]({ inviteId: "invite-one" }, { role, userId: "actor", schoolId: "school-a" });
      assert.ok(f.events.indexOf("rotated") < f.events.indexOf("sent"));
      assert.equal(f.events.includes("last-sent"), !rejected);
      assert.equal(Boolean(result.emailWarning), rejected);
      assert.equal(result.emailProvider, "resend");
    });
  }
  test(`${fn}: a concurrent accept/revoke/rotation stops the email`, async () => {
    const f = adminFixture({ conflict: true });
    await assert.rejects(f.service[fn]({ inviteId: "invite-one" }, { role, userId: "actor", schoolId: "school-a" }), /changed while resending/);
    assert.equal(f.events.includes("sent"), false);
  });
  test(`${fn}: logging failure after acceptance returns a warning, not a failed resend`, async () => {
    const f = adminFixture({ logFailure: true });
    const result = await f.service[fn]({ inviteId: "invite-one" }, { role, userId: "actor", schoolId: "school-a" });
    assert.match(result.emailWarning, /send log could not be updated/);
    assert.equal(f.events.filter((event) => event === "sent").length, 1);
  });
}
test("school-admin resend cannot cross school boundaries or run as a teacher", async () => {
  const f = adminFixture();
  await assert.rejects(f.service.resendCurrentSchoolAdminInvite({ inviteId: "invite-one" }, { role: "admin", userId: "actor", schoolId: "school-b" }), /not found for this school/);
  await assert.rejects(f.service.resendSchoolInvite({ inviteId: "invite-one" }, { role: "teacher", userId: "actor", schoolId: "school-a" }), /Only a platform admin/);
  assert.equal(f.events.length, 0);
});

test("current teacher definition excludes only departed staff, not suspended or onboarding staff", () => {
  const rows = ["ACTIVE", "SUSPENDED", "INVITED", "INCOMPLETE_SETUP", "LEFT_SCHOOL"].map((status) => ({ status }));
  assert.equal(rows.filter(rules.isCurrentTeacher).length, 4);
  assert.deepEqual(rules.currentTeacherWhere("school-a"), { schoolId: "school-a", status: { not: "LEFT_SCHOOL" } });
});

async function teacherPage(status) {
  const rows = ["ACTIVE", "SUSPENDED", "INVITED", "INCOMPLETE_SETUP", "LEFT_SCHOOL"].map((status) => ({
    id: status, status, schoolId: "school-a", name: "Name_" + status, surname: "Teacher", email: "teacher@example.com", phone: "0240000000", address: "Test", sex: "FEMALE", img: null, subjects: [], classes: [],
  }));
  const Empty = () => null;
  const modules = {
    "next/link": { default: ({ children, href }) => React.createElement("a", { href }, children) },
    "next/image": { default: () => null },
    "@clerk/nextjs/server": { clerkClient: async () => ({ users: { getUser: async () => ({ imageUrl: null }) } }) },
    "@/src/lib/authz": { requirePageSession: async () => ({ role: "admin", schoolId: "school-a" }) },
    "@/src/lib/prisma": { default: { teacher: { findMany: async ({ where }) => { assert.equal(where.schoolId, "school-a"); return rows; } }, teacherInvite: { findMany: async () => [], count: async () => 0 } } },
    "@/src/lib/teacher-lifecycle-rules": rules,
    "@/src/lib/settings": { ITEM_PER_PAGE: 10 },
    "@/src/lib/services/timetable": { listLiveTimetableLessons: async () => [] },
    "@/src/components/pagination": { default: ({ count }) => React.createElement("i", { "data-result-count": count }) },
  };
  for (const name of ["TableSearch", "FormModal", "TeacherInviteActions", "TeacherInviteModal"]) modules["@/src/components/" + name] = { default: Empty };
  const completion = load("src/lib/services/teacher-profile-completion.ts");
  modules["@/src/lib/services/teacher-readiness"] = load("src/lib/services/teacher-readiness.ts", { "@/src/lib/services/teacher-profile-completion": completion });
  const Page = load("src/app/(dashboard)/list/teachers/page.tsx", modules).default;
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(status ? { status } : {}) }));
}
test("default teacher list excludes departed staff; Left school remains accessible without deleting history", async () => {
  const current = await teacherPage();
  assert.match(current, /Name_ACTIVE/);
  assert.match(current, /Name_SUSPENDED/);
  assert.doesNotMatch(current, /Name_LEFT_SCHOOL/);
  assert.match(current, /data-result-count="4"/);
  const departed = await teacherPage("left-school");
  assert.match(departed, /Name_LEFT_SCHOOL/);
  assert.doesNotMatch(departed, /Name_ACTIVE/);
  assert.match(departed, /data-result-count="1"/);
});
test("dashboard and reusable teacher card use the same school-scoped current teacher count", async () => {
  assert.match(readFileSync("src/lib/queries/admin-dashboard.ts", "utf8"), /prisma.teacher.count\(\{ where: currentTeacherWhere\(schoolId\) \}\)/);
  const Card = load("src/components/UserCard.tsx", {
    "@/src/lib/teacher-lifecycle-rules": rules,
    "@/src/lib/authz": { requirePageSession: async () => ({ schoolId: "school-a" }) },
    "@/src/lib/prisma": { default: { teacher: { count: async ({ where }) => { assert.deepEqual(where, rules.currentTeacherWhere("school-a")); return 4; } } } },
    "./UserCardClient ": { default: () => null },
  }).default;
  assert.equal((await Card({ type: "teacher" })).props.count, 4);
});
