import prisma from "../src/lib/prisma";

const schoolIdArg = process.argv.find((arg) => arg.startsWith("--schoolId="));
const schoolId = schoolIdArg?.split("=")[1] || "default-school";
const apply = process.argv.includes("--apply");

type CleanupTarget = {
  label: string;
  count: () => Promise<number>;
  delete: () => Promise<{ count: number }>;
};

const targets: CleanupTarget[] = [
  {
    label: "Parent notification delivery logs",
    count: () => prisma.parentNotificationDeliveryLog.count({ where: { schoolId } }),
    delete: () => prisma.parentNotificationDeliveryLog.deleteMany({ where: { schoolId } }),
  },
  {
    label: "Parent notifications",
    count: () => prisma.parentNotification.count({ where: { schoolId } }),
    delete: () => prisma.parentNotification.deleteMany({ where: { schoolId } }),
  },
  {
    label: "Parent activity events",
    count: () => prisma.parentActivityEvent.count({ where: { schoolId } }),
    delete: () => prisma.parentActivityEvent.deleteMany({ where: { schoolId } }),
  },
  {
    label: "Parent-teacher contact messages",
    count: () => prisma.parentTeacherContactMessage.count({ where: { schoolId } }),
    delete: () => prisma.parentTeacherContactMessage.deleteMany({ where: { schoolId } }),
  },
  {
    label: "Parent-teacher contact requests",
    count: () => prisma.parentTeacherContactRequest.count({ where: { schoolId } }),
    delete: () => prisma.parentTeacherContactRequest.deleteMany({ where: { schoolId } }),
  },
  {
    label: "Teacher reminders",
    count: () => prisma.teacherReminder.count({ where: { schoolId } }),
    delete: () => prisma.teacherReminder.deleteMany({ where: { schoolId } }),
  },
  {
    label: "Teacher escalations",
    count: () => prisma.teacherEscalation.count({ where: { schoolId } }),
    delete: () => prisma.teacherEscalation.deleteMany({ where: { schoolId } }),
  },
  {
    label: "Teacher correction requests",
    count: () => prisma.teacherCorrectionRequest.count({ where: { schoolId } }),
    delete: () => prisma.teacherCorrectionRequest.deleteMany({ where: { schoolId } }),
  },
  {
    label: "Teacher accountability audit logs",
    count: () => prisma.teacherAccountabilityAuditLog.count({ where: { schoolId } }),
    delete: () => prisma.teacherAccountabilityAuditLog.deleteMany({ where: { schoolId } }),
  },
  {
    label: "Teacher obligations",
    count: () => prisma.teacherObligation.count({ where: { schoolId } }),
    delete: () => prisma.teacherObligation.deleteMany({ where: { schoolId } }),
  },
  {
    label: "Attendance audit logs",
    count: () => prisma.attendanceAuditLog.count({ where: { schoolId } }),
    delete: () => prisma.attendanceAuditLog.deleteMany({ where: { schoolId } }),
  },
  {
    label: "Attendance records",
    count: () => prisma.attendance.count({ where: { schoolId } }),
    delete: () => prisma.attendance.deleteMany({ where: { schoolId } }),
  },
  {
    label: "CA activity scores",
    count: () => prisma.cAActivityScore.count({ where: { schoolId } }),
    delete: () => prisma.cAActivityScore.deleteMany({ where: { schoolId } }),
  },
  {
    label: "CA activities",
    count: () => prisma.cAActivity.count({ where: { schoolId } }),
    delete: () => prisma.cAActivity.deleteMany({ where: { schoolId } }),
  },
  {
    label: "CA audit logs",
    count: () => prisma.cAAuditLog.count({ where: { schoolId } }),
    delete: () => prisma.cAAuditLog.deleteMany({ where: { schoolId } }),
  },
  {
    label: "Continuous assessment records",
    count: () => prisma.continuousAssessment.count({ where: { schoolId } }),
    delete: () => prisma.continuousAssessment.deleteMany({ where: { schoolId } }),
  },
  {
    label: "Report card publication states",
    count: () => prisma.reportCardPublication.count({ where: { schoolId } }),
    delete: () => prisma.reportCardPublication.deleteMany({ where: { schoolId } }),
  },
  {
    label: "Exam entry windows",
    count: () => prisma.examEntryWindow.count({ where: { schoolId } }),
    delete: () => prisma.examEntryWindow.deleteMany({ where: { schoolId } }),
  },
  {
    label: "Syllabus topic progress",
    count: () => prisma.syllabusTopicProgress.count({ where: { schoolId } }),
    delete: () => prisma.syllabusTopicProgress.deleteMany({ where: { schoolId } }),
  },
  {
    label: "Homework submissions",
    count: () => prisma.homeworkSubmission.count({ where: { schoolId } }),
    delete: () => prisma.homeworkSubmission.deleteMany({ where: { schoolId } }),
  },
  {
    label: "Result records",
    count: () => prisma.result.count({ where: { schoolId } }),
    delete: () => prisma.result.deleteMany({ where: { schoolId } }),
  },
  {
    label: "Assignments/homework",
    count: () => prisma.assignment.count({ where: { schoolId } }),
    delete: () => prisma.assignment.deleteMany({ where: { schoolId } }),
  },
  {
    label: "Exams",
    count: () => prisma.exam.count({ where: { schoolId } }),
    delete: () => prisma.exam.deleteMany({ where: { schoolId } }),
  },
  {
    label: "Timetable lessons",
    count: () => prisma.lesson.count({ where: { schoolId } }),
    delete: () => prisma.lesson.deleteMany({ where: { schoolId } }),
  },
  {
    label: "Announcements/notices",
    count: () => prisma.announcement.count({ where: { schoolId } }),
    delete: () => prisma.announcement.deleteMany({ where: { schoolId } }),
  },
  {
    label: "Events",
    count: () => prisma.event.count({ where: { schoolId } }),
    delete: () => prisma.event.deleteMany({ where: { schoolId } }),
  },
];

async function main() {
  console.log(`${apply ? "Applying" : "Dry run for"} timetable demo cleanup`);
  console.log(`School: ${schoolId}`);
  console.log("");

  for (const target of targets) {
    const count = await target.count();
    if (!apply) {
      console.log(`${target.label}: ${count}`);
      continue;
    }

    const result = await target.delete();
    console.log(`${target.label}: deleted ${result.count}`);
  }

  console.log("");
  console.log(
    apply
      ? "Cleanup complete. Core school, users, classes, subjects, period templates, CA configs, finance structures, and notification settings were kept."
      : "Dry run complete. Re-run with --apply to permanently delete these records.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
