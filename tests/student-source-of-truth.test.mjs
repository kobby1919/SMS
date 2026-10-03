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
const admissionNumberHelper = read("src/lib/admission-number.ts");
const parentStudentRelationships = read("src/lib/services/parent-student-relationships.ts");
const parentRelationshipActions = read("src/lib/actions/parentRelationshipActions.ts");
const parentInvites = read("src/lib/services/parent-invites.ts");
const billActions = read("src/lib/actions/billActions.ts");
const attendanceService = read("src/lib/services/attendance.ts");
const caActivityService = read("src/lib/services/ca-activity.ts");
const parentActivityEvents = read("src/lib/services/parent-activity-events.ts");

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
  assertContains(userManagement, "validateAdmissionNumberForSchool", "Student creation and update must enforce the school admission number format.");
  assertContains(userManagement, "Save the school code before creating students.", "Student creation must be blocked until the school code exists.");
  assertContains(createStudentBlock, "randomUUID", "Student creation must create an internal record id.");
  assertContains(createStudentBlock, "studentRecordUsername", "Legacy username must be derived internally.");
  assertContains(createStudentBlock, "prisma.$transaction", "Student creation must create the student and parent link atomically.");
  assertContains(createStudentBlock, "syncParentRelationshipsForStudentLifecycle", "Student creation must create the parent link through lifecycle sync.");
  assertContains(studentApi, "{ userId }", "Student creation audit must use the signed-in admin as actor.");
  assertContains(userManagement, "resolveSmartParentForStudent", "Student creation must support smart parent linking.");
  assertContains(userManagement, "Guardian email and phone match two different parents", "Smart parent linking must not guess when contacts conflict.");
  assertContains(userManagement, "Guardian phone matches an existing parent, but the email is different", "Smart parent linking must reject phone matches with conflicting email.");
  assertContains(userManagement, "Guardian email matches an existing parent, but the phone is different", "Smart parent linking must reject email matches with conflicting phone.");
  assertContains(userManagement, "phone: { not: null }", "Smart parent linking must compare normalized stored phones instead of relying on exact formatting.");
  assertContains(userManagement, "generatedParentUsername", "Smart parent creation must use deterministic internal parent usernames.");
  assertContains(userManagement, "parentEmail", "Smart parent linking must match by guardian email.");
  assertContains(userManagement, "parentPhone", "Smart parent linking must match by guardian phone.");
  assertNotContains(createStudentBlock, "clerk.users.createUser", "Student creation must not create a Clerk user yet.");
  assertContains(studentApi, "admissionNumber: formData.get(\"admissionNumber\")", "Student create API must accept admission number.");
  assertContains(studentApi, "parentEmail: formData.get(\"parentEmail\")", "Student create API must accept guardian email for smart linking.");
  assertContains(studentApi, "parentPhone: formData.get(\"parentPhone\")", "Student create API must accept guardian phone for smart linking.");
  assertNotContains(studentApi, "password: formData.get(\"password\")", "Student create API must not ask for student login password.");
});

test("student updates and forms expose status without restoring account fields", () => {
  assertContains(studentApiUpdate, "status: formData.get(\"status\")", "Student update API must accept lifecycle status.");
  assertNotContains(studentApiUpdate, "status: formData.get(\"status\") || \"ACTIVE\"", "Student update API must not silently activate incomplete records.");
  assertContains(studentForm, "Admission Number", "Student form must show admission number.");
  assertContains(studentForm, "Student Status", "Student form must expose lifecycle status on update.");
  assertContains(studentForm, "Smart Parent Linking", "Student form must expose smart parent linking during enrolment.");
  assertContains(studentForm, "Guardian Email", "Student form must collect guardian email for smart linking.");
  assertContains(studentForm, "Guardian Phone", "Student form must collect guardian phone for smart linking.");
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
  assertContains(deleteStudentBlock, "transferred, graduated, withdrawn, or incomplete setup", "Delete guidance must direct admins to lifecycle statuses.");
  assertNotContains(deleteStudentBlock, "prisma.student.delete", "Student delete action must not hard-delete records.");
  assertNotContains(studentListPage, "type=\"delete\"", "Student list must not show casual delete controls.");
});

test("inactive students cannot receive new legacy result records", () => {
  const createResultBlock = legacyActions.slice(
    legacyActions.indexOf("export async function createResult"),
    legacyActions.indexOf("export async function updateResult"),
  );
  const updateResultBlock = legacyActions.slice(
    legacyActions.indexOf("export async function updateResult"),
    legacyActions.indexOf("export async function deleteResult"),
  );

  assertContains(legacyActions, "requireActiveStudentForResult", "Legacy result writes must use the active-student guard.");
  assertContains(legacyActions, "status: \"ACTIVE\"", "Legacy result writes must reject inactive lifecycle statuses.");
  assertContains(legacyActions, "Results can only be recorded for active students", "Inactive-student result writes must explain the lifecycle rule.");
  assertContains(createResultBlock, "await requireActiveStudentForResult(parsed.studentId, ctx)", "Creating a legacy result must require an active student.");
  assertContains(updateResultBlock, "await requireActiveStudentForResult(parsed.studentId, ctx)", "Updating a legacy result must not move it onto an inactive student.");
});

test("student list is an operational source-of-truth page", () => {
  assertContains(studentListPage, "STUDENT_STATUS_LABELS", "Student list must show lifecycle status.");
  assertContains(studentListPage, "STUDENT_STATUS_DOTS", "Student list must not show one misleading status dot for every lifecycle state.");
  assertContains(studentListPage, "name=\"classId\"", "Student list must support class filtering.");
  assertContains(studentListPage, "name=\"status\"", "Student list must support status filtering.");
  assertContains(studentListPage, "Missing Admission", "Student list must expose admission-number gaps.");
  assertContains(studentListPage, "min-[420px]:grid-cols-2 xl:grid-cols-4", "Student summary cards must not force four columns on narrow screens.");
  assertContains(studentListPage, "break-words text-xs text-gray-400", "Student summary card labels must wrap instead of overlapping.");
  assertContains(studentListPage, "No contact saved", "Student list must safely handle missing parent contact.");
  assertContains(studentListPage, "status: StudentStatus.ACTIVE", "Teacher student scope must exclude non-active student records.");
  assertContains(studentListPage, "View profile", "Mobile student cards must keep a clear profile action.");
});

test("student detail page respects source-of-truth and access rules", () => {
  assertContains(studentDetailPage, "student.status !== StudentStatus.ACTIVE", "Teachers must not open non-active student profiles.");
  assertContains(studentDetailPage, "canViewParentContact", "Parent contact must be gated by role/class-teacher responsibility.");
  assertContains(studentDetailPage, "canViewFinance", "Student finance snapshot must be gated to finance-safe roles.");
  assertContains(studentDetailPage, "type: { notIn: [\"BILL\", \"PAYMENT\"] }", "Student detail must not leak finance activity to non-finance viewers.");
  assertContains(studentDetailPage, "student:      { status: StudentStatus.ACTIVE }", "Class position must exclude inactive students.");
  assertContains(studentDetailPage, "No published timetable lessons", "Student profile must explain missing published timetable data.");
  assertContains(studentDetailPage, "Awaiting teacher entry", "Student detail must keep CA gaps informational instead of sending admins into teacher entry.");
  assertNotContains(studentDetailPage, "CA Entry", "Student detail quick access must not expose CA-entry actions.");
  assertNotContains(studentDetailPage, "/list/ca?classId=${student.classId}", "Student detail must not link admins or inspectors into CA entry from quick answers.");
  assertNotContains(studentDetailPage, "/list/results?studentId=${student.id}", "Student detail must not link to legacy results as the academic source of truth.");
  assertNotContains(studentDetailPage, "student.results", "Student profile must not fall back to old Result.score data for CA averages.");
});

test("student detail page is a complete operational profile", () => {
  assertContains(studentDetailPage, "Class Placement", "Student detail must show class placement.");
  assertContains(studentDetailPage, "Parent / Guardian Links", "Student detail must show parent and guardian links.");
  assertContains(studentDetailPage, "Finance Snapshot", "Student detail must show a finance snapshot for allowed roles.");
  assertContains(studentDetailPage, "Attendance Snapshot", "Student detail must show attendance snapshot.");
  assertContains(studentDetailPage, "Academic / Report Snapshot", "Student detail must show academic/report snapshot.");
  assertContains(studentDetailPage, "Recent Activity / History", "Student detail must show recent activity/history.");
  assertContains(studentDetailPage, "prisma.studentBill.findMany", "Student detail finance snapshot must use real student bill records.");
  assertContains(studentDetailPage, "prisma.parentActivityEvent.findMany", "Student detail recent activity must use real parent activity events.");
  assertContains(studentDetailPage, "prisma.parentStudentRelationship.findMany", "Student detail guardian links must use relationship records.");
  assertContains(studentDetailPage, "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4", "Student detail summary grids must stack on mobile before widening.");
  assertContains(studentDetailPage, "break-words", "Student detail labels must not overflow narrow screens.");
  assertContains(studentDetailPage, "Math.min(Math.max(r.totalScore, 0), 100)", "Student detail score bars must clamp unsafe score widths.");
  assertContains(studentDetailPage, "[...g.records].sort", "Student detail academic history must not mutate grouped result records while rendering.");
  assertContains(studentDetailPage, "timetableDays.map", "Student detail timetable must use a compact day-by-day summary.");
  assertContains(studentDetailPage, "sm:grid-cols-[7rem_1fr_auto]", "Student detail timetable rows must stack cleanly on mobile.");
  assertNotContains(studentDetailPage, "BigCalendar", "Student detail should not use the heavy calendar grid for quick-answer timetable inspection.");
});

test("student bulk import keeps intake strict and account-free", () => {
  assertContains(studentListPage, "/list/students/import", "Student list must expose the import workflow to admins.");
  assertContains(studentImportPage, "Download template", "Student import page must provide a CSV template.");
  assertContains(studentImportForm, "accept=\".csv,text/csv\"", "Student import form must accept CSV files only.");
  assertContains(studentImportAction, "requireRole([\"admin\"])", "Student import must be admin-only.");
  assertContains(studentImportAction, "MAX_IMPORT_FILE_BYTES", "Student import must limit upload size.");
  assertContains(studentImportService, "REQUIRED_HEADERS", "Student import must define required columns.");
  assertContains(studentImportService, "\"parentSex\"", "Student import must require guardian sex for correct parent titles.");
  assertContains(studentImportService, "if (rowErrors.length > 0)", "Student import must reject invalid files before writing.");
  assertContains(studentImportService, "values.length > headers.length", "Student import must reject malformed CSV rows with extra values.");
  assertContains(studentImportService, "parentContactByEmail", "Student import must detect inconsistent guardian contacts inside the CSV.");
  assertContains(studentImportService, "resolveExistingParentForRow", "Student import must not guess when guardian email and phone match different existing parents.");
  assertContains(studentImportService, "buildExistingParentMaps", "Student import must normalize existing parent contacts before matching.");
  assertContains(studentImportService, "Existing parent records share email", "Student import must block duplicate existing parent emails.");
  assertContains(studentImportService, "Existing parent records share phone", "Student import must block duplicate existing parent phones.");
  assertContains(studentImportService, "phone: { not: null }", "Student import must not rely on exact stored phone formatting.");
  assertContains(studentImportService, "prisma.$transaction", "Student import must write in a database transaction.");
  assertContains(studentImportService, "admissionNumber: { in: admissionNumbers }", "Student import must block duplicate admission numbers.");
  assertContains(studentImportService, "validateAdmissionNumberForSchool", "Student import must enforce the official school admission number format.");
  assertContains(studentImportService, "Save the school code before importing students.", "Student import must be blocked until the school code exists.");
  assertContains(studentImportService, "parentSex must be MALE or FEMALE", "Student import must validate guardian sex before creating parent profiles.");
  assertContains(studentImportService, "sex: row.parentSex.trim().toUpperCase() as UserSex", "Student import must persist guardian sex on created parent profiles.");
  assertContains(admissionNumberHelper, "SCHOOLCODE-YYYY-0001", "Admission helper must explain the official Edujay format.");
  assertContains(studentImportService, "parentStudentRelationship.upsert", "Student import must link guardians to imported students.");
  assertContains(studentImportService, "createdStudents", "Student import result must report created students.");
  assertContains(studentImportService, "linkedParents", "Student import result must report parent links.");
  assertContains(studentImportService, "createdParentProfiles", "Student import result must report created parent profiles.");
  assertContains(studentImportService, "rowsSkipped", "Student import result must report skipped rows.");
  assertContains(studentImportService, "rowsNeedingCorrection", "Student import result must report rows needing correction.");
  assertContains(studentImportService, "correctionReport", "Student import result must preserve correction report details.");
  assertContains(studentImportService, "Header: missing", "Header errors must produce correction-report details.");
  assertContains(studentImportService, "too many values for the header row", "Malformed CSV rows must produce correction-report details.");
  assertContains(studentImportAction, "emptyStudentImportResult", "Failed student import must return structured zero-save result details.");
  assertContains(studentImportForm, "Students created", "Student import UI must show created student count.");
  assertContains(studentImportForm, "Rows skipped", "Student import UI must show skipped rows.");
  assertContains(studentImportForm, "Need correction", "Student import UI must show correction count.");
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
  assertContains(parentStudentRelationships, "Only active students can be linked to parent portal access.", "Shared parent-link helper must reject inactive wards.");
  assertContains(parentInvites, "status: \"ACTIVE\"", "Parent invite creation must only include active wards.");
  assertContains(parentInvites, "student.status !== \"ACTIVE\"", "Parent invite acceptance must reject wards that became inactive after invite creation.");
});

test("inactive students are excluded from live school operations", () => {
  assertContains(billActions, "classId: { in: input.classIds }, status: \"ACTIVE\"", "Bill generation must only create new bills for active students.");
  assertContains(attendanceService, "id: { in: studentIds }, status: \"ACTIVE\"", "Attendance submission must only accept active students.");
  assertContains(attendanceService, "One or more students are not active members of this lesson's class.", "Attendance errors must explain inactive student rejection.");
  assertContains(attendanceService, "where: { schoolId, classId, status: \"ACTIVE\" }", "Class attendance stats must exclude inactive students.");
  assertContains(attendanceService, "where: { schoolId, status: \"ACTIVE\" }", "School attendance health must exclude inactive students.");
  assertContains(caActivityService, "classId: activity.classId, status: \"ACTIVE\"", "CA activity scores must only be saved for active students.");
  assertContains(caActivityService, "Student is not an active member of this CA activity class.", "CA activity errors must explain inactive student rejection.");
  assertContains(parentActivityEvents, "status: \"ACTIVE\"", "Parent activity events must not be created for inactive students.");
});
