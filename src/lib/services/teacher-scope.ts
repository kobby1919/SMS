import prisma from "@/src/lib/prisma";
import { listLiveTimetableLessons } from "@/src/lib/services/timetable";

export type TeacherScopeClass = {
  id: number;
  name: string;
  gradeLevel: string;
  studentCount: number;
};

export type TeacherScopeSubject = {
  id: number;
  name: string;
};

export type TeacherScopeTaughtClass = TeacherScopeClass & {
  subjects: TeacherScopeSubject[];
};

export type TeacherScope = {
  teacherId: string;
  isClassTeacher: boolean;
  supervisedClasses: TeacherScopeClass[];
  taughtClasses: TeacherScopeTaughtClass[];
  taughtClassIds: number[];
  supervisedClassIds: number[];
  accessibleClassIds: number[];
  canReviewClassReports: boolean;
  canSubmitClassReportsForReview: boolean;
};

export async function getTeacherScope({
  schoolId,
  teacherId,
}: {
  schoolId: string;
  teacherId: string;
}): Promise<TeacherScope> {
  const [supervisedClasses, liveLessons] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId, supervisorId: teacherId },
      select: {
        id: true,
        name: true,
        grade: { select: { level: true } },
        _count: { select: { students: true } },
      },
      orderBy: { name: "asc" },
    }),
    listLiveTimetableLessons(schoolId, { teacherId }),
  ]);
  const lessonClassIds = [...new Set(liveLessons.map((lesson) => lesson.classId))];
  const lessonClasses = lessonClassIds.length > 0
    ? await prisma.class.findMany({
      where: { schoolId, id: { in: lessonClassIds } },
      select: {
        id: true,
        name: true,
        grade: { select: { level: true } },
        _count: { select: { students: true } },
      },
    })
    : [];
  const classMetaById = new Map(lessonClasses.map((cls) => [cls.id, cls]));

  const taughtClassMap = new Map<number, TeacherScopeTaughtClass>();
  for (const lesson of liveLessons) {
    const classMeta = classMetaById.get(lesson.classId);
    const current = taughtClassMap.get(lesson.classId) ?? {
      id: lesson.classId,
      name: classMeta?.name ?? lesson.class.name,
      gradeLevel: classMeta?.grade.level ?? "",
      studentCount: classMeta?._count.students ?? 0,
      subjects: [],
    };
    if (!current.subjects.some((subject) => subject.id === lesson.subjectId)) {
      current.subjects.push({
        id: lesson.subjectId,
        name: lesson.subject.name,
      });
    }
    taughtClassMap.set(lesson.classId, current);
  }

  const taughtClasses = Array.from(taughtClassMap.values()).map((cls) => ({
    ...cls,
    subjects: cls.subjects.sort((a, b) => a.name.localeCompare(b.name)),
  }));
  const taughtClassIds = taughtClasses.map((cls) => cls.id);
  const supervisedClassIds = supervisedClasses.map((cls) => cls.id);
  const accessibleClassIds = Array.from(new Set([...taughtClassIds, ...supervisedClassIds]));

  return {
    teacherId,
    isClassTeacher: supervisedClasses.length > 0,
    supervisedClasses: supervisedClasses.map((cls) => ({
      id: cls.id,
      name: cls.name,
      gradeLevel: cls.grade.level,
      studentCount: cls._count.students,
    })),
    taughtClasses,
    taughtClassIds,
    supervisedClassIds,
    accessibleClassIds,
    canReviewClassReports: supervisedClasses.length > 0,
    canSubmitClassReportsForReview: supervisedClasses.length > 0,
  };
}
