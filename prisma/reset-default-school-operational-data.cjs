/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv/config");

const { PrismaClient } = require("../src/generated/prisma");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const DEFAULT_SCHOOL_ID = "default-school";
const CONFIRMATION = "RESET_DEFAULT_SCHOOL";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 30_000,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const schoolIdArg = process.argv.find((arg) => arg.startsWith("--schoolId="));
const preserveAdminArg = process.argv.find((arg) => arg.startsWith("--preserveAdmin="));
const confirmArg = process.argv.find((arg) => arg.startsWith("--confirm="));

const schoolId = schoolIdArg?.split("=")[1] || DEFAULT_SCHOOL_ID;
const preserveAdmin = preserveAdminArg?.split("=")[1] || "admin";
const apply = confirmArg?.split("=")[1] === CONFIRMATION;

function assertSafeTarget() {
  if (schoolId !== DEFAULT_SCHOOL_ID) {
    throw new Error(
      `This script only resets ${DEFAULT_SCHOOL_ID}. Refusing to reset "${schoolId}".`,
    );
  }
}

function model(name) {
  const delegate = prisma[name];
  if (!delegate) {
    throw new Error(`Prisma model "${name}" is not available. Regenerate Prisma before running reset.`);
  }
  return delegate;
}

async function countOperation(operation) {
  if (operation.count) return operation.count();
  return model(operation.model).count({ where: operation.where });
}

async function deleteOperation(operation) {
  if (operation.delete) return operation.delete();
  return model(operation.model).deleteMany({ where: operation.where });
}

function tenantOperation(label, prismaModel, where = { schoolId }) {
  return { label, model: prismaModel, where };
}

async function chooseAdminToPreserve() {
  const admins = await prisma.admin.findMany({
    where: { schoolId },
    orderBy: { username: "asc" },
    select: { id: true, username: true },
  });

  if (admins.length === 0) {
    throw new Error(`No admin exists for ${schoolId}. Create one admin before resetting this school.`);
  }

  return (
    admins.find((admin) => admin.username === preserveAdmin || admin.id === preserveAdmin) ??
    admins[0]
  );
}

async function buildOperations(adminToPreserve) {
  const [students, teachers, parents, classes, grades, subjects, lessons, assignments, syllabi, feeStructures, studentBills, paymentIntents, payments] =
    await Promise.all([
      prisma.student.findMany({ where: { schoolId }, select: { id: true } }),
      prisma.teacher.findMany({ where: { schoolId }, select: { id: true } }),
      prisma.parent.findMany({ where: { schoolId }, select: { id: true } }),
      prisma.class.findMany({ where: { schoolId }, select: { id: true } }),
      prisma.grade.findMany({ where: { schoolId }, select: { id: true } }),
      prisma.subject.findMany({ where: { schoolId }, select: { id: true } }),
      prisma.lesson.findMany({ where: { schoolId }, select: { id: true } }),
      prisma.assignment.findMany({ where: { schoolId }, select: { id: true } }),
      prisma.syllabus.findMany({ where: { schoolId }, select: { id: true } }),
      prisma.feeStructure.findMany({ where: { schoolId }, select: { id: true } }),
      prisma.studentBill.findMany({ where: { schoolId }, select: { id: true } }),
      prisma.paymentIntent.findMany({ where: { schoolId }, select: { id: true } }),
      prisma.payment.findMany({ where: { schoolId }, select: { id: true } }),
    ]);

  const studentIds = students.map((item) => item.id);
  const teacherIds = teachers.map((item) => item.id);
  const parentIds = parents.map((item) => item.id);
  const classIds = classes.map((item) => item.id);
  const gradeIds = grades.map((item) => item.id);
  const subjectIds = subjects.map((item) => item.id);
  const lessonIds = lessons.map((item) => item.id);
  const assignmentIds = assignments.map((item) => item.id);
  const syllabusIds = syllabi.map((item) => item.id);
  const feeStructureIds = feeStructures.map((item) => item.id);
  const studentBillIds = studentBills.map((item) => item.id);
  const paymentIntentIds = paymentIntents.map((item) => item.id);
  const paymentIds = payments.map((item) => item.id);

  return [
    tenantOperation("App notification audit logs", "appNotificationAuditLog"),
    tenantOperation("App notification deliveries", "appNotificationDelivery"),
    tenantOperation("App notifications", "appNotification"),
    tenantOperation("App notification preferences", "appNotificationPreference"),
    tenantOperation("App notification settings", "appNotificationSetting"),
    tenantOperation("School notification settings", "schoolNotificationSetting"),
    tenantOperation("Legacy parent delivery logs", "parentNotificationDeliveryLog"),
    tenantOperation("Parent notifications", "parentNotification"),
    tenantOperation("Parent activity events", "parentActivityEvent"),
    tenantOperation("Parent notification preferences", "parentNotificationPreference"),

    tenantOperation("Parent-teacher contact messages", "parentTeacherContactMessage"),
    tenantOperation("Parent-teacher contact requests", "parentTeacherContactRequest"),
    tenantOperation("Communication routes", "schoolCommunicationRoute"),
    tenantOperation("Communication policy", "schoolCommunicationPolicy"),

    tenantOperation("Teacher accountability audit logs", "teacherAccountabilityAuditLog"),
    tenantOperation("Teacher reminders", "teacherReminder"),
    tenantOperation("Teacher escalations", "teacherEscalation"),
    tenantOperation("Teacher correction requests", "teacherCorrectionRequest"),
    tenantOperation("Teacher obligations", "teacherObligation"),
    tenantOperation("Teacher accountability settings", "teacherAccountabilitySetting"),

    {
      label: "Payment webhook events",
      model: "paymentWebhookEvent",
      where: {
        OR: [
          { schoolId },
          ...(paymentIds.length ? [{ paymentId: { in: paymentIds } }] : []),
        ],
      },
    },
    tenantOperation("Finance jobs", "financeJob"),
    tenantOperation("Payment correction requests", "paymentCorrectionRequest"),
    tenantOperation("Payment reversals", "paymentReversal"),
    tenantOperation("Finance queries", "financeQuery"),
    tenantOperation("Discounts", "discount"),
    tenantOperation("Payments", "payment"),
    {
      label: "Payment intent lines",
      model: "paymentIntentLine",
      where: paymentIntentIds.length ? { paymentIntentId: { in: paymentIntentIds } } : { id: "__none__" },
    },
    tenantOperation("Payment intents", "paymentIntent"),
    {
      label: "Bill line items",
      model: "billLineItem",
      where: studentBillIds.length ? { studentBillId: { in: studentBillIds } } : { id: -1 },
    },
    tenantOperation("Student bills", "studentBill"),
    {
      label: "Fee items",
      model: "feeItem",
      where: feeStructureIds.length ? { feeStructureId: { in: feeStructureIds } } : { id: -1 },
    },
    tenantOperation("Fee structures", "feeStructure"),
    tenantOperation("Receipt counters", "receiptCounter"),
    tenantOperation("Finance audit logs", "financeAuditLog"),
    tenantOperation("School payment settings", "schoolPaymentSetting"),

    tenantOperation("CA audit logs", "cAAuditLog"),
    tenantOperation("CA activity scores", "cAActivityScore"),
    tenantOperation("Continuous assessments", "continuousAssessment"),
    tenantOperation("Homework submissions", "homeworkSubmission"),
    tenantOperation("Results", "result"),
    tenantOperation("Attendance audit logs", "attendanceAuditLog"),
    tenantOperation("Attendance records", "attendance"),
    tenantOperation("Report card publications", "reportCardPublication"),
    tenantOperation("Exam entry windows", "examEntryWindow"),
    {
      label: "Syllabus topic progress",
      model: "syllabusTopicProgress",
      where: { schoolId },
    },
    {
      label: "Syllabus topics",
      model: "syllabusTopic",
      where: syllabusIds.length ? { syllabusId: { in: syllabusIds } } : { id: -1 },
    },
    tenantOperation("Syllabi", "syllabus"),
    tenantOperation("CA activities", "cAActivity"),
    tenantOperation("CA buckets", "cABucket"),
    tenantOperation("CA configs", "cAConfig"),
    tenantOperation("Exams", "exam"),
    tenantOperation("Assignments", "assignment"),
    tenantOperation("Events", "event"),
    tenantOperation("Announcements", "announcement"),
    tenantOperation("Published timetable lessons", "publishedTimetableLesson"),
    tenantOperation("Timetable publications", "timetablePublication"),
    tenantOperation("Lessons", "lesson"),
    tenantOperation("Period templates", "schoolPeriodTemplate"),

    tenantOperation("Parent access audit logs", "parentAccessAuditLog"),
    tenantOperation("Parent invite student links", "parentInviteStudent"),
    tenantOperation("Parent invite audit logs", "parentInviteAuditLog"),
    tenantOperation("Parent invites", "parentInvite"),
    tenantOperation("Teacher invite audit logs", "teacherInviteAuditLog"),
    tenantOperation("Teacher invites", "teacherInvite"),
    tenantOperation("Bursar invite audit logs", "bursarInviteAuditLog"),
    tenantOperation("Bursar invites", "bursarInvite"),
    tenantOperation("School admin invites", "schoolInvite"),
    tenantOperation("Waitlist entries", "waitlistEntry"),
    tenantOperation("Onboarding audit logs", "onboardingAuditLog"),

    tenantOperation("Parent-student relationships", "parentStudentRelationship"),
    tenantOperation("Students", "student"),
    tenantOperation("Classes", "class"),
    tenantOperation("Subjects", "subject"),
    tenantOperation("Grades", "grade"),
    tenantOperation("Teachers", "teacher"),
    tenantOperation("Parents", "parent"),
    tenantOperation("Bursars", "bursar"),
    {
      label: "Extra admins",
      model: "admin",
      where: { schoolId, id: { not: adminToPreserve.id } },
    },
  ];
}

async function main() {
  assertSafeTarget();

  console.log(`${apply ? "Applying" : "Dry run for"} default-school reset`);
  console.log(`School: ${schoolId}`);
  console.log(`Confirmation required to apply: --confirm=${CONFIRMATION}`);
  console.log("");

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, name: true, onboardingStatus: true },
  });

  if (!school) {
    throw new Error(`School "${schoolId}" does not exist.`);
  }

  const adminToPreserve = await chooseAdminToPreserve();
  const operations = await buildOperations(adminToPreserve);
  const summary = [];

  for (const operation of operations) {
    const count = await countOperation(operation);
    summary.push({ label: operation.label, count });
  }

  console.table(summary.filter((item) => item.count > 0));
  console.log("");
  console.log(`Preserving school: ${school.name} (${school.id})`);
  console.log(`Preserving admin: ${adminToPreserve.username} (${adminToPreserve.id})`);

  if (!apply) {
    console.log("");
    console.log("Dry run only. Nothing was deleted.");
    console.log(`Run again with --confirm=${CONFIRMATION} to apply.`);
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      for (const operation of operations) {
        const delegate = tx[operation.model];
        if (!delegate) throw new Error(`Model "${operation.model}" is unavailable in transaction.`);
        if (operation.delete) {
          await operation.delete(tx);
        } else {
          await delegate.deleteMany({ where: operation.where });
        }
      }

      await tx.school.update({
        where: { id: schoolId },
        data: {
          onboardingStatus: "PENDING_SETUP",
          setupStep: "profile",
          setupCompletedAt: null,
        },
      });
    },
    { timeout: 120_000 },
  );

  console.log("");
  console.log("default-school operating data reset complete.");
  console.log("School setup status reset to PENDING_SETUP at setup step: profile.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
