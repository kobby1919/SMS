"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/authz";
import { parseActionInput } from "@/src/lib/validation/parse";
import {
  parentRelationshipCreateSchema,
  parentRelationshipStatusUpdateSchema,
} from "@/src/lib/validation/parent-relationships";
import type { ParentAccessAuditAction, ParentStudentRelationshipStatus } from "@/src/generated/prisma";
import { writeParentAccessAudit } from "@/src/lib/services/parent-access-audit";

export type ParentRelationshipActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

const INACTIVE_STATUSES: ParentStudentRelationshipStatus[] = [
  "REMOVED",
  "TRANSFERRED",
  "REVOKED",
  "GRADUATED",
];

function statusLabel(status: ParentStudentRelationshipStatus) {
  return status.toLowerCase().replaceAll("_", " ");
}

function auditActionForStatus(status: ParentStudentRelationshipStatus): ParentAccessAuditAction {
  switch (status) {
    case "ACTIVE":
      return "ACCESS_RESTORED";
    case "REMOVED":
      return "CHILD_REMOVED";
    case "REVOKED":
      return "ACCESS_REVOKED";
    case "TRANSFERRED":
      return "CHILD_TRANSFERRED";
    case "GRADUATED":
      return "CHILD_GRADUATED";
    default:
      return "ACCESS_REVOKED";
  }
}

async function syncLegacyStudentParentId({
  schoolId,
  studentId,
  changedParentId,
  status,
}: {
  schoolId: string;
  studentId: string;
  changedParentId: string;
  status: ParentStudentRelationshipStatus;
}) {
  if (status === "ACTIVE") {
    await prisma.student.updateMany({
      where: { id: studentId, schoolId },
      data: { parentId: changedParentId },
    });
    return;
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    select: { parentId: true },
  });
  if (student?.parentId !== changedParentId) return;

  const fallback = await prisma.parentStudentRelationship.findFirst({
    where: {
      schoolId,
      studentId,
      status: "ACTIVE",
      parentId: { not: changedParentId },
    },
    orderBy: [{ role: "asc" }, { updatedAt: "desc" }],
    select: { parentId: true },
  });

  if (!fallback) return;

  await prisma.student.updateMany({
    where: { id: studentId, schoolId, parentId: changedParentId },
    data: { parentId: fallback.parentId },
  });
}

function revalidateParentAccessPaths(parentId: string, studentId?: string) {
  revalidatePath("/list/parents");
  revalidatePath("/parent");
  revalidatePath("/parent/updates");
  revalidatePath("/parent/finance");
  if (studentId) revalidatePath(`/parent/children/${studentId}`);
  if (parentId) revalidatePath("/parent", "layout");
}

export async function addParentWardLinkAction(input: unknown): Promise<ParentRelationshipActionResult> {
  try {
    const { userId, schoolId } = await requireRole(["admin"]);
    const data = parseActionInput(parentRelationshipCreateSchema, input);

    const [parent, student, existingRelationship] = await Promise.all([
      prisma.parent.findFirst({ where: { id: data.parentId, schoolId }, select: { id: true } }),
      prisma.student.findFirst({ where: { id: data.studentId, schoolId }, select: { id: true } }),
      prisma.parentStudentRelationship.findUnique({
        where: {
          schoolId_parentId_studentId: {
            schoolId,
            parentId: data.parentId,
            studentId: data.studentId,
          },
        },
        select: { id: true, status: true, role: true },
      }),
    ]);

    if (!parent) return { ok: false, message: "Parent not found for this school." };
    if (!student) return { ok: false, message: "Ward not found for this school." };

    const relationship = await prisma.parentStudentRelationship.upsert({
      where: {
        schoolId_parentId_studentId: {
          schoolId,
          parentId: data.parentId,
          studentId: data.studentId,
        },
      },
      create: {
        schoolId,
        parentId: data.parentId,
        studentId: data.studentId,
        status: "ACTIVE",
        role: data.role,
        canViewFees: data.canViewFees,
        canViewReports: data.canViewReports,
        canMessageSchool: data.canMessageSchool,
        note: data.note ?? null,
        createdById: userId,
        updatedById: userId,
      },
      update: {
        status: "ACTIVE",
        role: data.role,
        canViewFees: data.canViewFees,
        canViewReports: data.canViewReports,
        canMessageSchool: data.canMessageSchool,
        note: data.note ?? null,
        endedAt: null,
        updatedById: userId,
      },
      select: { id: true, status: true },
    });

    await writeParentAccessAudit(prisma, {
      schoolId,
      action: existingRelationship ? "ACCESS_RESTORED" : "CHILD_LINKED",
      performedBy: userId,
      parentId: data.parentId,
      studentId: data.studentId,
      relationshipId: relationship.id,
      metadata: {
        previousStatus: existingRelationship?.status ?? null,
        role: data.role,
        canViewFees: data.canViewFees,
        canViewReports: data.canViewReports,
        canMessageSchool: data.canMessageSchool,
        note: data.note ?? null,
      },
    });

    await syncLegacyStudentParentId({
      schoolId,
      studentId: data.studentId,
      changedParentId: data.parentId,
      status: "ACTIVE",
    });

    revalidateParentAccessPaths(data.parentId, data.studentId);
    return { ok: true, message: "Ward access has been linked to this parent." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not link ward.",
    };
  }
}

export async function updateParentWardLinkStatusAction(input: unknown): Promise<ParentRelationshipActionResult> {
  try {
    const { userId, schoolId } = await requireRole(["admin"]);
    const data = parseActionInput(parentRelationshipStatusUpdateSchema, input);

    const relationship = await prisma.parentStudentRelationship.findFirst({
      where: { id: data.relationshipId, schoolId },
      select: {
        id: true,
        parentId: true,
        studentId: true,
        status: true,
        role: true,
        canViewFees: true,
        canViewReports: true,
        canMessageSchool: true,
      },
    });

    if (!relationship) return { ok: false, message: "Parent-ward link not found." };

    const isActive = data.status === "ACTIVE";
    await prisma.parentStudentRelationship.update({
      where: { id: relationship.id },
      data: {
        status: data.status,
        canViewFees: isActive ? data.canViewFees : false,
        canViewReports: isActive ? data.canViewReports : false,
        canMessageSchool: isActive ? data.canMessageSchool : false,
        note: data.note ?? null,
        endedAt: INACTIVE_STATUSES.includes(data.status) ? new Date() : null,
        updatedById: userId,
      },
    });

    await writeParentAccessAudit(prisma, {
      schoolId,
      action: auditActionForStatus(data.status),
      performedBy: userId,
      parentId: relationship.parentId,
      studentId: relationship.studentId,
      relationshipId: relationship.id,
      metadata: {
        previousStatus: relationship.status,
        newStatus: data.status,
        previousPermissions: {
          canViewFees: relationship.canViewFees,
          canViewReports: relationship.canViewReports,
          canMessageSchool: relationship.canMessageSchool,
        },
        newPermissions: {
          canViewFees: isActive ? data.canViewFees : false,
          canViewReports: isActive ? data.canViewReports : false,
          canMessageSchool: isActive ? data.canMessageSchool : false,
        },
        note: data.note ?? null,
      },
    });

    await syncLegacyStudentParentId({
      schoolId,
      studentId: relationship.studentId,
      changedParentId: relationship.parentId,
      status: data.status,
    });

    revalidateParentAccessPaths(relationship.parentId, relationship.studentId);
    return { ok: true, message: `Ward link marked ${statusLabel(data.status)}.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not update ward link.",
    };
  }
}
