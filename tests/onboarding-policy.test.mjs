import test from "node:test";
import assert from "node:assert/strict";
import {
  canFinishOnboarding,
  getInviteAvailability,
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
