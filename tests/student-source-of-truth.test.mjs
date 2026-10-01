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
});
