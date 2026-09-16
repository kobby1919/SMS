import { clerkClient } from "@clerk/nextjs/server";
import prisma from "@/src/lib/prisma";
import type { AuthzContext } from "@/src/lib/authz";
import { revalidateDashboard, revalidateReferenceData } from "@/src/lib/cacheTags";
import type { BursarInviteCreateInput } from "@/src/lib/validation/bursar-invites";
import {
  createBursarInviteTokenBundle,
  hashBursarInviteToken,
  isBursarInviteExpired,
} from "@/src/lib/services/bursar-invite-tokens";
import type { BursarInviteAuditAction, Prisma } from "@/src/generated/prisma";
import { normalizeAppRole } from "@/src/lib/roles";

export type CreatedBursarInvite = {
  inviteId: string;
  schoolId: string;
  email: string;
  name: string;
  surname: string;
  inviteToken: string;
  invitePath: string;
  inviteUrl: string;
  expiresAt: Date;
};

export class BursarInviteServiceError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 = 400) {
    super(message);
    this.name = "BursarInviteServiceError";
  }
}

export type BursarInvitePreviewState =
  | "missing"
  | "invalid"
  | "active"
  | "expired"
  | "revoked"
  | "accepted";

export type BursarInvitePreview = {
  state: BursarInvitePreviewState;
  usable: boolean;
  inviteId?: string;
  schoolId?: string;
  schoolName?: string;
  schoolSlug?: string;
  bursarName?: string;
  email?: string;
  expiresAt?: Date;
};

function clerkPrimaryEmail(
  user: Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUser"]>>,
) {
  const primaryEmail = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  );

  return primaryEmail?.emailAddress.toLowerCase();
}

async function writeBursarInviteAudit(
  tx: Prisma.TransactionClient,
  input: {
    schoolId: string;
    inviteId: string;
    action: BursarInviteAuditAction;
    performedBy: string;
    metadata?: Record<string, unknown>;
  },
) {
  await tx.bursarInviteAuditLog.create({
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

function bursarDisplayName(invite: { name: string; surname: string }) {
  return `${invite.name} ${invite.surname}`.trim();
}

export async function getBursarInvitePreview(
  token?: string | null,
  now = new Date(),
): Promise<BursarInvitePreview> {
  const normalizedToken = token?.trim();

  if (!normalizedToken) {
    return { state: "missing", usable: false };
  }

  const invite = await prisma.bursarInvite.findUnique({
    where: { tokenHash: hashBursarInviteToken(normalizedToken) },
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
    bursarName: bursarDisplayName(invite),
    email: invite.email,
    expiresAt: invite.expiresAt,
  };

  if (invite.acceptedAt || invite.status === "ACCEPTED") {
    return { ...basePreview, state: "accepted", usable: false };
  }

  if (invite.revokedAt || invite.status === "REVOKED") {
    return { ...basePreview, state: "revoked", usable: false };
  }

  if (isBursarInviteExpired(invite.expiresAt, now) || invite.status === "EXPIRED") {
    if (invite.status === "PENDING") {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.bursarInvite.updateMany({
          where: {
            id: invite.id,
            status: "PENDING",
            acceptedAt: null,
            revokedAt: null,
          },
          data: { status: "EXPIRED" },
        });

        if (updated.count === 1) {
          await writeBursarInviteAudit(tx, {
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

export async function createBursarInvite(
  input: BursarInviteCreateInput,
  context: AuthzContext,
): Promise<CreatedBursarInvite> {
  const now = new Date();
  const email = input.email.trim().toLowerCase();

  const [school, existingBursar, activeInvite] = await Promise.all([
    prisma.school.findUnique({
      where: { id: context.schoolId },
      select: { id: true },
    }),
    prisma.bursar.findFirst({
      where: { schoolId: context.schoolId, email },
      select: { id: true },
    }),
    prisma.bursarInvite.findFirst({
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
    throw new BursarInviteServiceError("School not found.", 404);
  }

  if (existingBursar) {
    throw new BursarInviteServiceError(
      "A bursar with this email already exists in this school.",
      409,
    );
  }

  if (activeInvite) {
    throw new BursarInviteServiceError(
      "This bursar already has an active pending invite.",
      409,
    );
  }

  const tokenBundle = createBursarInviteTokenBundle(now);

  const invite = await prisma.$transaction(async (tx) => {
    const createdInvite = await tx.bursarInvite.create({
      data: {
        schoolId: context.schoolId,
        name: input.name,
        surname: input.surname,
        email,
        phone: input.phone ?? null,
        staffId: input.staffId ?? null,
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

    await writeBursarInviteAudit(tx, {
      schoolId: context.schoolId,
      inviteId: createdInvite.id,
      action: "INVITE_CREATED",
      performedBy: context.userId,
      metadata: {
        email: createdInvite.email,
        name: createdInvite.name,
        surname: createdInvite.surname,
        phone: input.phone ?? null,
        staffId: input.staffId ?? null,
        expiresAt: createdInvite.expiresAt.toISOString(),
      },
    });

    return createdInvite;
  });

  revalidateReferenceData(context.schoolId, "bursars");
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
    expiresAt: invite.expiresAt,
  };
}

export async function resendBursarInvite(
  input: { inviteId: string },
  context: AuthzContext,
): Promise<CreatedBursarInvite> {
  const now = new Date();
  const invite = await prisma.bursarInvite.findFirst({
    where: {
      id: input.inviteId,
      schoolId: context.schoolId,
    },
    select: {
      id: true,
      schoolId: true,
      name: true,
      surname: true,
      email: true,
      acceptedAt: true,
      revokedAt: true,
      status: true,
    },
  });

  if (!invite) {
    throw new BursarInviteServiceError("Invite not found.", 404);
  }

  if (invite.acceptedAt || invite.status === "ACCEPTED") {
    throw new BursarInviteServiceError("Accepted invites cannot be resent.", 409);
  }

  if (invite.revokedAt || invite.status === "REVOKED") {
    throw new BursarInviteServiceError("Revoked invites cannot be resent.", 409);
  }

  const tokenBundle = createBursarInviteTokenBundle(now);

  await prisma.$transaction(async (tx) => {
    const updated = await tx.bursarInvite.updateMany({
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
      throw new BursarInviteServiceError(
        "This invite is no longer available to resend.",
        409,
      );
    }

    await writeBursarInviteAudit(tx, {
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

  revalidateReferenceData(context.schoolId, "bursars");
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
  };
}

export async function revokeBursarInvite(
  input: { inviteId: string },
  context: AuthzContext,
) {
  const invite = await prisma.bursarInvite.findFirst({
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
    throw new BursarInviteServiceError("Invite not found.", 404);
  }

  if (invite.acceptedAt || invite.status === "ACCEPTED") {
    throw new BursarInviteServiceError("Accepted invites cannot be revoked.", 409);
  }

  if (invite.revokedAt || invite.status === "REVOKED") {
    throw new BursarInviteServiceError("Invite is already revoked.", 409);
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.bursarInvite.updateMany({
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
      throw new BursarInviteServiceError(
        "This invite is no longer available to revoke.",
        409,
      );
    }

    await writeBursarInviteAudit(tx, {
      schoolId: context.schoolId,
      inviteId: invite.id,
      action: "INVITE_REVOKED",
      performedBy: context.userId,
      metadata: {
        email: invite.email,
      },
    });
  });

  revalidateReferenceData(context.schoolId, "bursars");
  revalidateDashboard(context.schoolId);
}

export async function acceptBursarInviteForUser(input: {
  token: string;
  userId: string;
}) {
  const now = new Date();
  const tokenHash = hashBursarInviteToken(input.token);

  const invite = await prisma.bursarInvite.findUnique({
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
    throw new BursarInviteServiceError("Bursar invite not found.", 404);
  }

  if (invite.acceptedAt || invite.status === "ACCEPTED") {
    throw new BursarInviteServiceError("This bursar invite has already been accepted.", 409);
  }

  if (invite.revokedAt || invite.status === "REVOKED") {
    throw new BursarInviteServiceError("This bursar invite has been revoked.", 409);
  }

  if (isBursarInviteExpired(invite.expiresAt, now) || invite.status === "EXPIRED") {
    throw new BursarInviteServiceError("This bursar invite has expired.", 409);
  }

  const client = await clerkClient();
  const user = await client.users.getUser(input.userId);
  const signedInEmail = clerkPrimaryEmail(user);
  const existingRole = normalizeAppRole(user.publicMetadata?.role);
  const inviteEmail = invite.email.toLowerCase();

  if (existingRole && existingRole !== "bursar") {
    throw new BursarInviteServiceError(
      "This signed-in account already belongs to another Edujay role. Sign out and accept the invite with the bursar's own account.",
      409,
    );
  }

  if (!signedInEmail || signedInEmail !== inviteEmail) {
    throw new BursarInviteServiceError(
      "Please sign in with the email address that received this bursar invite.",
      409,
    );
  }

  const [bursarForUser, bursarForEmail] = await Promise.all([
    prisma.bursar.findUnique({
      where: { id: input.userId },
      select: { id: true, schoolId: true, email: true },
    }),
    prisma.bursar.findFirst({
      where: {
        schoolId: invite.schoolId,
        OR: [{ email: inviteEmail }, { username: inviteEmail }],
      },
      select: { id: true, schoolId: true, email: true },
    }),
  ]);

  if (bursarForUser && bursarForUser.schoolId !== invite.schoolId) {
    throw new BursarInviteServiceError(
      "This account already belongs to another school on Edujay.",
      409,
    );
  }

  if (bursarForEmail && bursarForEmail.id !== input.userId) {
    throw new BursarInviteServiceError(
      "This bursar email is already connected to another account in this school.",
      409,
    );
  }

  const acceptedBursar = await prisma.$transaction(async (tx) => {
    const bursar = bursarForUser
      ? await tx.bursar.update({
          where: { id: input.userId },
          data: {
            schoolId: invite.schoolId,
            username: inviteEmail,
            name: invite.name,
            surname: invite.surname,
            email: inviteEmail,
            phone: invite.phone ?? null,
            status: "ACTIVE",
          },
          select: { id: true },
        })
      : await tx.bursar.create({
          data: {
            id: input.userId,
            schoolId: invite.schoolId,
            username: inviteEmail,
            name: invite.name,
            surname: invite.surname,
            email: inviteEmail,
            phone: invite.phone ?? null,
            address: null,
            status: "ACTIVE",
          },
          select: { id: true },
        });

    const updated = await tx.bursarInvite.updateMany({
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
        acceptedBursarId: bursar.id,
      },
    });

    if (updated.count !== 1) {
      throw new BursarInviteServiceError(
        "This invite is no longer available to accept.",
        409,
      );
    }

    await writeBursarInviteAudit(tx, {
      schoolId: invite.schoolId,
      inviteId: invite.id,
      action: "INVITE_ACCEPTED",
      performedBy: input.userId,
      metadata: {
        email: inviteEmail,
        bursarId: bursar.id,
      },
    });

    return bursar;
  });

  await client.users.updateUserMetadata(input.userId, {
    publicMetadata: {
      ...user.publicMetadata,
      role: "bursar",
      schoolId: invite.schoolId,
    },
  });

  revalidateReferenceData(invite.schoolId, "bursars");
  revalidateDashboard(invite.schoolId);

  return {
    role: "bursar" as const,
    schoolId: invite.schoolId,
    bursarId: acceptedBursar.id,
  };
}
