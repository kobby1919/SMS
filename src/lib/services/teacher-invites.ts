import { clerkClient } from "@clerk/nextjs/server";
import prisma from "@/src/lib/prisma";
import type { AuthzContext } from "@/src/lib/authz";
import { revalidateDashboard, revalidateReferenceData } from "@/src/lib/cacheTags";
import type { TeacherInviteCreateInput } from "@/src/lib/validation/teacher-invites";
import {
  createTeacherInviteTokenBundle,
  hashTeacherInviteToken,
  isTeacherInviteExpired,
} from "@/src/lib/services/teacher-invite-tokens";
import { sendTeacherInviteEmail } from "@/src/lib/services/notifications";
import type { Prisma, TeacherInviteAuditAction } from "@/src/generated/prisma";
import { normalizeAppRole } from "@/src/lib/roles";

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

function clerkPrimaryEmail(
  user: Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUser"]>>,
) {
  const primaryEmail = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  );

  return primaryEmail?.emailAddress.toLowerCase();
}

export type TeacherInvitePreviewState =
  | "missing"
  | "invalid"
  | "active"
  | "expired"
  | "revoked"
  | "accepted";

export type TeacherInvitePreview = {
  state: TeacherInvitePreviewState;
  usable: boolean;
  inviteId?: string;
  schoolId?: string;
  schoolName?: string;
  schoolSlug?: string;
  teacherName?: string;
  email?: string;
  teacherType?: TeacherInviteCreateInput["teacherType"];
  expiresAt?: Date;
};

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

function schoolDisplayName(school: {
  name: string;
  displayName?: string | null;
  emailFromName?: string | null;
}) {
  return school.emailFromName || school.displayName || school.name;
}

function teacherDisplayName(invite: { name: string; surname: string }) {
  return `${invite.name} ${invite.surname}`.trim();
}

export async function getTeacherInvitePreview(
  token?: string | null,
  now = new Date(),
): Promise<TeacherInvitePreview> {
  const normalizedToken = token?.trim();

  if (!normalizedToken) {
    return { state: "missing", usable: false };
  }

  const invite = await prisma.teacherInvite.findUnique({
    where: { tokenHash: hashTeacherInviteToken(normalizedToken) },
    select: {
      id: true,
      schoolId: true,
      name: true,
      surname: true,
      email: true,
      teacherType: true,
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
    teacherName: teacherDisplayName(invite),
    email: invite.email,
    teacherType: invite.teacherType,
    expiresAt: invite.expiresAt,
  };

  if (invite.acceptedAt || invite.status === "ACCEPTED") {
    return { ...basePreview, state: "accepted", usable: false };
  }

  if (invite.revokedAt || invite.status === "REVOKED") {
    return { ...basePreview, state: "revoked", usable: false };
  }

  if (isTeacherInviteExpired(invite.expiresAt, now) || invite.status === "EXPIRED") {
    if (invite.status === "PENDING") {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.teacherInvite.updateMany({
          where: {
            id: invite.id,
            status: "PENDING",
            acceptedAt: null,
            revokedAt: null,
          },
          data: { status: "EXPIRED" },
        });

        if (updated.count === 1) {
          await writeTeacherInviteAudit(tx, {
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
    const updated = await tx.teacherInvite.updateMany({
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
      throw new TeacherInviteServiceError(
        "This invite is no longer available to resend.",
        409,
      );
    }

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
    const updated = await tx.teacherInvite.updateMany({
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
      throw new TeacherInviteServiceError(
        "This invite is no longer available to revoke.",
        409,
      );
    }

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

export async function acceptTeacherInviteForUser(input: {
  token: string;
  userId: string;
}) {
  const now = new Date();
  const tokenHash = hashTeacherInviteToken(input.token);

  const invite = await prisma.teacherInvite.findUnique({
    where: { tokenHash },
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
    throw new TeacherInviteServiceError("Teacher invite not found.", 404);
  }

  if (invite.acceptedAt || invite.status === "ACCEPTED") {
    throw new TeacherInviteServiceError("This teacher invite has already been accepted.", 409);
  }

  if (invite.revokedAt || invite.status === "REVOKED") {
    throw new TeacherInviteServiceError("This teacher invite has been revoked.", 409);
  }

  if (isTeacherInviteExpired(invite.expiresAt, now) || invite.status === "EXPIRED") {
    throw new TeacherInviteServiceError("This teacher invite has expired.", 409);
  }

  const client = await clerkClient();
  const user = await client.users.getUser(input.userId);
  const signedInEmail = clerkPrimaryEmail(user);
  const existingRole = normalizeAppRole(user.publicMetadata?.role);
  const inviteEmail = invite.email.toLowerCase();

  if (existingRole && existingRole !== "teacher") {
    throw new TeacherInviteServiceError(
      "This signed-in account already belongs to another Edujay role. Sign out and accept the invite with the teacher's own account.",
      409,
    );
  }

  if (!signedInEmail || signedInEmail !== inviteEmail) {
    throw new TeacherInviteServiceError(
      "Please sign in with the email address that received this teacher invite.",
      409,
    );
  }

  const [teacherForUser, teacherForEmail] = await Promise.all([
    prisma.teacher.findUnique({
      where: { id: input.userId },
      select: { id: true, schoolId: true, email: true },
    }),
    prisma.teacher.findFirst({
      where: {
        schoolId: invite.schoolId,
        OR: [{ email: inviteEmail }, { username: inviteEmail }],
      },
      select: { id: true, schoolId: true, email: true },
    }),
  ]);

  if (teacherForUser && teacherForUser.schoolId !== invite.schoolId) {
    throw new TeacherInviteServiceError(
      "This account already belongs to another school on Edujay.",
      409,
    );
  }

  if (teacherForEmail && teacherForEmail.id !== input.userId) {
    throw new TeacherInviteServiceError(
      "This teacher email is already connected to another account in this school.",
      409,
    );
  }

  const acceptedTeacher = await prisma.$transaction(async (tx) => {
    const teacher = teacherForUser
      ? await tx.teacher.update({
          where: { id: input.userId },
          data: {
            schoolId: invite.schoolId,
            username: inviteEmail,
            name: invite.name,
            surname: invite.surname,
            email: inviteEmail,
            phone: invite.phone ?? null,
          },
          select: { id: true },
        })
      : await tx.teacher.create({
          data: {
            id: input.userId,
            schoolId: invite.schoolId,
            username: inviteEmail,
            name: invite.name,
            surname: invite.surname,
            email: inviteEmail,
            phone: invite.phone ?? null,
            address: null,
            bloodType: null,
            sex: null,
          },
          select: { id: true },
        });

    const updated = await tx.teacherInvite.updateMany({
      where: {
        id: invite.id,
        status: "PENDING",
        acceptedAt: null,
        revokedAt: null,
      },
      data: {
        status: "ACCEPTED",
        acceptedAt: now,
        acceptedBy: input.userId,
        acceptedTeacherId: teacher.id,
      },
    });

    if (updated.count !== 1) {
      throw new TeacherInviteServiceError(
        "This invite is no longer available to accept.",
        409,
      );
    }

    await writeTeacherInviteAudit(tx, {
      schoolId: invite.schoolId,
      inviteId: invite.id,
      action: "INVITE_ACCEPTED",
      performedBy: input.userId,
      metadata: {
        email: inviteEmail,
        teacherId: teacher.id,
      },
    });

    return teacher;
  });

  await client.users.updateUserMetadata(input.userId, {
    publicMetadata: {
      ...user.publicMetadata,
      role: "teacher",
      schoolId: invite.schoolId,
    },
  });

  revalidateReferenceData(invite.schoolId, "teachers");
  revalidateReferenceData(invite.schoolId, "timetable");
  revalidateDashboard(invite.schoolId);

  return {
    role: "teacher" as const,
    schoolId: invite.schoolId,
    teacherId: acceptedTeacher.id,
  };
}
