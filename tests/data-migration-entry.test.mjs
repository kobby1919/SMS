import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migrationPage = readFileSync(
  "src/app/(dashboard)/admin/data-migration/page.tsx",
  "utf8",
);
const migrationSetupPage = readFileSync(
  "src/app/onboarding/setup/migration/page.tsx",
  "utf8",
);
const migrationService = readFileSync(
  "src/lib/services/data-migration.ts",
  "utf8",
);
const migrationMapper = readFileSync("src/components/DataMigrationMapper.tsx", "utf8");
const migrationMappingConfig = readFileSync("src/lib/migration/column-mapping.ts", "utf8");
const migrationValidationRoute = readFileSync(
  "src/app/api/admin/data-migration/validate/route.ts",
  "utf8",
);
const migrationImportRoute = readFileSync(
  "src/app/api/admin/data-migration/import/route.ts",
  "utf8",
);
const migrationValidationService = readFileSync(
  "src/lib/services/data-migration-validation.ts",
  "utf8",
);
const migrationImportService = readFileSync(
  "src/lib/services/data-migration-import.ts",
  "utf8",
);
const migrationAuditService = readFileSync(
  "src/lib/services/data-migration-audit.ts",
  "utf8",
);
const migrationAuditActions = readFileSync(
  "src/components/MigrationAuditActions.tsx",
  "utf8",
);
const migrationAuditProblematicRoute = readFileSync(
  "src/app/api/admin/data-migration/audit/[id]/problematic/route.ts",
  "utf8",
);
const migrationAuditErrorReportRoute = readFileSync(
  "src/app/api/admin/data-migration/audit/[id]/error-report/route.ts",
  "utf8",
);
const postImportInviteService = readFileSync(
  "src/lib/services/post-import-invites.ts",
  "utf8",
);
const postImportInviteRoute = readFileSync(
  "src/app/api/admin/data-migration/invites/route.ts",
  "utf8",
);
const postImportInvitePanel = readFileSync(
  "src/components/PostImportInvitePanel.tsx",
  "utf8",
);
const teacherInviteService = readFileSync("src/lib/services/teacher-invites.ts", "utf8");
const parentInviteService = readFileSync("src/lib/services/parent-invites.ts", "utf8");
const bursarInviteService = readFileSync("src/lib/services/bursar-invites.ts", "utf8");
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
    "Dashboard data migration page must be restricted to admins.",
  );
  assertContains(
    migrationSetupPage,
    'requirePageSession(["admin"])',
    "Onboarding data migration page must be restricted to admins.",
  );
  assertNotContains(
    menuClient,
    "/admin/data-migration",
    "Admin menu must not expose data migration under Management.",
  );
  assertContains(
    migrationPage,
    'redirect("/onboarding/setup/migration")',
    "Incomplete migration admins must be moved out of the dashboard shell.",
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
    "FormData",
    "Migration mapper must not submit raw spreadsheet files as form data.",
  );

  assertContains(
    migrationPage,
    "Migration checklist",
    "Page must guide admins through the migration order before upload/import.",
  );
  assertContains(
    migrationPage,
    "Only clean rows enter the live school records; problem rows stay out.",
    "Page must clearly explain that only clean rows enter live records.",
  );
});

test("data migration point 3 validates rows without importing", () => {
  assertContains(
    migrationMapper,
    "/api/admin/data-migration/validate",
    "Point 3 mapper must call the read-only validation endpoint.",
  );
  assertContains(
    migrationMapper,
    "Validate rows",
    "Point 3 UI must expose validation before import.",
  );
  assertContains(
    migrationMapper,
    "readyRows",
    "Point 3 UI must show rows ready for future import.",
  );
  assertContains(
    migrationMapper,
    "skippedRows",
    "Point 3 UI must show skipped rows.",
  );
  assertContains(
    migrationMapper,
    "correctionRows",
    "Point 3 UI must show rows needing correction.",
  );
  assertContains(
    migrationMapper,
    "warningRows",
    "Point 3 UI must show validation warnings.",
  );
  assertContains(
    migrationValidationRoute,
    'requireRole(["admin"])',
    "Point 3 validation route must be admin-only.",
  );
  assertContains(
    migrationValidationRoute,
    "migrationValidationPayloadSchema.safeParse",
    "Point 3 validation route must validate untrusted request payloads.",
  );
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
      migrationValidationService,
      forbiddenWrite,
      `Point 3 validation service must not write live data through ${forbiddenWrite}.`,
    );
    assertNotContains(
      migrationValidationRoute,
      forbiddenWrite,
      `Point 3 validation route must not write live data through ${forbiddenWrite}.`,
    );
  }
  for (const requiredGuard of [
    "Save the school code before importing students.",
    "validateAdmissionNumberForSchool",
    "Student already exists in Edujay",
    "Class name does not exist in Edujay yet",
    "Ward admission number does not match an existing Edujay student",
    "Sex must be Male or Female",
    "Guardian sex must be Male or Female",
    "Email address is not valid",
    "Fee amount must be a positive number",
    "Fee row for this student/term/year",
    "Guardian email already exists in Edujay",
    "appears more than once in this upload",
  ]) {
    assertContains(
      migrationValidationService,
      requiredGuard,
      `Point 3 validation must include guard: ${requiredGuard}.`,
    );
  }
  assertContains(
    migrationValidationRoute,
    "MAX_VALIDATION_PAYLOAD_BYTES",
    "Point 3 validation route must reject oversized validation payloads.",
  );
});

test("data migration point 4 imports only clean validated rows", () => {
  assertContains(
    migrationMapper,
    "/api/admin/data-migration/import",
    "Point 4 mapper must call the safe import endpoint.",
  );
  assertContains(
    migrationMapper,
    "Import clean rows",
    "Point 4 UI must make clear only clean rows are imported.",
  );
  assertContains(
    migrationMapper,
    "Rows with warnings, corrections, or skip markers stay outside live records",
    "Point 4 UI must explain warning and dirty rows stay outside live records.",
  );
  assertContains(
    migrationImportRoute,
    'requireRole(["admin"])',
    "Point 4 import route must be admin-only.",
  );
  assertContains(
    migrationImportRoute,
    "migrationValidationPayloadSchema.safeParse",
    "Point 4 import route must validate untrusted import payloads.",
  );
  assertContains(
    migrationImportRoute,
    "MAX_IMPORT_PAYLOAD_BYTES",
    "Point 4 import route must reject oversized import payloads.",
  );
  assertContains(
    migrationImportService,
    "validateMigrationRows(context)",
    "Point 4 import must re-run server validation before writing live records.",
  );
  assertContains(
    migrationImportService,
    'row.status === "READY" && row.issues.length === 0',
    "Point 4 import must select only clean issue-free rows for live import.",
  );
  assertContains(
    migrationImportService,
    'row.status !== "READY" || row.issues.length > 0',
    "Point 4 import must report warning rows as dirty rows instead of silently hiding them.",
  );
  assertContains(
    migrationImportService,
    "dirtyRows",
    "Point 4 import must return dirty rows without importing them.",
  );
  assertContains(
    migrationImportService,
    "Multiple parent records match this guardian contact",
    "Point 4 import must stop when guardian contact data matches multiple parent records.",
  );
  assertContains(
    migrationImportService,
    "sex: normalizeSex(values.guardianSex || values.sex)",
    "Point 4 import must persist guardian sex so parent titles are correct.",
  );
  assertContains(
    migrationImportService,
    "Fee item already exists with a different amount",
    "Point 4 import must stop when an imported fee line conflicts with an existing fee item.",
  );
  assertContains(
    migrationImportService,
    "affectedBillIds.size",
    "Point 4 import must report affected fee bills instead of counting fee rows as bills.",
  );
  assertContains(
    migrationImportRoute,
    'error.code === "P2002"',
    "Point 4 import route must return a controlled conflict response for database uniqueness races.",
  );
  assertContains(
    migrationImportService,
    "IMPORT_RECORDED",
    "Point 4 import must record an audit log.",
  );
  assertContains(
    migrationImportService,
    "parentStudentRelationship.upsert",
    "Point 4 import must create or restore parent-student relationships safely.",
  );
});

test("data migration point 5 bulk-invites imported profiles safely", () => {
  assertContains(
    migrationPage,
    "<PostImportInvitePanel summary={inviteSummary} />",
    "Point 5 panel must be shown on the data migration page.",
  );
  assertContains(
    postImportInviteRoute,
    'requireRole(["admin"])',
    "Point 5 bulk invite route must be admin-only.",
  );
  assertContains(
    postImportInviteRoute,
    'z.enum(["teachers", "parents", "bursars"])',
    "Point 5 bulk invite route must only accept supported role types.",
  );
  assertContains(
    postImportInviteService,
    "importedNeedsInvite",
    "Point 5 summary must expose imported-needs-invite counts.",
  );
  assertContains(
    postImportInviteService,
    "post_import_bulk_invite",
    "Point 5 invite records must be marked as post-import bulk invites in audit metadata.",
  );
  assertContains(
    postImportInviteService,
    "sex: teacherSex",
    "Point 5 teacher bulk invites must preserve imported teacher sex for titles.",
  );
  assertContains(
    postImportInviteService,
    "sex: parent.sex",
    "Point 5 parent bulk invites must preserve imported parent sex for titles.",
  );
  assertContains(
    postImportInviteService,
    "sex: bursar.sex",
    "Point 5 bursar bulk invites must preserve imported bursar sex for titles.",
  );
  assertContains(
    postImportInviteService,
    "activeTeacherInviteEmails",
    "Point 5 must avoid duplicate active teacher invites.",
  );
  assertContains(
    postImportInviteService,
    "activeParentInviteEmails",
    "Point 5 must avoid duplicate active parent invites.",
  );
  assertContains(
    postImportInviteService,
    "activeBursarInviteEmails",
    "Point 5 must avoid duplicate active bursar invites.",
  );
  assertContains(
    postImportInviteService,
    "pushUniqueEmail",
    "Point 5 must skip duplicate imported profiles sharing one email inside the same bulk run.",
  );
  assertContains(
    postImportInviteService,
    "hasTeacherInviteConflict",
    "Point 5 must re-check teacher invite conflicts inside the write transaction.",
  );
  assertContains(
    postImportInviteService,
    "hasParentInviteConflict",
    "Point 5 must re-check parent invite conflicts inside the write transaction.",
  );
  assertContains(
    postImportInviteService,
    "hasBursarInviteConflict",
    "Point 5 must re-check bursar invite conflicts inside the write transaction.",
  );
  assertContains(
    postImportInvitePanel,
    "Imported teachers, parents, and bursars do not get login access automatically",
    "Point 5 UI must explain that import does not create login access.",
  );
  assertContains(
    postImportInvitePanel,
    "Send {item.label.toLowerCase()} invites",
    "Point 5 UI must expose a role-specific bulk invite action.",
  );
  assertContains(
    teacherInviteService,
    "importedTeacher",
    "Teacher invite acceptance must be able to claim an imported teacher profile.",
  );
  assertContains(
    parentInviteService,
    "importedParent",
    "Parent invite acceptance must be able to claim an imported parent profile.",
  );
  assertContains(
    parentInviteService,
    "sex: invite.sex",
    "Parent invite acceptance must keep the invited sex on the active parent profile.",
  );
  assertContains(
    bursarInviteService,
    "importedBursar",
    "Bursar invite acceptance must be able to claim an imported bursar profile.",
  );
});

test("data migration point 6 records audit batches and controlled review actions", () => {
  assertContains(
    migrationImportRoute,
    "fileName: parsed.data.fileName",
    "Point 6 import route must pass uploaded file names into audit metadata.",
  );
  assertContains(
    migrationImportService,
    "batchId",
    "Point 6 imports must create a stable audit batch id.",
  );
  assertContains(
    migrationImportService,
    "buildDirtyRowReport(dirtyRows)",
    "Point 6 imports must store skipped/correction row evidence for error reports.",
  );
  assertContains(
    migrationImportService,
    'status: "COMPLETED"',
    "Point 6 completed imports must store a clear audit status.",
  );
  assertContains(
    migrationAuditService,
    "markMigrationBatchProblematic",
    "Point 6 must support marking an import batch as problematic instead of deleting data.",
  );
  assertContains(
    migrationAuditService,
    "buildMigrationErrorReportCsv",
    "Point 6 must support exporting an import error report.",
  );
  assertContains(
    migrationAuditService,
    "/^[=+\\-@\\t\\r]/.test(raw)",
    "Point 6 CSV exports must neutralize spreadsheet formula injection.",
  );
  assertContains(
    migrationAuditProblematicRoute,
    'requireRole(["admin"])',
    "Point 6 problematic route must be admin-only.",
  );
  assertContains(
    migrationAuditErrorReportRoute,
    'requireRole(["admin"])',
    "Point 6 error report route must be admin-only.",
  );
  assertContains(
    migrationAuditActions,
    "Mark problematic",
    "Point 6 UI must expose a deliberate mark-problematic action.",
  );
  assertContains(
    migrationPage,
    "<MigrationAuditActions",
    "Point 6 page must expose audit safety actions beside recent import records.",
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
    "Review the validation results carefully.",
    "Point 2 UI must tell admins to review validation results before import.",
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
    '{ key: "parentEmail", label: "Guardian email", required: true',
    "Student migration must require guardian email because parent invites depend on email.",
  );
  assertContains(
    migrationMappingConfig,
    '{ key: "email", label: "Email", required: true, aliases: ["email", "email address"], help: "Required for parent invite/login access." }',
    "Parent migration must require email because parent invites depend on email.",
  );
  assertContains(
    migrationValidationService,
    "Guardian email is required for parent invite/login access.",
    "Student migration validation must block guardian records without invite email.",
  );
  assertContains(
    migrationValidationService,
    "Parent email is required for invite/login access.",
    "Parent migration validation must block parent records without invite email.",
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

test("data migration point 7 keeps admin experience as a simple checklist", () => {
  for (const checklistItem of [
    "Upload",
    "Map columns",
    "Review issues",
    "Import clean records",
    "Send invites",
  ]) {
    assertContains(
      migrationPage,
      checklistItem,
      `Point 7 checklist must include ${checklistItem}.`,
    );
  }
  assertContains(
    migrationPage,
    "upload, map, review, import, then invite",
    "Point 7 page must explain the simple migration order.",
  );
  assertContains(
    migrationMapper,
    "Step 1 and 2",
    "Point 7 mapper must label upload and mapping as the first two steps.",
  );
  assertContains(
    migrationMapper,
    "Step 3: Review issues",
    "Point 7 mapper must label validation as issue review.",
  );
  assertContains(
    migrationMapper,
    "Step 4: Import clean records",
    "Point 7 mapper must label safe import as the clean-record import step.",
  );
  assertContains(
    postImportInvitePanel,
    "Step 5",
    "Point 7 invite panel must appear as the final checklist step.",
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
