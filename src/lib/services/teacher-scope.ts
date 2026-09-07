import prisma from "@/src/lib/prisma";

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
  const [supervisedClasses, lessons] = await Promise.all([
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
    prisma.lesson.findMany({
      where: { schoolId, teacherId },
      select: {
        class: {
          select: {
            id: true,
            name: true,
            grade: { select: { level: true } },
            _count: { select: { students: true } },
          },
        },
        subject: { select: { id: true, name: true } },
      },
      orderBy: [
        { class: { name: "asc" } },
        { subject: { name: "asc" } },
      ],
    }),
  ]);

  const taughtClassMap = new Map<number, TeacherScopeTaughtClass>();
  for (const lesson of lessons) {
    const current = taughtClassMap.get(lesson.class.id) ?? {
      id: lesson.class.id,
      name: lesson.class.name,
      gradeLevel: lesson.class.grade.level,
      studentCount: lesson.class._count.students,
      subjects: [],
    };
    if (!current.subjects.some((subject) => subject.id === lesson.subject.id)) {
      current.subjects.push({
        id: lesson.subject.id,
        name: lesson.subject.name,
      });
    }
    taughtClassMap.set(lesson.class.id, current);
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

