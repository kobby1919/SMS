import test from "node:test";
import assert from "node:assert/strict";
import {
  canUseParentWardRelationship,
  getParentInviteAccountSafety,
} from "../src/lib/services/parent-onboarding-policy.js";

test("parent invite requires the signed-in email to match the invited email", () => {
  const result = getParentInviteAccountSafety({
    signedInEmail: "other@example.com",
    inviteEmail: "parent@example.com",
    existingRole: null,
    metadataSchoolId: null,
    inviteSchoolId: "school-a",
    parentForUserSchoolId: null,
    parentForEmailUserId: null,
    userId: "user-1",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "wrong-email");
});

test("parent invite blocks accounts already attached to another school", () => {
  const result = getParentInviteAccountSafety({
    signedInEmail: "parent@example.com",
    inviteEmail: "parent@example.com",
    existingRole: "parent",
    metadataSchoolId: "school-a",
    inviteSchoolId: "school-b",
    parentForUserSchoolId: null,
    parentForEmailUserId: null,
    userId: "user-1",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "wrong-school-metadata");
});

test("parent invite blocks emails already linked to a different parent account", () => {
  const result = getParentInviteAccountSafety({
    signedInEmail: "parent@example.com",
    inviteEmail: "parent@example.com",
    existingRole: null,
    metadataSchoolId: null,
    inviteSchoolId: "school-a",
    parentForUserSchoolId: null,
    parentForEmailUserId: "other-user",
    userId: "user-1",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "email-already-linked");
});

test("active relationship allows general ward access", () => {
  assert.equal(canUseParentWardRelationship({ hasRelationshipRows: true, status: "ACTIVE" }), true);
});

test("removed or revoked relationship blocks ward access", () => {
  assert.equal(canUseParentWardRelationship({ hasRelationshipRows: true, status: "REMOVED" }), false);
  assert.equal(canUseParentWardRelationship({ hasRelationshipRows: true, status: "REVOKED" }), false);
});

test("ward permissions can block only the sensitive area", () => {
  assert.equal(
    canUseParentWardRelationship({
      hasRelationshipRows: true,
      status: "ACTIVE",
      permission: "fees",
      canViewFees: false,
    }),
    false,
  );
  assert.equal(
    canUseParentWardRelationship({
      hasRelationshipRows: true,
      status: "ACTIVE",
      permission: "messages",
      canMessageSchool: true,
    }),
    true,
  );
});

test("legacy parentId fallback works only before relationship rows exist", () => {
  assert.equal(
    canUseParentWardRelationship({
      hasRelationshipRows: false,
      status: null,
      legacyParentMatches: true,
    }),
    true,
  );
  assert.equal(
    canUseParentWardRelationship({
      hasRelationshipRows: true,
      status: "REMOVED",
      legacyParentMatches: true,
    }),
    false,
  );
});
