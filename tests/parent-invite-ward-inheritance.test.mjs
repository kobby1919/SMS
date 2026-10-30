import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)((id) => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith("@/") ? load(`${id.slice(2)}.ts`, mocks) : require(id), loaded, loaded.exports);
  return loaded.exports;
}
const context = { role: "admin", schoolId: "school-a", userId: "admin-a" };
const input = { name: "Typed", surname: "Name", sex: "MALE", email: "guardian@example.com", phone: "0240000000", studentIds: [] };
function fixture(options = {}) {
  const children = ["one", "two"].map((id) => ({ id, schoolId: "school-a", status: "ACTIVE", name: "Child", surname: id, class: { name: "Primary 1" } }));
  let profile = options.newParent ? null : { id: "par_imported", schoolId: "school-a", name: "Saved", surname: "Guardian", sex: "MALE", email: input.email, phone: "0240000000", acceptedInvites: [], ...options.profile };
  let links = children.map((student) => ({ id: "link-" + student.id, schoolId: "school-a", parentId: profile?.id, studentId: student.id, student, status: "ACTIVE", endedAt: null, canViewFees: false, canViewReports: true, canMessageSchool: false }));
  if (options.noWards) links = [];
  const invites = [], snapshots = [], sent = [], relationshipWrites = [], metadataWrites = [], parentWrites = [], audits = [];
  const db = {
    school: { findUnique: async () => ({ id: context.schoolId, name: "Test School" }) },
    parent: {
      findMany: async ({ where }) => {
        assert.equal(where.schoolId, context.schoolId);
        if (where.email?.equals) assert.equal(where.email.mode, "insensitive");
        const targetEmail = where.email?.equals ?? where.OR?.[0]?.email?.equals;
        const matches = profile && (!targetEmail || targetEmail === profile.email.toLowerCase()) ? [{ ...profile, studentRelationships: links.filter((link) => link.schoolId === where.schoolId && link.status === "ACTIVE" && !link.endedAt && link.student.schoolId === where.schoolId && link.student.status === "ACTIVE") }] : [];
        return options.ambiguous && matches.length ? [...matches, { ...matches[0], id: "par_duplicate" }] : matches;
      },
      findUnique: async ({ where }) => profile?.id === where.id ? profile : null,
      findFirst: async () => profile,
      update: async ({ data }) => { parentWrites.push("update"); profile = { ...profile, ...data }; if (data.id) links = links.map((link) => ({ ...link, parentId: data.id })); return { id: profile.id }; },
      create: async ({ data }) => { parentWrites.push("create"); profile = data; return { id: data.id }; },
    },
    student: {
      findMany: async ({ where }) => children.filter((student) => student.schoolId === where.schoolId && where.id.in.includes(student.id) && student.status === "ACTIVE"),
      findFirst: async ({ where }) => children.find((student) => student.id === where.id && student.schoolId === where.schoolId && student.status === "ACTIVE") ?? null,
    },
    parentInvite: {
      findFirst: async () => options.pending || invites.length ? { id: "pending" } : null,
      findMany: async ({ where }) => where.status === "PENDING" ? invites : [],
      create: async ({ data }) => { const invite = { ...data, id: "invite-a", status: "PENDING", acceptedAt: null, revokedAt: null }; invites.push(invite); return invite; },
      update: async () => ({}),
      findUnique: async () => ({ ...invites[0], school: { id: context.schoolId }, students: snapshots.map((row) => ({ student: children.find((child) => child.id === row.studentId) })) }),
      updateMany: async ({ where, data }) => {
        const row = invites.find((invite) => invite.id === where.id);
        if (!row || row.tokenHash !== where.tokenHash || row.expiresAt <= where.expiresAt.gt || row.status !== where.status || row.acceptedAt || row.revokedAt || row.schoolId !== where.schoolId) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    parentInviteStudent: { createMany: async ({ data }) => { snapshots.push(...data); } },
    parentInviteAuditLog: { create: async ({ data }) => { audits.push(data); }, findFirst: async ({ where }) => options.missingAudit ? null : audits.find((row) => row.schoolId === where.schoolId && row.inviteId === where.inviteId && row.action === where.action) ?? null },
    parentStudentRelationship: {
      findUnique: async ({ where }) => links.find((link) => link.parentId === where.schoolId_parentId_studentId.parentId && link.studentId === where.schoolId_parentId_studentId.studentId) ?? null,
      upsert: async ({ where, create, update }) => {
        relationshipWrites.push({ create, update });
        const row = links.find((link) => link.parentId === where.schoolId_parentId_studentId.parentId && link.studentId === where.schoolId_parentId_studentId.studentId);
        if (row) { Object.assign(row, update); return row; }
        const created = { id: "new-link", ...create }; links.push(created); return created;
      },
    },
  };
  db.$transaction = async (work, transactionOptions) => {
    if (transactionOptions) assert.equal(transactionOptions.isolationLevel, "Serializable");
    const before = structuredClone({ profile, links, invites });
    const counts = [parentWrites.length, relationshipWrites.length, audits.length];
    try { return await work(db); } catch (error) {
      profile = before.profile; links = before.links; invites.splice(0, invites.length, ...before.invites);
      parentWrites.length = counts[0]; relationshipWrites.length = counts[1]; audits.length = counts[2];
      throw error;
    }
  };
  const mocks = {
    "@/src/lib/prisma": { __esModule: true, default: db },
    "@/src/generated/prisma": { TeacherStatus: {}, BursarStatus: {}, TeacherInviteType: {} },
    "@clerk/nextjs/server": { clerkClient: async () => ({ users: { getUser: async () => { options.beforeAccountRead?.(invites); return { primaryEmailAddressId: "primary", emailAddresses: [{ id: "primary", emailAddress: options.acceptEmail ?? input.email, verification: { status: options.verification ?? "verified" } }], publicMetadata: {} }; }, updateUserMetadata: async (...args) => { metadataWrites.push(args); } } }) },
    "@/src/lib/cacheTags": { revalidateDashboard() {}, revalidateReferenceData() {} },
    "@/src/lib/services/parent-invite-tokens": { createParentInviteTokenBundle: () => ({ token: "token", tokenHash: "hash", invitePath: "/accept", inviteUrl: "https://example.com/accept", expiresAt: new Date(Date.now() + 86400000) }), hashParentInviteToken: () => "hash", isParentInviteExpired: () => false },
    "@/src/lib/services/notifications": { sendParentInviteEmail: async (data) => { sent.push(data); return { ok: true, provider: "resend" }; } },
    "@/src/lib/services/parent-access-audit": { writeParentAccessAudit: async () => {} },
  };
  const service = load("src/lib/services/parent-invites.ts", mocks);
  const bulk = load("src/lib/services/post-import-invites.ts", mocks);
  return { service, bulk, children, invites, snapshots, sent, relationshipWrites, metadataWrites, parentWrites, audits, get links() { return links; }, get profile() { return profile; }, changeProfileEmail(email) { profile.email = email; }, removeLink(id) { links = links.filter((link) => link.studentId !== id); } };
}

test("existing imported parent inherits all linked wards with no manual selection or duplicate profile", async () => {
  const f = fixture();
  const result = await f.service.createParentInvite(input, context);
  assert.deepEqual(result.studentIds, ["one", "two"]);
  assert.equal(result.name, "Saved");
  assert.equal(result.sex, "MALE");
  assert.equal(f.snapshots.length, 2);
  assert.equal(f.sent[0].wardNames.length, 2);
  assert.equal(f.parentWrites.length, 0);
});

test("selecting only one existing ward does not drop the parent's other ward", async () => {
  const f = fixture();
  const result = await f.service.createParentInvite({ ...input, studentIds: ["one"] }, context);
  assert.deepEqual(result.studentIds, ["one", "two"]);
});

test("sex and phone corrections save with the invite and are audited without changing ward links", async () => {
  const f = fixture();
  const before = structuredClone(f.links);
  const result = await f.service.createParentInvite({ ...input, sex: "FEMALE", phone: "0201234567" }, context);
  assert.equal(f.profile.sex, "FEMALE");
  assert.equal(f.profile.phone, "0201234567");
  assert.equal(result.sex, "FEMALE");
  assert.equal(f.invites[0].phone, "0201234567");
  assert.deepEqual(f.links, before);
  const audit = f.audits.find((row) => row.action === "INVITE_CREATED");
  assert.deepEqual(audit.metadata.profileCorrections, { before: { sex: "MALE", phone: "0240000000" }, after: { sex: "FEMALE", phone: "0201234567" } });
  await f.service.acceptParentInviteForUser({ token: "token", userId: "user_guardian" });
  assert.equal(f.profile.sex, "FEMALE");
  assert.equal(f.profile.phone, "0201234567");
});

test("ended, inactive and cross-school links cannot be inherited", async () => {
  for (const change of [(f) => { f.links[0].status = "ENDED"; }, (f) => { f.links[0].endedAt = new Date(); }, (f) => { f.children[0].status = "LEFT_SCHOOL"; }, (f) => { f.children[0].schoolId = "school-b"; }]) {
    const f = fixture(); change(f);
    const result = await f.service.createParentInvite(input, context);
    assert.deepEqual(result.studentIds, ["two"]);
  }
});

test("unknown wards cannot be added through an existing parent's invitation", async () => {
  const f = fixture();
  await assert.rejects(f.service.createParentInvite({ ...input, studentIds: ["other"] }, context), /parent profile/);
  assert.equal(f.sent.length, 0);
});

test("zero links, duplicate contacts, pending invites and registered accounts fail before sending", async () => {
  for (const options of [{ noWards: true }, { ambiguous: true }, { pending: true }, { profile: { id: "user_existing" } }, { profile: { acceptedInvites: [{ id: "accepted" }] } }]) {
    const f = fixture(options);
    await assert.rejects(f.service.createParentInvite(input, context));
    assert.equal(f.sent.length, 0);
  }
});

test("only a genuinely new parent requires manual ward selection", async () => {
  const empty = fixture({ newParent: true });
  await assert.rejects(empty.service.createParentInvite(input, context), /Select at least one ward/);
  const f = fixture({ newParent: true });
  const result = await f.service.createParentInvite({ ...input, studentIds: ["one"] }, context);
  assert.deepEqual(result.studentIds, ["one"]);
});

test("school admin authorization is enforced inside the invite service", async () => {
  const f = fixture();
  await assert.rejects(f.service.createParentInvite(input, { ...context, role: "teacher" }), /Only school admins/);
  assert.equal(f.sent.length, 0);
});

test("acceptance activates the imported parent and preserves both links and their restrictions", async () => {
  const f = fixture();
  await f.service.createParentInvite(input, context);
  const result = await f.service.acceptParentInviteForUser({ token: "token", userId: "user_guardian" });
  assert.equal(result.parentId, "user_guardian");
  assert.deepEqual(f.parentWrites, ["update"]);
  assert.equal(f.links.length, 2);
  assert.ok(f.links.every((link) => link.parentId === "user_guardian" && link.canViewFees === false && link.canMessageSchool === false));
  assert.ok(f.relationshipWrites.every((write) => !Object.hasOwn(write.update, "canViewFees") && !Object.hasOwn(write.update, "status")));
});

test("a stale invitation cannot restore an ended or removed ward link", async () => {
  for (const remove of [false, true]) {
    const f = fixture();
    await f.service.createParentInvite(input, context);
    if (remove) f.removeLink("one"); else f.links[0].status = "ENDED";
    await assert.rejects(f.service.acceptParentInviteForUser({ token: "token", userId: "user_guardian" }), /ward link/i);
    assert.equal(f.relationshipWrites.length, 0);
    assert.equal(f.metadataWrites.length, 0);
  }
});

test("bulk invites after migration attach existing wards automatically and skip pending invitations", async () => {
  const f = fixture();
  const result = await f.bulk.bulkInviteImportedProfiles("parents", { schoolId: context.schoolId, actorId: context.userId });
  assert.equal(result.created, 1);
  assert.equal(result.failed, 0);
  assert.deepEqual(f.snapshots.map((row) => row.studentId), ["one", "two"]);
  const repeat = await f.bulk.bulkInviteImportedProfiles("parents", { schoolId: context.schoolId, actorId: context.userId });
  assert.equal(repeat.created, 0);
  assert.equal(f.sent.length, 1);
});

test("the action schema defers missing ward selection to the server's existing-profile check", () => {
  const { parentInviteCreateSchema } = load("src/lib/validation/parent-invites.ts");
  const data = parentInviteCreateSchema.parse({ ...input, studentIds: undefined });
  assert.deepEqual(data.studentIds, []);
});

test("profile lookup is admin-only, uses the session school and normalizes the email", async () => {
  for (const role of ["admin", "teacher"]) {
    let reads = 0;
    const action = load("src/lib/actions/parentInviteActions.ts", {
      "next/cache": { revalidatePath() {} }, "@clerk/nextjs/server": {},
      "@/src/lib/prisma": { __esModule: true, default: {} },
      "@/src/lib/authz": { requireRole: async (roles) => { assert.deepEqual(roles, ["admin"]); if (role !== "admin") throw Error("Unauthorized"); return context; } },
      "@/src/lib/services/parent-invites": {},
      "@/src/lib/services/parent-invite-profile": {
        ParentInviteProfileError: class extends Error {},
        findParentInviteProfile: async (_db, schoolId, email) => { reads++; assert.equal(schoolId, context.schoolId); assert.equal(email, input.email); return null; },
      },
    });
    const result = await action.lookupParentInviteProfileAction({ email: " GUARDIAN@example.com ", schoolId: "school-b" });
    assert.equal(result.ok, role === "admin");
    assert.equal(reads, role === "admin" ? 1 : 0);
  }
});

test("changed imported-parent contact cannot create a replacement parent through an old invitation", async () => {
  const f = fixture();
  await f.service.createParentInvite(input, context);
  f.changeProfileEmail("changed@example.com");
  await assert.rejects(f.service.acceptParentInviteForUser({ token: "token", userId: "user_guardian" }), /profile.*changed/i);
  assert.equal(f.parentWrites.length, 0);
  assert.equal(f.metadataWrites.length, 0);
});

test("resend, revocation or expiry during account lookup prevents acceptance and rolls back parent changes", async () => {
  for (const mutate of [(row) => { row.tokenHash = "rotated"; }, (row) => { row.revokedAt = new Date(); }, (row) => { row.expiresAt = new Date(0); }]) {
    const f = fixture({ beforeAccountRead: (rows) => mutate(rows[0]) });
    await f.service.createParentInvite(input, context);
    await assert.rejects(f.service.acceptParentInviteForUser({ token: "token", userId: "user_guardian" }), /no longer available/);
    assert.equal(f.profile.id, "par_imported");
    assert.equal(f.parentWrites.length, 0);
    assert.equal(f.relationshipWrites.length, 0);
    assert.equal(f.metadataWrites.length, 0);
  }
});

test("acceptance requires a verified matching primary email", async () => {
  for (const options of [{ verification: "unverified" }, { acceptEmail: "different@example.com" }]) {
    const f = fixture(options);
    await f.service.createParentInvite(input, context);
    await assert.rejects(f.service.acceptParentInviteForUser({ token: "token", userId: "user_guardian" }), /email address/);
    assert.equal(f.parentWrites.length, 0);
    assert.equal(f.metadataWrites.length, 0);
  }
});

test("profile lookup failures do not expose internal database error text", async () => {
  const action = load("src/lib/actions/parentInviteActions.ts", {
    "next/cache": { revalidatePath() {} }, "@clerk/nextjs/server": {},
    "@/src/lib/prisma": { __esModule: true, default: {} },
    "@/src/lib/authz": { requireRole: async () => context },
    "@/src/lib/services/parent-invites": {},
    "@/src/lib/services/parent-invite-profile": { ParentInviteProfileError: class extends Error {}, findParentInviteProfile: async () => { throw Error("private database SQL connection details"); } },
  });
  const result = await action.lookupParentInviteProfileAction({ email: input.email });
  assert.equal(result.ok, false);
  assert.doesNotMatch(result.message, /private|SQL|connection details/);
});
