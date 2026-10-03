import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const authz = readFileSync("src/lib/authz.ts", "utf8");
const adminPage = readFileSync("src/app/(dashboard)/admin/page.tsx", "utf8");
const postSignIn = readFileSync("src/lib/auth/post-sign-in.ts", "utf8");
const onboardingService = readFileSync("src/lib/services/onboarding.ts", "utf8");
const setupClient = readFileSync("src/components/SchoolSetupClient.tsx", "utf8");

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

test("fresh setup state resolves to a clear profile step", () => {
  assertContains(
    onboardingService,
    'if (status === "PENDING_SETUP") return "profile";',
    "Pending setup schools must default to the profile step.",
  );
  assertContains(
    onboardingService,
    "setupStep: school.setupStep ?? defaultSetupStepForStatus(school.onboardingStatus)",
    "Onboarding state must normalize old/null setup steps before reaching the UI.",
  );
  assertContains(
    setupClient,
    'setupStep: string | null;',
    "Setup UI must receive the current setup step.",
  );
  assertContains(
    setupClient,
    "Current setup stage:",
    "Setup UI must tell admins where they are in the setup flow.",
  );
});
