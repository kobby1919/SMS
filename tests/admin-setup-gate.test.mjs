import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const authz = readFileSync("src/lib/authz.ts", "utf8");
const adminPage = readFileSync("src/app/(dashboard)/admin/page.tsx", "utf8");
const postSignIn = readFileSync("src/lib/auth/post-sign-in.ts", "utf8");
const onboardingService = readFileSync("src/lib/services/onboarding.ts", "utf8");
const setupClient = readFileSync("src/components/SchoolSetupClient.tsx", "utf8");
const setupStages = readFileSync("src/lib/onboarding/setup-stages.ts", "utf8");
const stageShell = readFileSync("src/components/OnboardingStageShell.tsx", "utf8");
const setupPathPage = readFileSync("src/app/onboarding/setup/path/page.tsx", "utf8");
const freshSetupPage = readFileSync("src/app/onboarding/setup/fresh/page.tsx", "utf8");
const reviewPage = readFileSync("src/app/onboarding/setup/review/page.tsx", "utf8");
const completePage = readFileSync("src/app/onboarding/setup/complete/page.tsx", "utf8");

function assertContains(source, needle, message) {
  assert.ok(source.includes(needle), message);
}

function assertNotContains(source, needle, message) {
  assert.ok(!source.includes(needle), message);
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

test("setup page sends real imports to the data migration workspace", () => {
  assertContains(
    setupClient,
    'href="/admin/data-migration"',
    "Setup page must send admins to the real data migration workspace.",
  );
  assertContains(
    setupClient,
    "students, parents",
    "Setup page must explain that migration covers more than teachers and students.",
  );
  assertNotContains(
    setupClient,
    "Import checkpoint",
    "Setup page must not show a fake/manual import checkpoint.",
  );
  assertNotContains(
    setupClient,
    "recordOnboardingImportAction",
    "Setup page must not record pretend imports from the onboarding page.",
  );
});

test("guided admin onboarding routes are structured and protected", () => {
  for (const route of [
    "/onboarding/setup",
    "/onboarding/setup/path",
    "/onboarding/setup/fresh",
    "/admin/data-migration",
    "/onboarding/setup/review",
    "/onboarding/setup/complete",
  ]) {
    assertContains(
      setupStages,
      route,
      `Setup stage registry must include ${route}.`,
    );
  }

  for (const page of [setupPathPage, freshSetupPage, reviewPage, completePage]) {
    assertContains(
      page,
      'requirePageSession(["admin"])',
      "Each guided onboarding stage must be admin protected.",
    );
    assertContains(
      page,
      "OnboardingStageShell",
      "Each guided onboarding stage must use the shared stage shell.",
    );
  }

  assertContains(
    stageShell,
    "stages.map",
    "The shell must render a consistent step list.",
  );
});
