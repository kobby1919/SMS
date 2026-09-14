import prisma from "@/src/lib/prisma";
import type { AuthzContext } from "@/src/lib/authz";
import { revalidateDashboard, revalidateReferenceData } from "@/src/lib/cacheTags";
import type { TeacherInviteCreateInput } from "@/src/lib/validation/teacher-invites";
import { createTeacherInviteTokenBundle } from "@/src/lib/services/teacher-invite-tokens";
import { sendTeacherInviteEmail } from "@/src/lib/services/notifications";
import type { Prisma, TeacherInviteAuditAction } from "@/src/generated/prisma";

export type CreatedTeacherInvite = {
  inviteId: string;
  schoolId: string;
  email: string;
  name: string;
  surname: string;
  teacherType: TeacherInviteCreateInput["teacherType"];
  inviteToken: string;
  invitePath: string;
  inviteUrl: string;
  expiresAt: Date;
};

export class TeacherInviteServiceError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 = 400) {
    super(message);
    this.name = "TeacherInviteServiceError";
  }
}

async function writeTeacherInviteAudit(
  tx: Prisma.TransactionClient,
  input: {
    schoolId: string;
    inviteId: string;
    action: TeacherInviteAuditAction;
    performedBy: string;
    metadata?: Record<string, unknown>;
  },
) {
  await tx.teacherInviteAuditLog.create({
    data: {
      schoolId: input.schoolId,
      inviteId: input.inviteId,
      action: input.action,
      performedBy: input.performedBy,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function createTeacherInvite(
  input: TeacherInviteCreateInput,
  context: AuthzContext,
): Promise<CreatedTeacherInvite> {
  const now = new Date();
  const email = input.email.trim().toLowerCase();

  const [school, existingTeacher, activeInvite] = await Promise.all([
    prisma.school.findUnique({
      where: { id: context.schoolId },
      select: { id: true },
    }),
    prisma.teacher.findFirst({
      where: { schoolId: context.schoolId, email },
      select: { id: true },
    }),
    prisma.teacherInvite.findFirst({
      where: {
        schoolId: context.schoolId,
        email,
        status: "PENDING",
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: { id: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!school) {
    throw new TeacherInviteServiceError("School not found.", 404);
  }

  if (existingTeacher) {
    throw new TeacherInviteServiceError(
      "A teacher with this email already exists in this school.",
      409,
    );
  }

  if (activeInvite) {
    throw new TeacherInviteServiceError(
      "This teacher already has an active pending invite.",
      409,
    );
  }

  const tokenBundle = createTeacherInviteTokenBundle(now);

  const invite = await prisma.$transaction(async (tx) => {
    const createdInvite = await tx.teacherInvite.create({
      data: {
        schoolId: context.schoolId,
        name: input.name,
        surname: input.surname,
        email,
        phone: input.phone ?? null,
        teacherType: input.teacherType,
        staffId: input.staffId ?? null,
        employmentType: input.employmentType ?? null,
        tokenHash: tokenBundle.tokenHash,
        expiresAt: tokenBundle.expiresAt,
        createdBy: context.userId,
      },
      select: {
        id: true,
        schoolId: true,
        name: true,
        surname: true,
        email: true,
        teacherType: true,
        expiresAt: true,
      },
    });

    await writeTeacherInviteAudit(tx, {
      schoolId: context.schoolId,
      inviteId: createdInvite.id,
      action: "INVITE_CREATED",
      performedBy: context.userId,
      metadata: {
        email: createdInvite.email,
        name: createdInvite.name,
        surname: createdInvite.surname,
        teacherType: createdInvite.teacherType,
        staffId: input.staffId ?? null,
        employmentType: input.employmentType ?? null,
        expiresAt: createdInvite.expiresAt.toISOString(),
      },
    });

    return createdInvite;
  });

  revalidateReferenceData(context.schoolId, "teachers");
  revalidateDashboard(context.schoolId);

  return {
    inviteId: invite.id,
    schoolId: invite.schoolId,
    email: invite.email,
    name: invite.name,
    surname: invite.surname,
    teacherType: invite.teacherType,
    inviteToken: tokenBundle.token,
    invitePath: tokenBundle.invitePath,
    inviteUrl: tokenBundle.inviteUrl,
    expiresAt: invite.expiresAt,
  };
}

export async function resendTeacherInvite(
  input: { inviteId: string },
  context: AuthzContext,
) {
  const now = new Date();
  const invite = await prisma.teacherInvite.findFirst({
    where: {
      id: input.inviteId,
      schoolId: context.schoolId,
    },
    include: {
      school: {
        select: {
          id: true,
          name: true,
          displayName: true,
          emailFromName: true,
        },
      },
    },
  });

  if (!invite) {
    throw new TeacherInviteServiceError("Invite not found.", 404);
  }

  if (invite.acceptedAt || invite.status === "ACCEPTED") {
    throw new TeacherInviteServiceError("Accepted invites cannot be resent.", 409);
  }

  if (invite.revokedAt || invite.status === "REVOKED") {
    throw new TeacherInviteServiceError("Revoked invites cannot be resent.", 409);
  }

  const tokenBundle = createTeacherInviteTokenBundle(now);
  const teacherName = `${invite.name} ${invite.surname}`.trim();
  const schoolName =
    invite.school.emailFromName ||
    invite.school.displayName ||
    invite.school.name;

  await prisma.$transaction(async (tx) => {
    await tx.teacherInvite.update({
      where: { id: invite.id },
      data: {
        tokenHash: tokenBundle.tokenHash,
        expiresAt: tokenBundle.expiresAt,
        status: "PENDING",
      },
    });

    await writeTeacherInviteAudit(tx, {
      schoolId: context.schoolId,
      inviteId: invite.id,
      action: "INVITE_RESENT",
      performedBy: context.userId,
      metadata: {
        email: invite.email,
        rotatedToken: true,
        expiresAt: tokenBundle.expiresAt.toISOString(),
      },
    });
  });

  const email = await sendTeacherInviteEmail({
    to: invite.email,
    schoolName,
    teacherName,
    inviteUrl: tokenBundle.inviteUrl,
    expiresAt: tokenBundle.expiresAt,
  });

  await prisma.$transaction(async (tx) => {
    if (email.ok) {
      await tx.teacherInvite.update({
        where: { id: invite.id },
        data: { lastSentAt: new Date() },
      });
    }

    await writeTeacherInviteAudit(tx, {
      schoolId: context.schoolId,
      inviteId: invite.id,
      action: "INVITE_SENT",
      performedBy: context.userId,
      metadata: {
        email: invite.email,
        provider: email.provider,
        warning: email.ok ? undefined : email.message,
      },
    });
  });

  revalidateReferenceData(context.schoolId, "teachers");
  revalidateDashboard(context.schoolId);

  return {
    inviteId: invite.id,
    schoolId: invite.schoolId,
    email: invite.email,
    name: invite.name,
    surname: invite.surname,
    inviteToken: tokenBundle.token,
    invitePath: tokenBundle.invitePath,
    inviteUrl: tokenBundle.inviteUrl,
    expiresAt: tokenBundle.expiresAt,
    emailProvider: email.provider,
    emailWarning: email.ok ? undefined : email.message,
  };
}

export async function revokeTeacherInvite(
  input: { inviteId: string },
  context: AuthzContext,
) {
  const invite = await prisma.teacherInvite.findFirst({
    where: {
      id: input.inviteId,
      schoolId: context.schoolId,
    },
    select: {
      id: true,
      schoolId: true,
      email: true,
      acceptedAt: true,
      revokedAt: true,
      status: true,
    },
  });

  if (!invite) {
    throw new TeacherInviteServiceError("Invite not found.", 404);
  }

  if (invite.acceptedAt || invite.status === "ACCEPTED") {
    throw new TeacherInviteServiceError("Accepted invites cannot be revoked.", 409);
  }

  if (invite.revokedAt || invite.status === "REVOKED") {
    throw new TeacherInviteServiceError("Invite is already revoked.", 409);
  }

  await prisma.$transaction(async (tx) => {
    await tx.teacherInvite.update({
      where: { id: invite.id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedBy: context.userId,
      },
    });

    await writeTeacherInviteAudit(tx, {
      schoolId: context.schoolId,
      inviteId: invite.id,
      action: "INVITE_REVOKED",
      performedBy: context.userId,
      metadata: {
        email: invite.email,
      },
    });
  });

  revalidateReferenceData(context.schoolId, "teachers");
  revalidateDashboard(context.schoolId);
}
