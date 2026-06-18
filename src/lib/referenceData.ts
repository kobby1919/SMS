import { unstable_cache } from "next/cache";
import prisma from "@/src/lib/prisma";
import { referenceDataTag } from "@/src/lib/cacheTags";

export async function getCachedClasses(schoolId: string) {
  return unstable_cache(
    () =>
      prisma.class.findMany({
        where: { schoolId },
        select: {
          id: true,
          name: true,
          grade: { select: { level: true, order: true } },
        },
        orderBy: [{ grade: { order: "asc" } }, { name: "asc" }],
      }),
    ["reference-data", "classes", schoolId],
    { revalidate: 60, tags: [referenceDataTag(schoolId, "classes")] },
  )();
}

export async function getCachedGrades(schoolId: string) {
  return unstable_cache(
    () =>
      prisma.grade.findMany({
        where: { schoolId },
        select: { id: true, level: true, order: true },
        orderBy: { order: "asc" },
      }),
    ["reference-data", "grades", schoolId],
    { revalidate: 60, tags: [referenceDataTag(schoolId, "grades")] },
  )();
}

export async function getCachedStudents(schoolId: string) {
  return unstable_cache(
    async () => {
      const students = await prisma.student.findMany({
        where: { schoolId },
        select: {
          id: true,
          name: true,
          surname: true,
          class: { select: { name: true } },
        },
        orderBy: [{ name: "asc" }, { surname: "asc" }],
      });

      return students.map((student) => ({
        id: student.id,
        name: student.name,
        surname: student.surname,
        className: student.class.name,
      }));
    },
    ["reference-data", "students", schoolId],
    { revalidate: 60, tags: [referenceDataTag(schoolId, "students")] },
  )();
}

export async function getCachedSubjects(
  schoolId: string,
  teacherId?: string,
) {
  return unstable_cache(
    () =>
      prisma.subject.findMany({
        where: teacherId
          ? { schoolId, teachers: { some: { id: teacherId, schoolId } } }
          : { schoolId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ["reference-data", "subjects", schoolId, teacherId ?? "all"],
    { revalidate: 60, tags: [referenceDataTag(schoolId, "subjects")] },
  )();
}

export async function getCachedTeachers(schoolId: string) {
  return unstable_cache(
    () =>
      prisma.teacher.findMany({
        where: { schoolId },
        select: {
          id: true,
          name: true,
          surname: true,
          maxClasses: true,
        },
        orderBy: [{ name: "asc" }, { surname: "asc" }],
      }),
    ["reference-data", "teachers", schoolId],
    { revalidate: 60, tags: [referenceDataTag(schoolId, "teachers")] },
  )();
}

export async function getCachedTimetableTeachers(schoolId: string) {
  return unstable_cache(
    () =>
      prisma.teacher.findMany({
        where: { schoolId },
        select: {
          id: true,
          name: true,
          surname: true,
          maxClasses: true,
          subjects: { select: { id: true, name: true } },
        },
        orderBy: [{ name: "asc" }, { surname: "asc" }],
      }),
    ["reference-data", "timetable-teachers", schoolId],
    {
      revalidate: 60,
      tags: [
        referenceDataTag(schoolId, "teachers"),
        referenceDataTag(schoolId, "subjects"),
      ],
    },
  )();
}

export async function getCachedTimetableLessons(schoolId: string) {
  return unstable_cache(
    async () => {
      const lessons = await prisma.lesson.findMany({
        where: { schoolId },
        include: {
          subject: { select: { id: true, name: true } },
          class: { select: { id: true, name: true } },
          teacher: { select: { id: true, name: true, surname: true } },
        },
        orderBy: [{ day: "asc" }, { startTime: "asc" }],
      });

      return lessons.map((lesson) => ({
        id: lesson.id,
        name: lesson.name,
        day: lesson.day,
        startTime: lesson.startTime.toISOString(),
        endTime: lesson.endTime.toISOString(),
        subject: lesson.subject,
        class: lesson.class,
        teacher: lesson.teacher,
      }));
    },
    ["reference-data", "timetable-lessons", schoolId],
    { revalidate: 60, tags: [referenceDataTag(schoolId, "timetable")] },
  )();
}
