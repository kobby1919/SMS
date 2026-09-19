import prisma from "@/src/lib/prisma";

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
  throw new Error(
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
  throw new Error(
    `Cannot remove this teacher's subject capability because the active published timetable still uses it${examples ? ` (${examples})` : ""}. Publish a replacement timetable first, then update the teacher profile.`,
  );
}