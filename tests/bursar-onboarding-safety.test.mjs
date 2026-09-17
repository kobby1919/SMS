import test from "node:test";
import assert from "node:assert/strict";
import {
  canUseBursarIdentity,
  getBursarInviteAccountSafety,
} from "../src/lib/services/bursar-onboarding-policy.js";

test("bursar invite requires the signed-in email to match the invited email", () => {
  const result = getBursarInviteAccountSafety({
    signedInEmail: "other@example.com",
    inviteEmail: "bursar@example.com",
    existingRole: null,
    metadataSchoolId: null,
    inviteSchoolId: "school-a",
    bursarForUserSchoolId: null,
    bursarForEmailUserId: null,
    userId: "user-1",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "wrong-email");
});

test("bursar invite blocks an account that already belongs to another role", () => {
  const result = getBursarInviteAccountSafety({
    signedInEmail: "bursar@example.com",
    inviteEmail: "bursar@example.com",
    existingRole: "teacher",
    metadataSchoolId: "school-a",
    inviteSchoolId: "school-a",
    bursarForUserSchoolId: null,
    bursarForEmailUserId: null,
    userId: "user-1",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "wrong-role");
});

test("bursar invite blocks accounts already attached to another school", () => {
  const result = getBursarInviteAccountSafety({
    signedInEmail: "bursar@example.com",
    inviteEmail: "bursar@example.com",
    existingRole: "bursar",
    metadataSchoolId: "school-a",
    inviteSchoolId: "school-b",
    bursarForUserSchoolId: null,
    bursarForEmailUserId: null,
    userId: "user-1",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "wrong-school-metadata");
});

test("bursar invite blocks emails already linked to a different bursar account", () => {
  const result = getBursarInviteAccountSafety({
    signedInEmail: "bursar@example.com",
    inviteEmail: "bursar@example.com",
    existingRole: null,
    metadataSchoolId: null,
    inviteSchoolId: "school-a",
    bursarForUserSchoolId: null,
    bursarForEmailUserId: "other-user",
    userId: "user-1",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "email-already-linked");
});

test("only active bursar records can resolve as finance users", () => {
  assert.equal(canUseBursarIdentity({ status: "ACTIVE" }), true);
  assert.equal(canUseBursarIdentity({ status: "SUSPENDED" }), false);
  assert.equal(canUseBursarIdentity({ status: "LEFT_SCHOOL" }), false);
});
