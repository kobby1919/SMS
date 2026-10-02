import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const authz = readFileSync("src/lib/authz.ts", "utf8");
const adminPage = readFileSync("src/app/(dashboard)/admin/page.tsx", "utf8");
const postSignIn = readFileSync("src/lib/auth/post-sign-in.ts", "utf8");

function assertContains(source, needle, message) {
  assert.ok(source.includes(needle), message);
}

test("incomplete school setup keeps admins out of the live dashboard", () => {
  assertContains(
    authz,
    "requireCompletedAdminSchoolSetup",
    "Authz must expose a reusable completed-setup guard for admin-only live screens.",
  );
  assertContains(
    authz,
    'school.onboardingStatus !== "COMPLETED"',
    "The guard must block schools that are not fully onboarded.",
  );
  assertContains(
    authz,
    'redirect("/onboarding/setup")',
    "Incomplete schools must be sent to the setup flow.",
  );
  assertContains(
    adminPage,
    "await requireCompletedAdminSchoolSetup(session);",
    "The main admin dashboard must enforce completed setup before loading live data.",
  );
  assertContains(
    postSignIn,
    'role === "admin" && school.onboardingStatus !== "COMPLETED"',
    "Post sign-in must also route incomplete admin setup to onboarding.",
  );
});
