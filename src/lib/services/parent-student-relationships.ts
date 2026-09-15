import prisma from "@/src/lib/prisma";

export const ACTIVE_PARENT_STUDENT_STATUSES = ["ACTIVE"];


/**
 * Returns children a parent can currently access.
 *
 * During the transition from the legacy Student.parentId field, this falls back
 * to legacy links only when no lifecycle relationship rows exist yet.
 */
export async function listActiveParentChildren(parentId: string, schoolId: string) {
  const relationships = await prisma.parentStudentRelationship.findMany({
    where: {
      schoolId,
      parentId,
      status: "ACTIVE",
      student: { schoolId },
    },
    include: {
      student: {
        include: { class: { select: { id: true, name: true, gradeId: true } } },
      },
    },
    orderBy: [
      { role: "asc" },
      { student: { name: "asc" } },
      { student: { surname: "asc" } },
    ],
  });

  if (relationships.length > 0) {
    return relationships.map((relationship) => relationship.student);
  }

  return prisma.student.findMany({
    where: { schoolId, parentId },
    include: { class: { select: { id: true, name: true, gradeId: true } } },
    orderBy: [{ name: "asc" }, { surname: "asc" }],
  });
}

export async function ensurePrimaryParentStudentRelationship({
  schoolId,
  parentId,
  studentId,
  actorId,
}: {
  schoolId: string;
  parentId: string;
  studentId: string;
  actorId?: string | null;
}) {
  return prisma.parentStudentRelationship.upsert({
    where: {
      schoolId_parentId_studentId: {
        schoolId,
        parentId,
        studentId,
      },
    },
    create: {
      schoolId,
      parentId,
      studentId,
      status: "ACTIVE",
      role: "PRIMARY_GUARDIAN",
      createdById: actorId ?? null,
      updatedById: actorId ?? null,
    },
    update: {
      status: "ACTIVE",
      endedAt: null,
      updatedById: actorId ?? null,
    },
  });
}
