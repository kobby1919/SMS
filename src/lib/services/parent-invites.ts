import { clerkClient } from "@clerk/nextjs/server";
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
import { normalizeAppRole } from "@/src/lib/roles";

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
  wardNames?: string[];
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


function clerkPrimaryEmail(
  user: Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUser"]>>,
) {
  const primaryEmail = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  );

  return primaryEmail?.emailAddress.toLowerCase();
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
      students: {
        include: {
          student: {
            select: { name: true, surname: true },
          },
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
    wardNames: invite.students.map((item) => `${item.student.name} ${item.student.surname}`.trim()),
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

    await tx.parentInviteStudent.createMany({
      data: uniqueStudentIds.map((studentId) => ({
        schoolId: context.schoolId,
        inviteId: createdInvite.id,
        studentId,
      })),
      skipDuplicates: true,
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
export async function acceptParentInviteForUser(input: {
  token: string;
  userId: string;
}) {
  const now = new Date();
  const tokenHash = hashParentInviteToken(input.token);

  const invite = await prisma.parentInvite.findUnique({
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
      students: {
        include: {
          student: { select: { id: true, schoolId: true, name: true, surname: true } },
        },
      },
    },
  });

  if (!invite) {
    throw new ParentInviteServiceError("Parent invite not found.", 404);
  }

  if (invite.acceptedAt || invite.status === "ACCEPTED") {
    throw new ParentInviteServiceError("This parent invite has already been accepted.", 409);
  }

  if (invite.revokedAt || invite.status === "REVOKED") {
    throw new ParentInviteServiceError("This parent invite has been revoked.", 409);
  }

  if (isParentInviteExpired(invite.expiresAt, now) || invite.status === "EXPIRED") {
    throw new ParentInviteServiceError("This parent invite has expired.", 409);
  }

  const inviteStudents = invite.students.map((item) => item.student);
  if (inviteStudents.length === 0) {
    throw new ParentInviteServiceError(
      "This parent invite is not linked to any ward. Ask the school admin to send a fresh invite.",
      409,
    );
  }

  if (inviteStudents.some((student) => student.schoolId !== invite.schoolId)) {
    throw new ParentInviteServiceError(
      "This invite contains a ward outside the school. Ask the school admin to send a fresh invite.",
      409,
    );
  }

  const client = await clerkClient();
  const user = await client.users.getUser(input.userId);
  const signedInEmail = clerkPrimaryEmail(user);
  const existingRole = normalizeAppRole(user.publicMetadata?.role);
  const inviteEmail = invite.email.toLowerCase();

  if (existingRole && existingRole !== "parent") {
    throw new ParentInviteServiceError(
      "This signed-in account already belongs to another Edujay role. Sign out and accept the invite with the parent's own account.",
      409,
    );
  }

  if (!signedInEmail || signedInEmail !== inviteEmail) {
    throw new ParentInviteServiceError(
      "Please sign in with the email address that received this parent invite.",
      409,
    );
  }

  const [parentForUser, parentForEmail] = await Promise.all([
    prisma.parent.findUnique({
      where: { id: input.userId },
      select: { id: true, schoolId: true, email: true },
    }),
    prisma.parent.findFirst({
      where: {
        schoolId: invite.schoolId,
        OR: [{ email: inviteEmail }, { username: inviteEmail }],
      },
      select: { id: true, schoolId: true, email: true },
    }),
  ]);

  if (parentForUser && parentForUser.schoolId !== invite.schoolId) {
    throw new ParentInviteServiceError(
      "This account already belongs to another school on Edujay.",
      409,
    );
  }

  if (parentForEmail && parentForEmail.id !== input.userId) {
    throw new ParentInviteServiceError(
      "This parent email is already connected to another account in this school.",
      409,
    );
  }

  const acceptedParent = await prisma.$transaction(async (tx) => {
    const parent = parentForUser
      ? await tx.parent.update({
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
      : await tx.parent.create({
          data: {
            id: input.userId,
            schoolId: invite.schoolId,
            username: inviteEmail,
            name: invite.name,
            surname: invite.surname,
            email: inviteEmail,
            phone: invite.phone ?? null,
            address: "",
          },
          select: { id: true },
        });

    for (const student of inviteStudents) {
      await tx.parentStudentRelationship.upsert({
        where: {
          schoolId_parentId_studentId: {
            schoolId: invite.schoolId,
            parentId: parent.id,
            studentId: student.id,
          },
        },
        create: {
          schoolId: invite.schoolId,
          parentId: parent.id,
          studentId: student.id,
          status: "ACTIVE",
          role: "PRIMARY_GUARDIAN",
          canViewFees: true,
          canViewReports: true,
          canMessageSchool: true,
          createdById: input.userId,
          updatedById: input.userId,
        },
        update: {
          status: "ACTIVE",
          endedAt: null,
          canViewFees: true,
          canViewReports: true,
          canMessageSchool: true,
          updatedById: input.userId,
        },
      });
    }

    const updated = await tx.parentInvite.updateMany({
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
        acceptedParentId: parent.id,
      },
    });

    if (updated.count !== 1) {
      throw new ParentInviteServiceError(
        "This invite is no longer available to accept.",
        409,
      );
    }

    await writeParentInviteAudit(tx, {
      schoolId: invite.schoolId,
      inviteId: invite.id,
      action: "INVITE_ACCEPTED",
      performedBy: input.userId,
      metadata: {
        email: inviteEmail,
        parentId: parent.id,
        studentIds: inviteStudents.map((student) => student.id),
      },
    });

    return parent;
  });

  await client.users.updateUserMetadata(input.userId, {
    publicMetadata: {
      ...user.publicMetadata,
      role: "parent",
      schoolId: invite.schoolId,
    },
  });

  revalidateReferenceData(invite.schoolId, "parents");
  revalidateReferenceData(invite.schoolId, "students");
  revalidateDashboard(invite.schoolId);

  return {
    role: "parent" as const,
    schoolId: invite.schoolId,
    parentId: acceptedParent.id,
  };
}
