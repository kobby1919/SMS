import prisma from "@/src/lib/prisma";

export class TeacherAssignmentSafetyError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
    this.name = "TeacherAssignmentSafetyError";
  }
}

function summarizeExamples(
  rows: Array<{ teacherName?: string | null; subjectName?: string | null; className?: string | null }>,
) {
  return rows
    .slice(0, 3)
    .map((row) => [row.teacherName, row.subjectName, row.className].filter(Boolean).join(" - "))
    .filter(Boolean)
    .join("; ");
}

export async function assertSubjectCapabilityRemovalAllowed({
  schoolId,
  subjectId,
  nextTeacherIds,
}: {
  schoolId: string;
  subjectId: number;
  nextTeacherIds: string[];
}) {
  const where = {
    schoolId,
    subjectId,
    publication: { status: "ACTIVE" as const },
    ...(nextTeacherIds.length > 0 ? { teacherId: { notIn: nextTeacherIds } } : {}),
  };

  const liveLessons = await prisma.publishedTimetableLesson.findMany({
    where,
    select: {
      teacherId: true,
      teacherName: true,
      subjectName: true,
      className: true,
    },
    distinct: ["teacherId", "classId"],
    take: 6,
    orderBy: [{ teacherName: "asc" }, { className: "asc" }],
  });

  if (liveLessons.length === 0) return;

  const examples = summarizeExamples(liveLessons);
  throw new TeacherAssignmentSafetyError(
    `Cannot remove subject capability because the active published timetable still uses it${examples ? ` (${examples})` : ""}. Publish a replacement timetable first, then update the subject capability.`,
  );
}

export async function assertTeacherSubjectRemovalAllowed({
  schoolId,
  teacherId,
  nextSubjectIds,
}: {
  schoolId: string;
  teacherId: string;
  nextSubjectIds: number[];
}) {
  const where = {
    schoolId,
    teacherId,
    publication: { status: "ACTIVE" as const },
    ...(nextSubjectIds.length > 0 ? { subjectId: { notIn: nextSubjectIds } } : {}),
  };

  const liveLessons = await prisma.publishedTimetableLesson.findMany({
    where,
    select: {
      subjectId: true,
      teacherName: true,
      subjectName: true,
      className: true,
    },
    distinct: ["subjectId", "classId"],
    take: 6,
    orderBy: [{ subjectName: "asc" }, { className: "asc" }],
  });

  if (liveLessons.length === 0) return;

  const examples = summarizeExamples(liveLessons);
  throw new TeacherAssignmentSafetyError(
    `Cannot remove this teacher's subject capability because the active published timetable still uses it${examples ? ` (${examples})` : ""}. Publish a replacement timetable first, then update the teacher profile.`,
  );
}

export async function assertTeacherHasNoActivePublishedLessons({
  schoolId,
  teacherId,
  actionLabel,
}: {
  schoolId: string;
  teacherId: string;
  actionLabel: string;
}) {
  const liveLessons = await prisma.publishedTimetableLesson.findMany({
    where: {
      schoolId,
      teacherId,
      publication: { status: "ACTIVE" },
    },
    select: {
      subjectName: true,
      className: true,
      day: true,
    },
    take: 6,
    orderBy: [{ day: "asc" }, { className: "asc" }, { subjectName: "asc" }],
  });

  if (liveLessons.length === 0) return;

  const examples = liveLessons
    .slice(0, 3)
    .map((lesson) => [lesson.subjectName, lesson.className, lesson.day].filter(Boolean).join(" - "))
    .join("; ");

  throw new TeacherAssignmentSafetyError(
    `Cannot ${actionLabel} because this teacher still has lessons in the active published timetable${examples ? ` (${examples})` : ""}. Publish a replacement timetable first so attendance, homework, CA, and accountability do not point to a teacher who cannot operate.`,
  );
}