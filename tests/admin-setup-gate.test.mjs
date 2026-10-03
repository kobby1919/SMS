import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const authz = readFileSync("src/lib/authz.ts", "utf8");
const adminPage = readFileSync("src/app/(dashboard)/admin/page.tsx", "utf8");
const postSignIn = readFileSync("src/lib/auth/post-sign-in.ts", "utf8");
const onboardingService = readFileSync("src/lib/services/onboarding.ts", "utf8");
const setupPage = readFileSync("src/app/onboarding/setup/page.tsx", "utf8");
const setupClient = readFileSync("src/components/SchoolSetupClient.tsx", "utf8");
const setupStages = readFileSync("src/lib/onboarding/setup-stages.ts", "utf8");
const stageShell = readFileSync("src/components/OnboardingStageShell.tsx", "utf8");
const setupPathPage = readFileSync("src/app/onboarding/setup/path/page.tsx", "utf8");
const setupPathChooser = readFileSync("src/components/SetupPathChooser.tsx", "utf8");
const freshSetupWorkspace = readFileSync("src/components/FreshSetupWorkspace.tsx", "utf8");
const readinessReviewWorkspace = readFileSync("src/components/ReadinessReviewWorkspace.tsx", "utf8");
const completionWorkspace = readFileSync("src/components/OnboardingCompletionWorkspace.tsx", "utf8");
const onboardingActions = readFileSync("src/lib/actions/onboardingActions.ts", "utf8");
const onboardingValidation = readFileSync("src/lib/validation/onboarding.ts", "utf8");
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
    onboardingService,
    'setupStep: "path"',
    "Saving the identity stage must move the school to setup path selection.",
  );
  assertContains(
    onboardingService,
    'if (status === "ACADEMIC_DONE") return "fresh";',
    "Academic setup completion must keep admins inside the fresh setup stage.",
  );
});

test("school identity page stays focused on school identity only", () => {
  assertContains(
    setupPage,
    'setupStageNav("profile")',
    "The first onboarding page must be the profile/identity stage.",
  );
  assertContains(
    setupClient,
    "School identity",
    "Setup client must present school identity as the first task.",
  );
  assertContains(
    setupClient,
    'router.push("/onboarding/setup/path")',
    "Saving school identity must move the admin to setup path selection.",
  );
  assertNotContains(
    setupClient,
    "/admin/data-migration",
    "School identity page must not link to migration before path selection.",
  );
  assertNotContains(
    setupClient,
    "Finish setup",
    "School identity page must not unlock the dashboard or finish onboarding.",
  );
  assertNotContains(
    setupClient,
    "Create default academics",
    "School identity page must not mix academic setup into the first stage.",
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

test("setup path selection is saved before routing to the next stage", () => {
  assertContains(
    setupPathPage,
    "SetupPathChooser",
    "The setup path page must use the guarded chooser instead of raw links.",
  );
  assertContains(
    setupPathChooser,
    "selectSchoolSetupPathAction",
    "Path selection must call a server action before navigation.",
  );
  assertContains(
    setupPathChooser,
    'router.push(option?.href ?? "/onboarding/setup/path")',
    "Path selection must route only after the server action succeeds.",
  );
  assertContains(
    onboardingValidation,
    'z.enum(["fresh", "migration"])',
    "Only known setup paths should be accepted.",
  );
  assertContains(
    onboardingActions,
    "selectSchoolSetupPathAction",
    "A dedicated setup path action must exist.",
  );
  assertContains(
    onboardingService,
    "selectSchoolSetupPath",
    "The service layer must own setup path persistence.",
  );
  assertContains(
    onboardingService,
    'input.setupPath === "fresh" ? "fresh" : "migration"',
    "The service must persist the selected setup step.",
  );
  assertContains(
    onboardingService,
    "Save the school identity before choosing a setup path.",
    "Admins must not skip school identity before choosing the setup route.",
  );
});

test("fresh setup page is a guided workspace with a safe academic foundation action", () => {
  assertContains(
    freshSetupPage,
    "FreshSetupWorkspace",
    "The fresh setup page must use the guided workspace component.",
  );
  assertNotContains(
    freshSetupPage,
    "Pending",
    "The fresh setup page should not be a raw pending checklist.",
  );
  assertContains(
    freshSetupWorkspace,
    "createDefaultAcademicSetupAction",
    "Fresh setup must use the existing guarded server action for default academics.",
  );
  assertContains(
    freshSetupWorkspace,
    "/list/classes",
    "Fresh setup must link admins to class setup.",
  );
  assertContains(
    freshSetupWorkspace,
    "/list/teachers",
    "Fresh setup must link admins to teacher setup.",
  );
  assertContains(
    freshSetupWorkspace,
    "/admin/payment-settings",
    "Fresh setup must link admins to finance setup.",
  );
  assertContains(
    freshSetupWorkspace,
    "/admin/timetable",
    "Fresh setup must link admins to timetable setup.",
  );
  assertContains(
    onboardingService,
    'setupStep: "fresh"',
    "Creating default academics must keep the school in the fresh setup stage.",
  );
});

test("readiness review is a real checkpoint before completion", () => {
  assertContains(
    reviewPage,
    "ReadinessReviewWorkspace",
    "The review page must use the dedicated readiness workspace.",
  );
  assertNotContains(
    reviewPage,
    "will become",
    "The review page must not use placeholder production language.",
  );
  assertContains(
    readinessReviewWorkspace,
    "readyRequired === requiredChecks.length",
    "Completion should depend on all required checks passing.",
  );
  assertContains(
    readinessReviewWorkspace,
    "Grades, classes, and subjects must exist",
    "The review page must explain the required academic foundation.",
  );
  assertContains(
    readinessReviewWorkspace,
    "/onboarding/setup/complete",
    "The review page must provide a completion route only when ready.",
  );
  assertContains(
    readinessReviewWorkspace,
    "/onboarding/setup/fresh",
    "The review page must send incomplete setup back to the fresh setup workspace.",
  );
});

test("completion stage completes onboarding before entering dashboard", () => {
  assertContains(
    completePage,
    "OnboardingCompletionWorkspace",
    "Completion page must use the guarded completion workspace.",
  );
  assertContains(
    completePage,
    'school.onboardingStatus === "COMPLETED"',
    "Already completed schools should leave the setup flow.",
  );
  assertNotContains(
    completePage,
    'href="/admin"',
    "Completion page must not be a raw link to the admin dashboard.",
  );
  assertContains(
    completionWorkspace,
    "completeSchoolOnboardingAction",
    "Completion must call the server action that marks onboarding complete.",
  );
  assertContains(
    completionWorkspace,
    'router.push("/admin")',
    "The dashboard should open only after completion succeeds.",
  );
  assertContains(
    onboardingService,
    'onboardingStatus: "COMPLETED"',
    "Completion service must mark the school onboarding status as completed.",
  );
  assertContains(
    onboardingService,
    "setupCompletedAt: new Date()",
    "Completion service must timestamp setup completion.",
  );
});
