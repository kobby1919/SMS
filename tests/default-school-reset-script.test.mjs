import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const resetScript = readFileSync("prisma/reset-default-school-operational-data.cjs", "utf8");
const packageJson = readFileSync("package.json", "utf8");

function assertContains(source, needle, message) {
  assert.ok(source.includes(needle), message);
}

test("default-school reset script is guarded and dry-run first", () => {
  assertContains(
    packageJson,
    '"reset:default-school": "node prisma/reset-default-school-operational-data.cjs"',
    "Package scripts must expose the guarded default-school reset command.",
  );
  assertContains(
    resetScript,
    'const DEFAULT_SCHOOL_ID = "default-school";',
    "Reset script must be scoped to default-school by default.",
  );
  assertContains(
    resetScript,
    'const CONFIRMATION = "RESET_DEFAULT_SCHOOL";',
    "Reset script must require an explicit confirmation phrase.",
  );
  assertContains(
    resetScript,
    "Dry run only. Nothing was deleted.",
    "Reset script must dry-run unless explicitly confirmed.",
  );
  assertContains(
    resetScript,
    "This script only resets",
    "Reset script must refuse non-default-school targets.",
  );
});

test("default-school reset preserves school and one admin while clearing operations", () => {
  assertContains(
    resetScript,
    "chooseAdminToPreserve",
    "Reset script must choose one admin account to preserve.",
  );
  assertContains(
    resetScript,
    'where: { schoolId, id: { not: adminToPreserve.id } }',
    "Reset script must delete extra admins while preserving the selected admin.",
  );
  assertContains(
    resetScript,
    'onboardingStatus: "PENDING_SETUP"',
    "Reset script must reset the school setup status.",
  );
  for (const modelName of [
    "student",
    "parent",
    "teacher",
    "bursar",
    "class",
    "subject",
    "lesson",
    "studentBill",
    "payment",
    "appNotification",
    "parentNotification",
    "schoolInvite",
    "schoolNotificationSetting",
    "onboardingAuditLog",
  ]) {
    assertContains(
      resetScript,
      `"${modelName}"`,
      `Reset script must clear ${modelName} records for default-school.`,
    );
  }
});
