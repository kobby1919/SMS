import prisma from "@/src/lib/prisma";
import type {
  ParentAccessAuditAction,
  ParentStudentRelationshipStatus,
  Prisma,
  StudentStatus,
} from "@/src/generated/prisma";
import { writeParentAccessAudit } from "@/src/lib/services/parent-access-audit";

export const ACTIVE_PARENT_STUDENT_STATUSES = ["ACTIVE"];

type ParentChildPermission = "fees" | "reports" | "messages";

type ParentChildAccessOptions = {
  permission?: ParentChildPermission;
};

type ParentStudentRelationshipDb = Prisma.TransactionClient;

const childSelect = {
  id: true,
  name: true,
  surname: true,
  img: true,
  classId: true,
  class: { select: { id: true, name: true, gradeId: true } },
} as const;

function permissionWhere(permission?: ParentChildPermission) {
  if (permission === "fees") return { canViewFees: true };
  if (permission === "reports") return { canViewReports: true };
  if (permission === "messages") return { canMessageSchool: true };
  return {};
}

function permissionLabel(permission?: ParentChildPermission) {
  if (permission === "fees") return "fee information";
  if (permission === "reports") return "academic reports";
  if (permission === "messages") return "school messaging";
  return "this ward";
}

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
export async function listActiveParentChildren(
  parentId: string,
  schoolId: string,
  options: ParentChildAccessOptions = {},
) {
  const relationships = await prisma.parentStudentRelationship.findMany({
    where: {
      schoolId,
      parentId,
      status: "ACTIVE",
      ...permissionWhere(options.permission),
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

export async function listActiveParentChildIds(
  parentId: string,
  schoolId: string,
  options: ParentChildAccessOptions = {},
) {
  const children = await listActiveParentChildren(parentId, schoolId, options);
  return children.map((child) => child.id);
}

export async function parentCanAccessStudent({
  schoolId,
  parentId,
  studentId,
  permission,
}: {
  schoolId: string;
  parentId: string;
  studentId: string;
  permission?: ParentChildPermission;
}) {
  const hasRelationshipRows = await parentHasRelationshipRows(parentId, schoolId);

  if (hasRelationshipRows) {
    const relationship = await prisma.parentStudentRelationship.findFirst({
      where: {
        schoolId,
        parentId,
        studentId,
        status: "ACTIVE",
        ...permissionWhere(permission),
        parent: { schoolId },
        student: { schoolId },
      },
      select: { id: true },
    });

    return Boolean(relationship);
  }

  const legacyStudent = await prisma.student.findFirst({
    where: { id: studentId, schoolId, parentId },
    select: { id: true },
  });

  return Boolean(legacyStudent);
}

export async function requireParentStudentAccess({
  schoolId,
  parentId,
  studentId,
  permission,
}: {
  schoolId: string;
  parentId: string;
  studentId: string;
  permission?: ParentChildPermission;
}) {
  const allowed = await parentCanAccessStudent({ schoolId, parentId, studentId, permission });
  if (!allowed) {
    throw new Error(`This parent account is not allowed to access ${permissionLabel(permission)} for this ward.`);
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

export function parentRelationshipStatusForStudentLifecycle(
  status: StudentStatus,
): ParentStudentRelationshipStatus {
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "TRANSFERRED") return "TRANSFERRED";
  if (status === "GRADUATED") return "GRADUATED";
  return "REMOVED";
}

function auditActionForStudentLifecycle(
  status: StudentStatus,
): ParentAccessAuditAction {
  if (status === "ACTIVE") return "ACCESS_RESTORED";
  if (status === "TRANSFERRED") return "CHILD_TRANSFERRED";
  if (status === "GRADUATED") return "CHILD_GRADUATED";
  return "CHILD_REMOVED";
}

function studentLifecycleRelationshipNote(status: StudentStatus) {
  if (status === "ACTIVE") return null;
  if (status === "INCOMPLETE_SETUP") return "Student setup is incomplete, so parent portal access is paused.";
  if (status === "TRANSFERRED") return "Student has been marked as transferred.";
  if (status === "GRADUATED") return "Student has been marked as graduated.";
  return "Student has been marked as withdrawn.";
}

export async function syncParentRelationshipsForStudentLifecycle(
  db: ParentStudentRelationshipDb,
  {
    schoolId,
    studentId,
    parentId,
    nextStatus,
    actorId,
  }: {
    schoolId: string;
    studentId: string;
    parentId: string;
    nextStatus: StudentStatus;
    actorId?: string | null;
  },
) {
  const nextRelationshipStatus = parentRelationshipStatusForStudentLifecycle(nextStatus);
  const isActive = nextRelationshipStatus === "ACTIVE";
  const endedAt = isActive ? null : new Date();
  const note = studentLifecycleRelationshipNote(nextStatus);
  const performedBy = actorId ?? "system";

  const existingRelationships = await db.parentStudentRelationship.findMany({
    where: { schoolId, studentId },
    select: {
      id: true,
      parentId: true,
      status: true,
      role: true,
    },
  });
  const currentPrimary = existingRelationships.find(
    (relationship) => relationship.parentId === parentId,
  );

  const primaryRelationship = await db.parentStudentRelationship.upsert({
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
      status: nextRelationshipStatus,
      role: "PRIMARY_GUARDIAN",
      canViewFees: isActive,
      canViewReports: isActive,
      canMessageSchool: isActive,
      endedAt,
      note,
      createdById: actorId ?? null,
      updatedById: actorId ?? null,
    },
    update: {
      status: nextRelationshipStatus,
      role: "PRIMARY_GUARDIAN",
      canViewFees: isActive,
      canViewReports: isActive,
      canMessageSchool: isActive,
      endedAt,
      note,
      updatedById: actorId ?? null,
    },
    select: {
      id: true,
      parentId: true,
      status: true,
    },
  });

  if (!currentPrimary || currentPrimary.status !== nextRelationshipStatus) {
    await writeParentAccessAudit(db, {
      schoolId,
      parentId,
      studentId,
      relationshipId: primaryRelationship.id,
      action: currentPrimary
        ? auditActionForStudentLifecycle(nextStatus)
        : isActive
          ? "CHILD_LINKED"
          : auditActionForStudentLifecycle(nextStatus),
      performedBy,
      metadata: {
        source: "student-lifecycle",
        studentStatus: nextStatus,
        relationshipStatus: nextRelationshipStatus,
        previousRelationshipStatus: currentPrimary?.status ?? null,
      },
    });
  }

  const relationshipsToClose = isActive
    ? existingRelationships.filter(
        (relationship) =>
          relationship.parentId !== parentId &&
          relationship.role === "PRIMARY_GUARDIAN" &&
          relationship.status === "ACTIVE",
      )
    : existingRelationships.filter(
        (relationship) =>
          relationship.parentId !== parentId && relationship.status === "ACTIVE",
      );

  if (relationshipsToClose.length === 0) return primaryRelationship;

  await db.parentStudentRelationship.updateMany({
    where: {
      schoolId,
      studentId,
      id: { in: relationshipsToClose.map((relationship) => relationship.id) },
    },
    data: {
      status: isActive ? "REMOVED" : nextRelationshipStatus,
      canViewFees: false,
      canViewReports: false,
      canMessageSchool: false,
      endedAt: new Date(),
      note: isActive
        ? "Primary guardian changed from the student profile."
        : note,
      updatedById: actorId ?? null,
    },
  });

  for (const relationship of relationshipsToClose) {
    await writeParentAccessAudit(db, {
      schoolId,
      parentId: relationship.parentId,
      studentId,
      relationshipId: relationship.id,
      action: isActive ? "CHILD_REMOVED" : auditActionForStudentLifecycle(nextStatus),
      performedBy,
      metadata: {
        source: "student-lifecycle",
        studentStatus: nextStatus,
        relationshipStatus: isActive ? "REMOVED" : nextRelationshipStatus,
        previousRelationshipStatus: relationship.status,
      },
    });
  }

  return primaryRelationship;
}
