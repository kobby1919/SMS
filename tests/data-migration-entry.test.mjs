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
const migrationMapper = readFileSync("src/components/DataMigrationMapper.tsx", "utf8");
const migrationMappingConfig = readFileSync("src/lib/migration/column-mapping.ts", "utf8");
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

  assertNotContains(
    migrationMapper,
    "fetch(",
    "Point 2 mapper must not send uploaded files to the server yet.",
  );
  assertNotContains(
    migrationMapper,
    "FormData",
    "Point 2 mapper must not submit spreadsheet data yet.",
  );

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

test("data migration point 2 supports upload and mapping without saving", () => {
  assertContains(
    migrationPage,
    "<DataMigrationMapper />",
    "Data migration page must show the upload and mapping step.",
  );
  assertContains(
    migrationMapper,
    "accept=\".csv,text/csv\"",
    "Point 2 upload must be restricted to CSV until Excel parsing is deliberately added.",
  );
  assertContains(
    migrationMapper,
    "MAX_MAPPING_FILE_BYTES",
    "Point 2 mapper must limit file size before reading.",
  );
  assertContains(
    migrationMapper,
    "suggestColumnMapping(parsed.headers, area)",
    "Point 2 mapper must suggest mappings from detected CSV headers.",
  );
  assertContains(
    migrationMapper,
    "missingRequiredFields",
    "Point 2 mapper must show required-field gaps before validation.",
  );
  assertContains(
    migrationMapper,
    "duplicateMappedHeaders",
    "Point 2 mapper must catch duplicate mapped columns.",
  );
  assertContains(
    migrationMapper,
    "csvIssues",
    "Point 2 mapper must block structurally unsafe CSV files before validation.",
  );
  assertContains(
    migrationMapper,
    "hasUnclosedQuote",
    "Point 2 mapper must detect unclosed CSV quotes.",
  );
  assertContains(
    migrationMapper,
    "Header row contains a blank column name",
    "Point 2 mapper must reject blank CSV headers.",
  );
  assertContains(
    migrationMapper,
    "appears more than once",
    "Point 2 mapper must reject duplicate CSV headers.",
  );
  assertContains(
    migrationMapper,
    "value(s), expected",
    "Point 2 mapper must flag preview rows whose cell count does not match the header.",
  );
  assertContains(
    migrationMapper,
    "csvIssues.length === 0",
    "Point 2 mapper must prevent ready state while CSV structure issues exist.",
  );
  assertContains(
    migrationMapper,
    "displayHeader(header, index)",
    "Point 2 mapper must display unsafe blank headers clearly without unstable duplicate keys.",
  );
  assertContains(
    migrationMapper,
    "Preview sample",
    "Point 2 mapper must show a small row preview before validation.",
  );
  assertContains(
    migrationMapper,
    "This step stores nothing in the database.",
    "Point 2 UI must clearly say no records are saved.",
  );
});

test("data migration mapping config covers all migration areas", () => {
  for (const area of ["students", "parents", "teachers", "bursars", "classes", "subjects", "fees"]) {
    assertContains(
      migrationMappingConfig,
      `key: "${area}"`,
      `Mapping config must include ${area}.`,
    );
  }

  for (const requiredField of [
    "admissionNumber",
    "className",
    "parentPhone",
    "parentEmail",
    "teacherType",
    "amountPaid",
  ]) {
    assertContains(
      migrationMappingConfig,
      requiredField,
      `Mapping config must include ${requiredField}.`,
    );
  }

  assertContains(
    migrationMappingConfig,
    "buildMigrationTemplateCsv",
    "Mapping config must generate templates for admins.",
  );
  assertContains(
    migrationMappingConfig,
    "if (!normalized || normalizedHeaders.has(normalized)) continue;",
    "Mapping suggestions must avoid duplicate or blank uploaded headers.",
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

test("data migration screen guides fresh schools before showing detailed readiness", () => {
  assertContains(
    migrationService,
    "isFreshSchool",
    "Migration dashboard must detect a school with no existing operating records.",
  );
  assertContains(
    migrationPage,
    "Start School Data Setup",
    "Fresh schools should see setup language instead of only a technical migration dashboard.",
  );
  assertContains(
    migrationPage,
    "No records imported yet. Start in this order.",
    "Fresh schools must get a clear starter checklist.",
  );
  assertContains(
    migrationPage,
    "Migration areas waiting for setup",
    "Fresh schools must understand the zero-count cards are waiting areas, not errors.",
  );
  assertContains(
    migrationPage,
    "Start with classes",
    "Fresh school onboarding should guide admins to the first foundation step.",
  );
});
