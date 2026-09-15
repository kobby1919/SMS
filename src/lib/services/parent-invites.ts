import prisma from "@/src/lib/prisma";
import type { AuthzContext } from "@/src/lib/authz";
import { revalidateDashboard, revalidateReferenceData } from "@/src/lib/cacheTags";
import type { ParentInviteCreateInput } from "@/src/lib/validation/parent-invites";
import {
  createParentInviteTokenBundle,
  hashParentInviteToken,
  isParentInviteExpired,
} from "@/src/lib/services/parent-invite-tokens";
import { sendParentInviteEmail } from "@/src/lib/services/notifications";
import type { ParentInviteAuditAction, Prisma } from "@/src/generated/prisma";

export type CreatedParentInvite = {
  inviteId: string;
  schoolId: string;
  email: string;
  name: string;
  surname: string;
  studentIds: string[];
  wardNames: string[];
  inviteToken: string;
  invitePath: string;
  inviteUrl: string;
  expiresAt: Date;
  emailProvider?: string;
  emailWarning?: string;
};

export class ParentInviteServiceError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 = 400) {
    super(message);
    this.name = "ParentInviteServiceError";
  }
}

export type ParentInvitePreviewState =
  | "missing"
  | "invalid"
  | "active"
  | "expired"
  | "revoked"
  | "accepted";

export type ParentInvitePreview = {
  state: ParentInvitePreviewState;
  usable: boolean;
  inviteId?: string;
  schoolId?: string;
  schoolName?: string;
  schoolSlug?: string;
  parentName?: string;
  email?: string;
  expiresAt?: Date;
};

async function writeParentInviteAudit(
  tx: Prisma.TransactionClient,
  input: {
    schoolId: string;
    inviteId: string;
    action: ParentInviteAuditAction;
    performedBy: string;
    metadata?: Record<string, unknown>;
  },
) {
  await tx.parentInviteAuditLog.create({
    data: {
      schoolId: input.schoolId,
      inviteId: input.inviteId,
      action: input.action,
      performedBy: input.performedBy,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

function schoolDisplayName(school: {
  name: string;
  displayName?: string | null;
  emailFromName?: string | null;
}) {
  return school.emailFromName || school.displayName || school.name;
}

function parentDisplayName(invite: { name: string; surname: string }) {
  return `${invite.name} ${invite.surname}`.trim();
}

export async function getParentInvitePreview(
  token?: string | null,
  now = new Date(),
): Promise<ParentInvitePreview> {
  const normalizedToken = token?.trim();

  if (!normalizedToken) {
    return { state: "missing", usable: false };
  }

  const invite = await prisma.parentInvite.findUnique({
    where: { tokenHash: hashParentInviteToken(normalizedToken) },
    select: {
      id: true,
      schoolId: true,
      name: true,
      surname: true,
      email: true,
      status: true,
      acceptedAt: true,
      revokedAt: true,
      expiresAt: true,
      school: {
        select: {
          name: true,
          slug: true,
          displayName: true,
          emailFromName: true,
        },
      },
    },
  });

  if (!invite) {
    return { state: "invalid", usable: false };
  }

  const basePreview = {
    inviteId: invite.id,
    schoolId: invite.schoolId,
    schoolName: schoolDisplayName(invite.school),
    schoolSlug: invite.school.slug,
    parentName: parentDisplayName(invite),
    email: invite.email,
    expiresAt: invite.expiresAt,
  };

  if (invite.acceptedAt || invite.status === "ACCEPTED") {
    return { ...basePreview, state: "accepted", usable: false };
  }

  if (invite.revokedAt || invite.status === "REVOKED") {
    return { ...basePreview, state: "revoked", usable: false };
  }

  if (isParentInviteExpired(invite.expiresAt, now) || invite.status === "EXPIRED") {
    if (invite.status === "PENDING") {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.parentInvite.updateMany({
          where: {
            id: invite.id,
            status: "PENDING",
            acceptedAt: null,
            revokedAt: null,
          },
          data: { status: "EXPIRED" },
        });

        if (updated.count === 1) {
          await writeParentInviteAudit(tx, {
            schoolId: invite.schoolId,
            inviteId: invite.id,
            action: "INVITE_EXPIRED",
            performedBy: "system",
            metadata: {
              email: invite.email,
              expiresAt: invite.expiresAt.toISOString(),
            },
          });
        }
      });
    }

    return { ...basePreview, state: "expired", usable: false };
  }

  return { ...basePreview, state: "active", usable: true };
}

export async function createParentInvite(
  input: ParentInviteCreateInput,
  context: AuthzContext,
): Promise<CreatedParentInvite> {
  const now = new Date();
  const email = input.email.trim().toLowerCase();
  const uniqueStudentIds = Array.from(new Set(input.studentIds));

  const [school, existingParent, activeInvite, students] = await Promise.all([
    prisma.school.findUnique({
      where: { id: context.schoolId },
      select: {
        id: true,
        name: true,
        displayName: true,
        emailFromName: true,
      },
    }),
    prisma.parent.findFirst({
      where: { schoolId: context.schoolId, email },
      select: { id: true },
    }),
    prisma.parentInvite.findFirst({
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
    prisma.student.findMany({
      where: {
        schoolId: context.schoolId,
        id: { in: uniqueStudentIds },
      },
      select: {
        id: true,
        name: true,
        surname: true,
        class: { select: { name: true } },
      },
    }),
  ]);

  if (!school) {
    throw new ParentInviteServiceError("School not found.", 404);
  }

  if (existingParent) {
    throw new ParentInviteServiceError(
      "A parent with this email already exists in this school.",
      409,
    );
  }

  if (activeInvite) {
    throw new ParentInviteServiceError(
      "This parent already has an active pending invite.",
      409,
    );
  }

  if (students.length !== uniqueStudentIds.length) {
    throw new ParentInviteServiceError(
      "One or more selected wards do not belong to this school.",
      409,
    );
  }

  const tokenBundle = createParentInviteTokenBundle(now);
  const wardNames = students.map((student) =>
    `${student.name} ${student.surname}`.trim(),
  );

  const invite = await prisma.$transaction(async (tx) => {
    const createdInvite = await tx.parentInvite.create({
      data: {
        schoolId: context.schoolId,
        name: input.name,
        surname: input.surname,
        email,
        phone: input.phone ?? null,
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
        expiresAt: true,
      },
    });

    await writeParentInviteAudit(tx, {
      schoolId: context.schoolId,
      inviteId: createdInvite.id,
      action: "INVITE_CREATED",
      performedBy: context.userId,
      metadata: {
        email: createdInvite.email,
        name: createdInvite.name,
        surname: createdInvite.surname,
        phone: input.phone ?? null,
        studentIds: uniqueStudentIds,
        wardNames,
        expiresAt: createdInvite.expiresAt.toISOString(),
      },
    });

    return createdInvite;
  });

  const schoolName = schoolDisplayName(school);
  const parentName = parentDisplayName(invite);
  const emailResult = await sendParentInviteEmail({
    to: invite.email,
    schoolName,
    parentName,
    wardNames,
    inviteUrl: tokenBundle.inviteUrl,
    expiresAt: tokenBundle.expiresAt,
  });

  await prisma.$transaction(async (tx) => {
    if (emailResult.ok) {
      await tx.parentInvite.update({
        where: { id: invite.id },
        data: { lastSentAt: new Date() },
      });
    }

    await writeParentInviteAudit(tx, {
      schoolId: context.schoolId,
      inviteId: invite.id,
      action: "INVITE_SENT",
      performedBy: context.userId,
      metadata: {
        email: invite.email,
        provider: emailResult.provider,
        warning: emailResult.ok ? undefined : emailResult.message,
      },
    });
  });

  revalidateReferenceData(context.schoolId, "parents");
  revalidateDashboard(context.schoolId);

  return {
    inviteId: invite.id,
    schoolId: invite.schoolId,
    email: invite.email,
    name: invite.name,
    surname: invite.surname,
    studentIds: uniqueStudentIds,
    wardNames,
    inviteToken: tokenBundle.token,
    invitePath: tokenBundle.invitePath,
    inviteUrl: tokenBundle.inviteUrl,
    expiresAt: invite.expiresAt,
    emailProvider: emailResult.provider,
    emailWarning: emailResult.ok ? undefined : emailResult.message,
  };
}

export async function resendParentInvite(
  input: { inviteId: string },
  context: AuthzContext,
) {
  const now = new Date();
  const invite = await prisma.parentInvite.findFirst({
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
    throw new ParentInviteServiceError("Invite not found.", 404);
  }

  if (invite.acceptedAt || invite.status === "ACCEPTED") {
    throw new ParentInviteServiceError("Accepted invites cannot be resent.", 409);
  }

  if (invite.revokedAt || invite.status === "REVOKED") {
    throw new ParentInviteServiceError("Revoked invites cannot be resent.", 409);
  }

  const tokenBundle = createParentInviteTokenBundle(now);
  const parentName = parentDisplayName(invite);
  const schoolName = schoolDisplayName(invite.school);

  await prisma.$transaction(async (tx) => {
    const updated = await tx.parentInvite.updateMany({
      where: {
        id: invite.id,
        schoolId: context.schoolId,
        status: "PENDING",
        acceptedAt: null,
        revokedAt: null,
      },
      data: {
        tokenHash: tokenBundle.tokenHash,
        expiresAt: tokenBundle.expiresAt,
      },
    });

    if (updated.count !== 1) {
      throw new ParentInviteServiceError(
        "This invite is no longer available to resend.",
        409,
      );
    }

    await writeParentInviteAudit(tx, {
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

  const email = await sendParentInviteEmail({
    to: invite.email,
    schoolName,
    parentName,
    wardNames: [],
    inviteUrl: tokenBundle.inviteUrl,
    expiresAt: tokenBundle.expiresAt,
  });

  await prisma.$transaction(async (tx) => {
    if (email.ok) {
      await tx.parentInvite.update({
        where: { id: invite.id },
        data: { lastSentAt: new Date() },
      });
    }

    await writeParentInviteAudit(tx, {
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

  revalidateReferenceData(context.schoolId, "parents");
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

export async function revokeParentInvite(
  input: { inviteId: string },
  context: AuthzContext,
) {
  const invite = await prisma.parentInvite.findFirst({
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
    throw new ParentInviteServiceError("Invite not found.", 404);
  }

  if (invite.acceptedAt || invite.status === "ACCEPTED") {
    throw new ParentInviteServiceError("Accepted invites cannot be revoked.", 409);
  }

  if (invite.revokedAt || invite.status === "REVOKED") {
    throw new ParentInviteServiceError("Invite is already revoked.", 409);
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.parentInvite.updateMany({
      where: {
        id: invite.id,
        schoolId: context.schoolId,
        status: "PENDING",
        acceptedAt: null,
        revokedAt: null,
      },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedBy: context.userId,
      },
    });

    if (updated.count !== 1) {
      throw new ParentInviteServiceError(
        "This invite is no longer available to revoke.",
        409,
      );
    }

    await writeParentInviteAudit(tx, {
      schoolId: context.schoolId,
      inviteId: invite.id,
      action: "INVITE_REVOKED",
      performedBy: context.userId,
      metadata: {
        email: invite.email,
      },
    });
  });

  revalidateReferenceData(context.schoolId, "parents");
  revalidateDashboard(context.schoolId);
}