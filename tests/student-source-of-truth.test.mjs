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

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20261001110000_add_student_source_truth/migration.sql");
const userManagement = read("src/lib/services/user-management.ts");
const studentApi = read("src/app/api/students/route.ts");
const studentApiUpdate = read("src/app/api/students/[id]/route.ts");
const studentForm = read("src/components/StudentForm.tsx");
const legacyActions = read("src/lib/actions/actions.ts");
const seed = read("prisma/seed.ts");
const studentListPage = read("src/app/(dashboard)/list/students/page.tsx");
const studentDetailPage = read("src/app/(dashboard)/list/students/[id]/page.tsx");
const studentImportService = read("src/lib/services/student-import.ts");
const studentImportAction = read("src/lib/actions/studentImportActions.ts");
const studentImportPage = read("src/app/(dashboard)/list/students/import/page.tsx");
const studentImportForm = read("src/components/StudentImportForm.tsx");
const parentStudentRelationships = read("src/lib/services/parent-student-relationships.ts");
const parentRelationshipActions = read("src/lib/actions/parentRelationshipActions.ts");
const parentInvites = read("src/lib/services/parent-invites.ts");

test("student records have lifecycle and admission source of truth", () => {
  assertContains(schema, "enum StudentStatus", "Student lifecycle must be modeled explicitly.");
  assertContains(schema, "admissionNumber String?", "Student admission number must exist on Student.");
  assertContains(schema, "status          StudentStatus @default(ACTIVE)", "Student status must default to ACTIVE.");
  assertContains(schema, "@@unique([schoolId, admissionNumber])", "Admission number must be unique per school.");
  assertContains(migration, "CREATE TYPE \"StudentStatus\"", "Migration must create the StudentStatus enum.");
  assertContains(migration, "Student_schoolId_admissionNumber_key", "Migration must add per-school admission uniqueness.");
});

test("new student onboarding creates records, not Clerk student accounts", () => {
  const createStudentBlock = userManagement.slice(
    userManagement.indexOf("export async function createStudent"),
    userManagement.indexOf("export async function createParent"),
  );
  assertContains(createStudentBlock, "admissionNumber", "Student creation must use admission number.");
  assertContains(createStudentBlock, "randomUUID", "Student creation must create an internal record id.");
  assertContains(createStudentBlock, "studentRecordUsername", "Legacy username must be derived internally.");
  assertContains(createStudentBlock, "prisma.$transaction", "Student creation must create the student and parent link atomically.");
  assertContains(createStudentBlock, "syncParentRelationshipsForStudentLifecycle", "Student creation must create the parent link through lifecycle sync.");
  assertContains(studentApi, "{ userId }", "Student creation audit must use the signed-in admin as actor.");
  assertNotContains(createStudentBlock, "clerk.users.createUser", "Student creation must not create a Clerk user yet.");
  assertContains(studentApi, "admissionNumber: formData.get(\"admissionNumber\")", "Student create API must accept admission number.");
  assertNotContains(studentApi, "password: formData.get(\"password\")", "Student create API must not ask for student login password.");
});

test("student updates and forms expose status without restoring account fields", () => {
  assertContains(studentApiUpdate, "status: formData.get(\"status\")", "Student update API must accept lifecycle status.");
  assertNotContains(studentApiUpdate, "status: formData.get(\"status\") || \"ACTIVE\"", "Student update API must not silently activate incomplete records.");
  assertContains(studentForm, "Admission Number", "Student form must show admission number.");
  assertContains(studentForm, "Student Status", "Student form must expose lifecycle status on update.");
  assertNotContains(studentForm, "Password", "Student form must not expose student password.");
  assertNotContains(studentForm, "Username", "Student form must not expose student username.");
});

test("seeded demo students follow the same source-of-truth rules", () => {
  assertContains(seed, "StudentStatus", "Seed script must set student lifecycle status explicitly.");
  assertContains(seed, "const admissionNumber", "Seed script must create admission numbers for demo students.");
  assertContains(seed, "admissionNumber,", "Seeded students must store admission numbers.");
});

test("student delete is blocked in favor of lifecycle status", () => {
  const deleteStudentBlock = legacyActions.slice(
    legacyActions.indexOf("export async function deleteStudent"),
    legacyActions.indexOf("// ═══════════════════════════════════════════════════════════════════════════════", legacyActions.indexOf("export async function deleteStudent")),
  );
  assertContains(deleteStudentBlock, "Student records cannot be deleted", "Student deletion must be blocked.");
  assertNotContains(deleteStudentBlock, "prisma.student.delete", "Student delete action must not hard-delete records.");
  assertNotContains(studentListPage, "type=\"delete\"", "Student list must not show casual delete controls.");
});

test("student list is an operational source-of-truth page", () => {
  assertContains(studentListPage, "STUDENT_STATUS_LABELS", "Student list must show lifecycle status.");
  assertContains(studentListPage, "STUDENT_STATUS_DOTS", "Student list must not show one misleading status dot for every lifecycle state.");
  assertContains(studentListPage, "name=\"classId\"", "Student list must support class filtering.");
  assertContains(studentListPage, "name=\"status\"", "Student list must support status filtering.");
  assertContains(studentListPage, "Missing Admission", "Student list must expose admission-number gaps.");
  assertContains(studentListPage, "No contact saved", "Student list must safely handle missing parent contact.");
  assertContains(studentListPage, "status: StudentStatus.ACTIVE", "Teacher student scope must exclude non-active student records.");
  assertContains(studentListPage, "View profile", "Mobile student cards must keep a clear profile action.");
});

test("student detail page respects source-of-truth and access rules", () => {
  assertContains(studentDetailPage, "student.status !== StudentStatus.ACTIVE", "Teachers must not open non-active student profiles.");
  assertContains(studentDetailPage, "canViewParentContact", "Parent contact must be gated by role/class-teacher responsibility.");
  assertContains(studentDetailPage, "student:      { status: StudentStatus.ACTIVE }", "Class position must exclude inactive students.");
  assertContains(studentDetailPage, "No published timetable lessons", "Student profile must explain missing published timetable data.");
  assertNotContains(studentDetailPage, "student.results", "Student profile must not fall back to old Result.score data for CA averages.");
});

test("student bulk import keeps intake strict and account-free", () => {
  assertContains(studentListPage, "/list/students/import", "Student list must expose the import workflow to admins.");
  assertContains(studentImportPage, "Download template", "Student import page must provide a CSV template.");
  assertContains(studentImportForm, "accept=\".csv,text/csv\"", "Student import form must accept CSV files only.");
  assertContains(studentImportAction, "requireRole([\"admin\"])", "Student import must be admin-only.");
  assertContains(studentImportAction, "MAX_IMPORT_FILE_BYTES", "Student import must limit upload size.");
  assertContains(studentImportService, "REQUIRED_HEADERS", "Student import must define required columns.");
  assertContains(studentImportService, "if (rowErrors.length > 0)", "Student import must reject invalid files before writing.");
  assertContains(studentImportService, "values.length > headers.length", "Student import must reject malformed CSV rows with extra values.");
  assertContains(studentImportService, "parentContactByEmail", "Student import must detect inconsistent guardian contacts inside the CSV.");
  assertContains(studentImportService, "resolveExistingParentForRow", "Student import must not guess when guardian email and phone match different existing parents.");
  assertContains(studentImportService, "prisma.$transaction", "Student import must write in a database transaction.");
  assertContains(studentImportService, "admissionNumber: { in: admissionNumbers }", "Student import must block duplicate admission numbers.");
  assertContains(studentImportService, "parentStudentRelationship.upsert", "Student import must link guardians to imported students.");
  assertNotContains(studentImportService, "clerk.users.createUser", "Student import must not create student login accounts.");
});

test("student lifecycle changes synchronize parent access safely", () => {
  const updateStudentBlock = userManagement.slice(
    userManagement.indexOf("export async function updateStudent"),
    userManagement.indexOf("export async function updateParent"),
  );

  assertContains(updateStudentBlock, "prisma.$transaction", "Student lifecycle updates must be transactional.");
  assertContains(updateStudentBlock, "syncParentRelationshipsForStudentLifecycle", "Student lifecycle updates must sync parent access.");
  assertContains(studentApiUpdate, "{ userId }", "Student lifecycle audit must use the signed-in admin as actor.");
  assertContains(parentStudentRelationships, "parentRelationshipStatusForStudentLifecycle", "Student lifecycle must map to relationship status.");
  assertContains(parentStudentRelationships, "if (status === \"TRANSFERRED\") return \"TRANSFERRED\"", "Transferred students must transfer parent relationship access.");
  assertContains(parentStudentRelationships, "if (status === \"GRADUATED\") return \"GRADUATED\"", "Graduated students must graduate parent relationship access.");
  assertContains(parentStudentRelationships, "return \"REMOVED\"", "Incomplete or withdrawn students must not remain visible to parents.");
  assertContains(parentStudentRelationships, "student: { schoolId, status: \"ACTIVE\" }", "Active parent relationship reads must also require an active student record.");
  assertContains(parentStudentRelationships, "where: { schoolId, parentId, status: \"ACTIVE\" }", "Legacy parent-child fallback must not expose inactive students.");
  assertContains(parentStudentRelationships, "canViewFees: isActive", "Inactive lifecycle statuses must remove fee access.");
  assertContains(parentStudentRelationships, "canViewReports: isActive", "Inactive lifecycle statuses must remove report access.");
  assertContains(parentStudentRelationships, "canMessageSchool: isActive", "Inactive lifecycle statuses must remove messaging access.");
  assertContains(parentStudentRelationships, "Primary guardian changed from the student profile.", "Changing the primary parent must close the old primary relationship.");
  assertContains(parentStudentRelationships, "previousRelationshipRole", "Primary guardian role changes must be visible in audit metadata.");
  assertContains(parentStudentRelationships, "writeParentAccessAudit", "Lifecycle relationship changes must be audited.");
  assertNotContains(updateStudentBlock, "await ensurePrimaryParentStudentRelationship({", "Student update must not blindly reactivate parent access.");
});

test("parent link and invite workflows cannot reactivate inactive students", () => {
  assertContains(parentRelationshipActions, "student.status !== \"ACTIVE\"", "Manual parent-ward linking must reject inactive wards.");
  assertContains(parentRelationshipActions, "relationship.student.status !== \"ACTIVE\"", "Manual parent access restore must reject inactive wards.");
  assertContains(parentInvites, "status: \"ACTIVE\"", "Parent invite creation must only include active wards.");
  assertContains(parentInvites, "student.status !== \"ACTIVE\"", "Parent invite acceptance must reject wards that became inactive after invite creation.");
});
