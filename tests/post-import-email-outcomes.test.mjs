import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file, modules = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Date, require: (name) => modules[name] ?? {} });
  return exports;
}
const outcomes = load("src/lib/migration/invite-email.ts");

test("teacher access still requires contact details and acceptance preserves imported profile data", () => {
  const completion = load("src/lib/services/teacher-profile-completion.ts");
  const profile = { name: "Teacher", surname: "Test", email: "teacher@example.com", phone: null, status: "INVITED" };
  assert.equal(completion.nextTeacherProfileStatus(profile), "INCOMPLETE_SETUP");
  assert.equal(completion.nextTeacherProfileStatus({ ...profile, phone: "+233200000000" }), "ACTIVE");
  assert.equal(completion.nextTeacherProfileStatus({ ...profile, phone: "+233200000000", status: "SUSPENDED" }), "SUSPENDED");
  const source = readFileSync("src/lib/services/teacher-invites.ts", "utf8");
  assert.match(source, /const existingTeacher = teacherForUser \?\? teacherForEmail/);
  assert.match(source, /phone: invite.phone \?\? existingTeacher\?\.phone/);
  assert.match(source, /status: existingTeacher\?\.status/);
});

test("provider rejection, network uncertainty and console mode are not counted as accepted emails", async () => {
  const counts = outcomes.newInviteEmailCounts();
  for (const send of [
    async () => ({ ok: true, provider: "resend" }),
    async () => ({ ok: false, provider: "resend", message: '{"statusCode":422,"private":"raw provider text"}' }),
    async () => { throw Error("private network details"); },
    async () => ({ ok: true, provider: "console" }),
  ]) {
    const result = await outcomes.attemptInviteEmail(send);
    const warning = outcomes.recordInviteEmailOutcome(counts, result);
    assert.doesNotMatch(warning ?? "", /private|statusCode|raw provider/);
  }
  assert.equal(counts.emailsAccepted, 1);
  assert.equal(counts.emailsFailed, 2);
  assert.equal(counts.emailsNotSent, 1);
});

for (const role of ["teachers", "parents", "bursars"]) {
  test(`${role}: bulk invitation creation and provider outcomes are separate and reruns skip pending invites`, async () => {
    const records = ["accepted", "rejected"].map((name) => ({ id: name, name, surname: "Test", email: `${name}@example.com`, phone: null, sex: "FEMALE", classes: [], subjects: [], studentRelationships: [{ studentId: name, student: { name: "Child", surname: "Test", status: "ACTIVE" } }] }));
    const pending = [];
    const db = { school: { findUnique: async () => ({ name: "School" }) }, parentInviteStudent: { createMany: async () => {} } };
    const modules = { "@/src/lib/prisma": { default: db }, "@/src/lib/migration/invite-email": outcomes,
      "@/src/generated/prisma": { TeacherStatus: { ACTIVE: "ACTIVE" }, BursarStatus: { ACTIVE: "ACTIVE" }, TeacherInviteType: { SUBJECT_TEACHER: "SUBJECT_TEACHER" } },
      "@/src/lib/cacheTags": { revalidateDashboard() {}, revalidateReferenceData() {} },
    };
    let sends = 0;
    for (const model of ["teacher", "parent", "bursar"]) {
      db[model] = { findMany: async () => records, updateMany: async () => ({ count: 1 }) };
      db[model + "Invite"] = {
        findMany: async ({ where }) => where.status === "PENDING" ? pending : [],
        findFirst: async () => null,
        create: async ({ data }) => { const row = { ...data, id: "invite-" + data.email }; pending.push(row); return row; },
        update: async () => {},
      };
      db[model + "InviteAuditLog"] = { create: async () => {} };
      const capital = model[0].toUpperCase() + model.slice(1);
      modules[`@/src/lib/services/${model}-invite-tokens`] = { [`create${capital}InviteTokenBundle`]: () => ({ tokenHash: "hash", inviteUrl: "https://example.com/invite", expiresAt: new Date() }) };
    }
    modules["@/src/lib/services/notifications"] = Object.fromEntries(["Teacher", "Parent", "Bursar"].map((name) => [`send${name}InviteEmail`, async ({ to }) => {
      sends++;
      return to.startsWith("accepted") ? { ok: true, provider: "resend" } : { ok: false, provider: "resend", message: "raw provider response" };
    }]));
    db.$transaction = async (work) => work(db);
    const service = load("src/lib/services/post-import-invites.ts", modules);
    const result = await service.bulkInviteImportedProfiles(role, { schoolId: "school-a", actorId: "admin" });
    assert.equal(result.created, 2);
    assert.equal(result.emailsAccepted, 1);
    assert.equal(result.emailsFailed, 1);
    assert.equal(result.failed, 0);
    assert.doesNotMatch(JSON.stringify(result), /raw provider response/);
    const repeated = await service.bulkInviteImportedProfiles(role, { schoolId: "school-a", actorId: "admin" });
    assert.equal(repeated.created, 0);
    assert.equal(repeated.skipped, 2);
    assert.equal(sends, 2);
  });
}
