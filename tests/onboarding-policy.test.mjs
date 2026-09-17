import test from "node:test";
import assert from "node:assert/strict";
import {
  canFinishOnboarding,
  getInviteAvailability,
  getSchoolAdminInviteAccountSafety,
} from "../src/lib/services/onboarding-policy.js";

const now = new Date("2026-06-25T12:00:00.000Z");

test("invite is active when unused, unrevoked, and not expired", () => {
  const result = getInviteAvailability({
    acceptedAt: null,
    revokedAt: null,
    expiresAt: new Date("2026-06-26T12:00:00.000Z"),
  }, now);

  assert.equal(result.usable, true);
  assert.equal(result.reason, "active");
});

test("invite cannot be used after acceptance", () => {
  const result = getInviteAvailability({
    acceptedAt: new Date("2026-06-25T12:00:00.000Z"),
    revokedAt: null,
    expiresAt: new Date("2026-06-26T12:00:00.000Z"),
  }, now);

  assert.equal(result.usable, false);
  assert.equal(result.reason, "accepted");
});

test("invite cannot be used after revocation", () => {
  const result = getInviteAvailability({
    acceptedAt: null,
    revokedAt: new Date("2026-06-25T12:00:00.000Z"),
    expiresAt: new Date("2026-06-26T12:00:00.000Z"),
  }, now);

  assert.equal(result.usable, false);
  assert.equal(result.reason, "revoked");
});

test("invite cannot be used after expiry", () => {
  const result = getInviteAvailability({
    acceptedAt: null,
    revokedAt: null,
    expiresAt: new Date("2026-06-24T12:00:00.000Z"),
  }, now);

  assert.equal(result.usable, false);
  assert.equal(result.reason, "expired");
});

test("onboarding can finish only after core academics exist", () => {
  assert.equal(canFinishOnboarding({ grades: 1, classes: 1, subjects: 1 }), true);
  assert.equal(canFinishOnboarding({ grades: 1, classes: 0, subjects: 1 }), false);
});
test("school admin invite blocks accounts that already have a role", () => {
  const result = getSchoolAdminInviteAccountSafety({
    signedInEmail: "owner@example.com",
    inviteEmail: "owner@example.com",
    existingRole: "teacher",
    inviteSchoolId: "school_1",
    userId: "user_1",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "wrong-role");
});

test("school admin invite requires the invited email", () => {
  const result = getSchoolAdminInviteAccountSafety({
    signedInEmail: "other@example.com",
    inviteEmail: "owner@example.com",
    existingRole: null,
    inviteSchoolId: "school_1",
    userId: "user_1",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "wrong-email");
});

test("school admin invite blocks accounts already linked to a role table", () => {
  const result = getSchoolAdminInviteAccountSafety({
    signedInEmail: "owner@example.com",
    inviteEmail: "owner@example.com",
    existingRole: null,
    inviteSchoolId: "school_1",
    existingRoleRecord: true,
    userId: "user_1",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "account-already-linked");
});

test("school admin invite blocks invited email already owned by another admin account", () => {
  const result = getSchoolAdminInviteAccountSafety({
    signedInEmail: "owner@example.com",
    inviteEmail: "owner@example.com",
    existingRole: null,
    inviteSchoolId: "school_1",
    adminForEmailUserId: "user_2",
    userId: "user_1",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "email-already-linked");
});

test("school admin invite allows a clean invited account", () => {
  const result = getSchoolAdminInviteAccountSafety({
    signedInEmail: "OWNER@example.com",
    inviteEmail: "owner@example.com",
    existingRole: null,
    inviteSchoolId: "school_1",
    existingRoleRecord: false,
    adminForEmailUserId: null,
    userId: "user_1",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.reason, "allowed");
});



