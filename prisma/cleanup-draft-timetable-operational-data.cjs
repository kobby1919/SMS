/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv/config");

const { PrismaClient } = require("../src/generated/prisma");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 30_000,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const schoolIdArg = process.argv.find((arg) => arg.startsWith("--schoolId="));
const schoolId = schoolIdArg?.split("=")[1] || "default-school";
const apply = process.argv.includes("--apply");

async function main() {
  console.log(`${apply ? "Applying" : "Dry run for"} draft timetable operational cleanup`);
  console.log(`School: ${schoolId}`);
  console.log("");

  const draftLessons = await prisma.lesson.findMany({
    where: { schoolId },
    select: { id: true },
  });
  const lessonIds = draftLessons.map((lesson) => lesson.id);
  const lessonSourceIds = lessonIds.map(String);

  const [attendanceRecords, assignments] = await Promise.all([
    lessonIds.length
      ? prisma.attendance.findMany({
          where: { schoolId, lessonId: { in: lessonIds } },
          select: { id: true },
        })
      : [],
    lessonIds.length
      ? prisma.assignment.findMany({
          where: { schoolId, lessonId: { in: lessonIds } },
          select: { id: true },
        })
      : [],
  ]);

  const attendanceIds = attendanceRecords.map((record) => record.id);
  const attendanceSourceIds = attendanceIds.map(String);
  const assignmentIds = assignments.map((assignment) => assignment.id);
  const assignmentSourceIds = assignmentIds.map(String);

  const obligations = await prisma.teacherObligation.findMany({
    where: {
      schoolId,
      OR: [
        { type: "ATTENDANCE" },
        { sourceModel: "Lesson", sourceId: { in: lessonSourceIds } },
        { sourceModel: "Assignment", sourceId: { in: assignmentSourceIds } },
      ],
    },
    select: { id: true },
  });
  const obligationIds = obligations.map((obligation) => obligation.id);

  const escalations = obligationIds.length
    ? await prisma.teacherEscalation.findMany({
        where: { schoolId, obligationId: { in: obligationIds } },
        select: { id: true },
      })
    : [];
  const escalationIds = escalations.map((escalation) => escalation.id);

  const correctionRequests = await prisma.teacherCorrectionRequest.findMany({
    where: {
      schoolId,
      OR: [
        { sourceModel: "Attendance", sourceId: { in: attendanceSourceIds } },
        { sourceModel: "Lesson", sourceId: { in: lessonSourceIds } },
        { sourceModel: "Assignment", sourceId: { in: assignmentSourceIds } },
        { sourceModel: "TeacherObligation", sourceId: { in: obligationIds } },
      ],
    },
    select: { id: true },
  });
  const correctionRequestIds = correctionRequests.map((request) => request.id);

  const parentNotifications = await prisma.parentNotification.findMany({
    where: {
      schoolId,
      OR: [
        { sourceModel: "Attendance", sourceId: { in: attendanceSourceIds } },
        { sourceModel: "Assignment", sourceId: { in: assignmentSourceIds } },
        { sourceKey: { startsWith: "attendance:" } },
        { sourceKey: { startsWith: "assignment:" } },
      ],
    },
    select: { id: true },
  });
  const parentNotificationIds = parentNotifications.map((notification) => notification.id);

  const targets = [
    [
      "Parent delivery logs for affected notifications",
      () =>
        parentNotificationIds.length
          ? prisma.parentNotificationDeliveryLog.deleteMany({
              where: { schoolId, notificationId: { in: parentNotificationIds } },
            })
          : Promise.resolve({ count: 0 }),
      () =>
        parentNotificationIds.length
          ? prisma.parentNotificationDeliveryLog.count({
              where: { schoolId, notificationId: { in: parentNotificationIds } },
            })
          : Promise.resolve(0),
    ],
    [
      "Parent notifications from attendance/homework draft timetable records",
      () =>
        prisma.parentNotification.deleteMany({
          where: {
            schoolId,
            OR: [
              { id: { in: parentNotificationIds } },
              { sourceKey: { startsWith: "attendance:" } },
              { sourceKey: { startsWith: "assignment:" } },
            ],
          },
        }),
      () =>
        prisma.parentNotification.count({
          where: {
            schoolId,
            OR: [
              { id: { in: parentNotificationIds } },
              { sourceKey: { startsWith: "attendance:" } },
              { sourceKey: { startsWith: "assignment:" } },
            ],
          },
        }),
    ],
    [
      "Parent activity events from attendance/homework draft timetable records",
      () =>
        prisma.parentActivityEvent.deleteMany({
          where: {
            schoolId,
            OR: [
              { sourceModel: "Attendance", sourceId: { in: attendanceSourceIds } },
              { sourceModel: "Assignment", sourceId: { in: assignmentSourceIds } },
              { sourceKey: { startsWith: "attendance:" } },
              { sourceKey: { startsWith: "assignment:" } },
            ],
          },
        }),
      () =>
        prisma.parentActivityEvent.count({
          where: {
            schoolId,
            OR: [
              { sourceModel: "Attendance", sourceId: { in: attendanceSourceIds } },
              { sourceModel: "Assignment", sourceId: { in: assignmentSourceIds } },
              { sourceKey: { startsWith: "attendance:" } },
              { sourceKey: { startsWith: "assignment:" } },
            ],
          },
        }),
    ],
    [
      "Homework notices created from draft timetable lessons",
      () =>
        prisma.announcement.deleteMany({
          where: {
            schoolId,
            OR: [
              { title: { startsWith: "New Homework:" } },
              { title: { startsWith: "Homework Updated:" } },
            ],
          },
        }),
      () =>
        prisma.announcement.count({
          where: {
            schoolId,
            OR: [
              { title: { startsWith: "New Homework:" } },
              { title: { startsWith: "Homework Updated:" } },
            ],
          },
        }),
    ],
    [
      "Teacher accountability audit logs for affected obligations",
      () =>
        prisma.teacherAccountabilityAuditLog.deleteMany({
          where: {
            schoolId,
            OR: [
              { sourceModel: "TeacherObligation", sourceId: { in: obligationIds } },
              { sourceModel: "TeacherEscalation", sourceId: { in: escalationIds } },
              { sourceModel: "TeacherCorrectionRequest", sourceId: { in: correctionRequestIds } },
              { sourceModel: "Attendance", sourceId: { in: attendanceSourceIds } },
              { sourceModel: "Assignment", sourceId: { in: assignmentSourceIds } },
            ],
          },
        }),
      () =>
        prisma.teacherAccountabilityAuditLog.count({
          where: {
            schoolId,
            OR: [
              { sourceModel: "TeacherObligation", sourceId: { in: obligationIds } },
              { sourceModel: "TeacherEscalation", sourceId: { in: escalationIds } },
              { sourceModel: "TeacherCorrectionRequest", sourceId: { in: correctionRequestIds } },
              { sourceModel: "Attendance", sourceId: { in: attendanceSourceIds } },
              { sourceModel: "Assignment", sourceId: { in: assignmentSourceIds } },
            ],
          },
        }),
    ],
    [
      "Teacher correction requests for affected attendance/homework records",
      () =>
        correctionRequestIds.length
          ? prisma.teacherCorrectionRequest.deleteMany({ where: { schoolId, id: { in: correctionRequestIds } } })
          : Promise.resolve({ count: 0 }),
      () =>
        correctionRequestIds.length
          ? prisma.teacherCorrectionRequest.count({ where: { schoolId, id: { in: correctionRequestIds } } })
          : Promise.resolve(0),
    ],
    [
      "Teacher reminders for affected obligations",
      () =>
        obligationIds.length
          ? prisma.teacherReminder.deleteMany({ where: { schoolId, obligationId: { in: obligationIds } } })
          : Promise.resolve({ count: 0 }),
      () =>
        obligationIds.length
          ? prisma.teacherReminder.count({ where: { schoolId, obligationId: { in: obligationIds } } })
          : Promise.resolve(0),
    ],
    [
      "Teacher escalations for affected obligations",
      () =>
        obligationIds.length
          ? prisma.teacherEscalation.deleteMany({ where: { schoolId, obligationId: { in: obligationIds } } })
          : Promise.resolve({ count: 0 }),
      () =>
        obligationIds.length
          ? prisma.teacherEscalation.count({ where: { schoolId, obligationId: { in: obligationIds } } })
          : Promise.resolve(0),
    ],
    [
      "Teacher attendance/homework obligations from draft timetable",
      () =>
        obligationIds.length
          ? prisma.teacherObligation.deleteMany({ where: { schoolId, id: { in: obligationIds } } })
          : Promise.resolve({ count: 0 }),
      () =>
        obligationIds.length
          ? prisma.teacherObligation.count({ where: { schoolId, id: { in: obligationIds } } })
          : Promise.resolve(0),
    ],
    [
      "Attendance audit logs for draft timetable lessons",
      () =>
        prisma.attendanceAuditLog.deleteMany({
          where: {
            schoolId,
            OR: [
              { attendanceId: { in: attendanceIds } },
              { lessonId: { in: lessonIds } },
            ],
          },
        }),
      () =>
        prisma.attendanceAuditLog.count({
          where: {
            schoolId,
            OR: [
              { attendanceId: { in: attendanceIds } },
              { lessonId: { in: lessonIds } },
            ],
          },
        }),
    ],
    [
      "Attendance records from draft timetable lessons",
      () =>
        lessonIds.length
          ? prisma.attendance.deleteMany({ where: { schoolId, lessonId: { in: lessonIds } } })
          : Promise.resolve({ count: 0 }),
      () =>
        lessonIds.length
          ? prisma.attendance.count({ where: { schoolId, lessonId: { in: lessonIds } } })
          : Promise.resolve(0),
    ],
    [
      "Results attached to affected homework",
      () =>
        assignmentIds.length
          ? prisma.result.deleteMany({ where: { schoolId, assignmentId: { in: assignmentIds } } })
          : Promise.resolve({ count: 0 }),
      () =>
        assignmentIds.length
          ? prisma.result.count({ where: { schoolId, assignmentId: { in: assignmentIds } } })
          : Promise.resolve(0),
    ],
    [
      "Homework submissions attached to affected homework",
      () =>
        assignmentIds.length
          ? prisma.homeworkSubmission.deleteMany({ where: { schoolId, assignmentId: { in: assignmentIds } } })
          : Promise.resolve({ count: 0 }),
      () =>
        assignmentIds.length
          ? prisma.homeworkSubmission.count({ where: { schoolId, assignmentId: { in: assignmentIds } } })
          : Promise.resolve(0),
    ],
    [
      "Homework assignments attached to draft timetable lessons",
      () =>
        lessonIds.length
          ? prisma.assignment.deleteMany({ where: { schoolId, lessonId: { in: lessonIds } } })
          : Promise.resolve({ count: 0 }),
      () =>
        lessonIds.length
          ? prisma.assignment.count({ where: { schoolId, lessonId: { in: lessonIds } } })
          : Promise.resolve(0),
    ],
  ];

  for (const [label, deleteTarget, countTarget] of targets) {
    const count = await countTarget();
    if (!apply) {
      console.log(`${label}: ${count}`);
      continue;
    }
    const result = await deleteTarget();
    console.log(`${label}: deleted ${result.count}`);
  }

  console.log("");
  console.log(
    apply
      ? "Cleanup complete. Draft lessons, period templates, users, classes, subjects, CA configs, finance records, and published timetable snapshots were kept."
      : "Dry run complete. Re-run with --apply to permanently delete these operational records.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end().catch(() => undefined);
    process.exit(process.exitCode || 0);
  });
