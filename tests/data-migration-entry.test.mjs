import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migrationPage = readFileSync(
  "src/app/(dashboard)/admin/data-migration/page.tsx",
  "utf8",
);
const migrationService = readFileSync(
  "src/lib/services/data-migration.ts",
  "utf8",
);
const menuClient = readFileSync("src/components/MenuClient.tsx", "utf8");

function assertContains(source, needle, message) {
  assert.ok(source.includes(needle), message);
}

function assertNotContains(source, needle, message) {
  assert.ok(!source.includes(needle), message);
}

test("data migration entry point is admin-only and school-scoped", () => {
  assertContains(
    migrationPage,
    'requirePageSession(["admin"])',
    "Data migration page must be restricted to admins.",
  );
  assertContains(
    menuClient,
    'href: "/admin/data-migration"',
    "Admin menu must expose the data migration control center.",
  );
  assertContains(
    menuClient,
    'visible: ["admin"]',
    "Data migration menu entry must be admin-only.",
  );
  assertContains(
    migrationService,
    "getDataMigrationDashboard(\n  schoolId: string,",
    "Migration dashboard service must receive the caller school id.",
  );
  assertContains(
    migrationService,
    "where: { schoolId",
    "Migration status queries must be scoped to the school.",
  );
});

test("data migration point 1 remains a read-only control center", () => {
  for (const forbiddenWrite of [
    ".create(",
    ".createMany(",
    ".update(",
    ".updateMany(",
    ".upsert(",
    ".delete(",
    ".deleteMany(",
  ]) {
    assertNotContains(
      migrationService,
      forbiddenWrite,
      `Point 1 migration service must not write live data through ${forbiddenWrite}.`,
    );
    assertNotContains(
      migrationPage,
      forbiddenWrite,
      `Point 1 migration page must not write live data through ${forbiddenWrite}.`,
    );
  }

  assertContains(
    migrationPage,
    "Step 1 is the control center only.",
    "Page must clearly explain that step 1 is not the import engine.",
  );
  assertContains(
    migrationPage,
    "no uploaded spreadsheet data is written into live Edujay records",
    "Page must warn admins that uploads/mapping are not active yet.",
  );
});

test("data migration status catches parent-link and audit metadata risks", () => {
  assertContains(
    migrationService,
    "parentsWithoutActiveWardLinks",
    "Parent readiness must count parents without active ward links, not rough profile totals.",
  );
  assertContains(
    migrationService,
    "studentRelationships: {\n          none: { schoolId, status: \"ACTIVE\" },",
    "Parent cleanup check must be school-scoped and based on active ward links.",
  );
  assertContains(
    migrationService,
    "Math.max(0, Math.trunc(value))",
    "Imported audit row counts must be sanitized before display.",
  );
  assertContains(
    migrationService,
    "const trimmed = value.trim();",
    "Import audit text metadata must be trimmed before display.",
  );
});
