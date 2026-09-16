import prisma from "@/src/lib/prisma";

export const ACTIVE_PARENT_STUDENT_STATUSES = ["ACTIVE"];

const childSelect = {
  id: true,
  name: true,
  surname: true,
  classId: true,
  class: { select: { id: true, name: true, gradeId: true } },
} as const;

async function parentHasRelationshipRows(parentId: string, schoolId: string) {
  const count = await prisma.parentStudentRelationship.count({
    where: { schoolId, parentId },
  });
  return count > 0;
}

/**
 * Returns children a parent can currently access.
 *
 * Relationship rows are the source of truth. Legacy Student.parentId is used
 * only when the parent has not been migrated to relationship rows yet.
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
      student: { select: childSelect },
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

  if (await parentHasRelationshipRows(parentId, schoolId)) {
    return [];
  }

  return prisma.student.findMany({
    where: { schoolId, parentId },
    select: childSelect,
    orderBy: [{ name: "asc" }, { surname: "asc" }],
  });
}

export async function listActiveParentChildIds(parentId: string, schoolId: string) {
  const children = await listActiveParentChildren(parentId, schoolId);
  return children.map((child) => child.id);
}

export async function parentCanAccessStudent({
  schoolId,
  parentId,
  studentId,
}: {
  schoolId: string;
  parentId: string;
  studentId: string;
}) {
  const activeChildIds = await listActiveParentChildIds(parentId, schoolId);
  return activeChildIds.includes(studentId);
}

export async function requireParentStudentAccess({
  schoolId,
  parentId,
  studentId,
}: {
  schoolId: string;
  parentId: string;
  studentId: string;
}) {
  const allowed = await parentCanAccessStudent({ schoolId, parentId, studentId });
  if (!allowed) {
    throw new Error("This ward is not active for your parent account.");
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    select: childSelect,
  });

  if (!student) {
    throw new Error("This ward was not found for your school.");
  }

  return student;
}

/**
 * Returns every active parent that should receive updates for each student.
 * If a student has relationship rows, only ACTIVE rows receive updates. Legacy
 * Student.parentId is used only for students not yet migrated to relationships.
 */
export async function getActiveParentIdsByStudent(schoolId: string, studentIds: string[]) {
  const uniqueStudentIds = [...new Set(studentIds)].filter(Boolean);
  const parentIdsByStudent = new Map<string, string[]>();
  for (const studentId of uniqueStudentIds) {
    parentIdsByStudent.set(studentId, []);
  }

  if (uniqueStudentIds.length === 0) return parentIdsByStudent;

  const [relationshipRows, anyRelationshipRows] = await Promise.all([
    prisma.parentStudentRelationship.findMany({
      where: {
        schoolId,
        studentId: { in: uniqueStudentIds },
        status: "ACTIVE",
        parent: { schoolId },
        student: { schoolId },
      },
      select: { studentId: true, parentId: true },
    }),
    prisma.parentStudentRelationship.findMany({
      where: { schoolId, studentId: { in: uniqueStudentIds } },
      select: { studentId: true },
      distinct: ["studentId"],
    }),
  ]);

  for (const relationship of relationshipRows) {
    parentIdsByStudent.set(relationship.studentId, [
      ...(parentIdsByStudent.get(relationship.studentId) ?? []),
      relationship.parentId,
    ]);
  }

  const studentsWithRelationshipRows = new Set(anyRelationshipRows.map((row) => row.studentId));
  const legacyStudentIds = uniqueStudentIds.filter((studentId) => !studentsWithRelationshipRows.has(studentId));

  if (legacyStudentIds.length > 0) {
    const legacyStudents = await prisma.student.findMany({
      where: { schoolId, id: { in: legacyStudentIds } },
      select: { id: true, parentId: true },
    });

    for (const student of legacyStudents) {
      if (student.parentId) {
        parentIdsByStudent.set(student.id, [student.parentId]);
      }
    }
  }

  return parentIdsByStudent;
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
