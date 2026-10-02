import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assertContains(source, needle, message) {
  assert.ok(source.includes(needle), `${message}\nMissing source text: ${needle}`);
}

function assertNotContains(source, needle, message) {
  assert.ok(!source.includes(needle), `${message}\nUnexpected source text: ${needle}`);
}

const parentRelationshipActions = read("src/lib/actions/parentRelationshipActions.ts");
const parentRelationships = read("src/lib/services/parent-student-relationships.ts");
const parentWardLinkManager = read("src/components/ParentWardLinkManager.tsx");
const parentListPage = read("src/app/(dashboard)/list/parents/page.tsx");
const bursarArrears = read("src/lib/services/bursar-arrears.ts");
const classCollectionReport = read("src/lib/services/class-collection-report.ts");

test("parent link management exposes explicit school operations", () => {
  assertContains(parentWardLinkManager, "Add ward link", "Admin must be able to add a ward link.");
  assertContains(parentWardLinkManager, "Restore access", "Admin must be able to restore a valid parent-ward link.");
  assertContains(parentWardLinkManager, "Remove", "Admin must be able to remove a ward link.");
  assertContains(parentWardLinkManager, "Revoke", "Admin must be able to revoke a ward link.");
  assertContains(parentWardLinkManager, "Transferred", "Admin must be able to mark a relationship transferred.");
  assertContains(parentWardLinkManager, "Graduated", "Admin must be able to mark a relationship graduated.");
  assertNotContains(parentWardLinkManager, "STATUS_OPTIONS", "Parent link UI must not expose a raw status dropdown.");
});

test("parent link actions are server guarded and audited", () => {
  assertContains(parentRelationshipActions, "requireRole([\"admin\"])", "Only admins may change parent-ward links.");
  assertContains(parentRelationshipActions, "parseActionInput(parentRelationshipCreateSchema", "Add ward link action must use Zod validation.");
  assertContains(parentRelationshipActions, "parseActionInput(parentRelationshipStatusUpdateSchema", "Relationship status updates must use Zod validation.");
  assertContains(parentRelationshipActions, "where: { id: data.relationshipId, schoolId }", "Relationship updates must be scoped to the current school.");
  assertContains(parentRelationshipActions, "data.status === \"ACTIVE\" && relationship.student.status !== \"ACTIVE\"", "Restoring access must be blocked for inactive wards.");
  assertContains(parentRelationshipActions, "requiresRelationshipReason(data.status) && !data.note", "Non-active relationship changes must require a reason.");
  assertContains(parentRelationshipActions, "canViewFees: isActive ? data.canViewFees : false", "Inactive relationship statuses must remove fee access.");
  assertContains(parentRelationshipActions, "writeParentAccessAudit", "Every parent access change must write an audit log.");
});

test("parent dashboard access uses relationship rows as source of truth", () => {
  assertContains(parentRelationships, "status: \"ACTIVE\"", "Parent ward access must require an active relationship.");
  assertContains(parentRelationships, "student: { schoolId, status: \"ACTIVE\" }", "Parent ward access must require an active student.");
  assertContains(parentRelationships, "if (await parentHasRelationshipRows(parentId, schoolId))", "Relationship rows must disable legacy parentId fallback after migration.");
  assertContains(parentRelationships, "permissionWhere(permission)", "Parent access must honor relationship permissions.");
});

test("parent management page does not link inactive students as active wards", () => {
  assertContains(parentListPage, "where: { schoolId, status: \"ACTIVE\" }", "Add-ward dropdown must only offer active students.");
  assertContains(parentListPage, "student: { schoolId, status: \"ACTIVE\" }", "Active ward counts must require active students.");
  assertContains(parentListPage, "relationship.status === \"ACTIVE\" && relationship.student.status === \"ACTIVE\"", "Parent table active ward display must exclude inactive students.");
});

test("live finance reports exclude inactive students where appropriate", () => {
  assertContains(bursarArrears, "status: \"ACTIVE\"", "Arrears follow-up must only target active students.");
  assertContains(classCollectionReport, "student: { schoolId, status: \"ACTIVE\" }", "Class collection performance must exclude inactive students.");
});
