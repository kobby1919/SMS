import { clerkClient } from "@clerk/nextjs/server";
import prisma from "@/src/lib/prisma";
import type { AuthzContext } from "@/src/lib/authz";
import { revalidateDashboard, revalidateReferenceData } from "@/src/lib/cacheTags";
import type { CollectorInviteCreateInput } from "@/src/lib/validation/collector-invites";
import {
  createCollectorInviteTokenBundle,
  hashCollectorInviteToken,
  isCollectorInviteExpired,
} from "@/src/lib/services/collector-invite-tokens";
import { sendCollectorInviteEmail } from "@/src/lib/services/notifications";
import type { CollectorInviteAuditAction, Prisma } from "@/src/generated/prisma";
import { normalizeAppRole } from "@/src/lib/roles";

export type CreatedCollectorInvite = {
  inviteId: string;
  schoolId: string;
  email: string;
  name: string;
  surname: string;
  sex: CollectorInviteCreateInput["sex"];
  inviteToken: string;
  invitePath: string;
  inviteUrl: string;
  expiresAt: Date;
  emailProvider?: "resend" | "console";
  emailWarning?: string;
};

export class CollectorInviteServiceError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 = 400) {
    super(message);
    this.name = "CollectorInviteServiceError";
  }
}

export type CollectorInvitePreviewState =
  | "missing"
  | "invalid"
  | "active"
  | "expired"
  | "revoked"
  | "accepted";

export type CollectorInvitePreview = {
  state: CollectorInvitePreviewState;
  usable: boolean;
  inviteId?: string;
  schoolId?: string;
  schoolName?: string;
  schoolSlug?: string;
  collectorName?: string;
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

async function writeCollectorInviteAudit(
  tx: Prisma.TransactionClient,
  input: {
    schoolId: string;
    inviteId: string;
    action: CollectorInviteAuditAction;
    performedBy: string;
    metadata?: Record<string, unknown>;
  },
) {
  await tx.collectorInviteAuditLog.create({
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

function collectorDisplayName(invite: { name: string; surname: string }) {
  return `${invite.name} ${invite.surname}`.trim();
}

export async function getCollectorInvitePreview(
  token?: string | null,
  now = new Date(),
): Promise<CollectorInvitePreview> {
  const normalizedToken = token?.trim();

  if (!normalizedToken) {
    return { state: "missing", usable: false };
  }

  const invite = await prisma.collectorInvite.findUnique({
    where: { tokenHash: hashCollectorInviteToken(normalizedToken) },
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
    collectorName: collectorDisplayName(invite),
    email: invite.email,
    expiresAt: invite.expiresAt,
  };

  if (invite.acceptedAt || invite.status === "ACCEPTED") {
    return { ...basePreview, state: "accepted", usable: false };
  }

  if (invite.revokedAt || invite.status === "REVOKED") {
    return { ...basePreview, state: "revoked", usable: false };
  }

  if (isCollectorInviteExpired(invite.expiresAt, now) || invite.status === "EXPIRED") {
    if (invite.status === "PENDING") {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.collectorInvite.updateMany({
          where: {
            id: invite.id,
            status: "PENDING",
            acceptedAt: null,
            revokedAt: null,
          },
          data: { status: "EXPIRED" },
        });

        if (updated.count === 1) {
          await writeCollectorInviteAudit(tx, {
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

export async function createCollectorInvite(
  input: CollectorInviteCreateInput,
  context: AuthzContext,
): Promise<CreatedCollectorInvite> {
  const now = new Date();
  const email = input.email.trim().toLowerCase();

  const [school, existingCollector, activeInvite] = await Promise.all([
    prisma.school.findUnique({
      where: { id: context.schoolId },
      select: { id: true, name: true, displayName: true, emailFromName: true },
    }),
    prisma.collector.findFirst({
      where: { schoolId: context.schoolId, email },
      select: { id: true },
    }),
    prisma.collectorInvite.findFirst({
      where: {
        schoolId: context.schoolId,
        email,
        status: "PENDING",
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!school) {
    throw new CollectorInviteServiceError("School not found.", 404);
  }

  if (existingCollector) {
    throw new CollectorInviteServiceError(
      "A collector with this email already exists in this school.",
      409,
    );
  }

  if (activeInvite) {
    throw new CollectorInviteServiceError(
      "This collector already has an active pending invite.",
      409,
    );
  }

  const tokenBundle = createCollectorInviteTokenBundle(now);

  const invite = await prisma.$transaction(async (tx) => {
    const createdInvite = await tx.collectorInvite.create({
      data: {
        schoolId: context.schoolId,
        name: input.name,
        surname: input.surname,
        sex: input.sex,
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
        sex: true,
        email: true,
        expiresAt: true,
      },
    });

    await writeCollectorInviteAudit(tx, {
      schoolId: context.schoolId,
      inviteId: createdInvite.id,
      action: "INVITE_CREATED",
      performedBy: context.userId,
      metadata: {
        email: createdInvite.email,
        name: createdInvite.name,
        surname: createdInvite.surname,
        sex: createdInvite.sex,
        phone: input.phone ?? null,
        staffId: input.staffId ?? null,
        expiresAt: createdInvite.expiresAt.toISOString(),
      },
    });

    return createdInvite;
  });

  const emailResult = await sendCollectorInviteEmail({
    to: invite.email,
    schoolName: schoolDisplayName(school),
    collectorName: collectorDisplayName(invite),
    inviteUrl: tokenBundle.inviteUrl,
    expiresAt: tokenBundle.expiresAt,
  });

  await prisma.$transaction(async (tx) => {
    if (emailResult.ok) {
      await tx.collectorInvite.update({
        where: { id: invite.id },
        data: { lastSentAt: new Date() },
      });
    }

    await writeCollectorInviteAudit(tx, {
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

  revalidateReferenceData(context.schoolId, "collectors");
  revalidateDashboard(context.schoolId);

  return {
    inviteId: invite.id,
    schoolId: invite.schoolId,
    email: invite.email,
    name: invite.name,
    surname: invite.surname,
    sex: invite.sex,
    inviteToken: tokenBundle.token,
    invitePath: tokenBundle.invitePath,
    inviteUrl: tokenBundle.inviteUrl,
    expiresAt: invite.expiresAt,
    emailProvider: emailResult.provider,
    emailWarning: emailResult.ok ? undefined : emailResult.message,
  };
}

export async function resendCollectorInvite(
  input: { inviteId: string },
  context: AuthzContext,
): Promise<CreatedCollectorInvite> {
  const now = new Date();
  const invite = await prisma.collectorInvite.findFirst({
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
    throw new CollectorInviteServiceError("Invite not found.", 404);
  }

  if (invite.acceptedAt || invite.status === "ACCEPTED") {
    throw new CollectorInviteServiceError("Accepted invites cannot be resent.", 409);
  }

  if (invite.revokedAt || invite.status === "REVOKED") {
    throw new CollectorInviteServiceError("Revoked invites cannot be resent.", 409);
  }

  const tokenBundle = createCollectorInviteTokenBundle(now);

  await prisma.$transaction(async (tx) => {
    const updated = await tx.collectorInvite.updateMany({
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
      throw new CollectorInviteServiceError(
        "This invite is no longer available to resend.",
        409,
      );
    }

    await writeCollectorInviteAudit(tx, {
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

  const emailResult = await sendCollectorInviteEmail({
    to: invite.email,
    schoolName: schoolDisplayName(invite.school),
    collectorName: collectorDisplayName(invite),
    inviteUrl: tokenBundle.inviteUrl,
    expiresAt: tokenBundle.expiresAt,
  });

  await prisma.$transaction(async (tx) => {
    if (emailResult.ok) {
      await tx.collectorInvite.update({
        where: { id: invite.id },
        data: { lastSentAt: new Date() },
      });
    }

    await writeCollectorInviteAudit(tx, {
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

  revalidateReferenceData(context.schoolId, "collectors");
  revalidateDashboard(context.schoolId);

  return {
    inviteId: invite.id,
    schoolId: invite.schoolId,
    email: invite.email,
    name: invite.name,
    surname: invite.surname,
    sex: invite.sex,
    inviteToken: tokenBundle.token,
    invitePath: tokenBundle.invitePath,
    inviteUrl: tokenBundle.inviteUrl,
    expiresAt: invite.expiresAt,
    emailProvider: emailResult.provider,
    emailWarning: emailResult.ok ? undefined : emailResult.message,
  };
}

export async function revokeCollectorInvite(
  input: { inviteId: string },
  context: AuthzContext,
) {
  const invite = await prisma.collectorInvite.findFirst({
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
    throw new CollectorInviteServiceError("Invite not found.", 404);
  }

  if (invite.acceptedAt || invite.status === "ACCEPTED") {
    throw new CollectorInviteServiceError("Accepted invites cannot be revoked.", 409);
  }

  if (invite.revokedAt || invite.status === "REVOKED") {
    throw new CollectorInviteServiceError("Invite is already revoked.", 409);
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.collectorInvite.updateMany({
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
      throw new CollectorInviteServiceError(
        "This invite is no longer available to revoke.",
        409,
      );
    }

    await writeCollectorInviteAudit(tx, {
      schoolId: context.schoolId,
      inviteId: invite.id,
      action: "INVITE_REVOKED",
      performedBy: context.userId,
      metadata: {
        email: invite.email,
      },
    });
  });

  revalidateReferenceData(context.schoolId, "collectors");
  revalidateDashboard(context.schoolId);
}

export async function acceptCollectorInviteForUser(input: {
  token: string;
  userId: string;
}) {
  const now = new Date();
  const tokenHash = hashCollectorInviteToken(input.token);

  const invite = await prisma.collectorInvite.findUnique({
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
    throw new CollectorInviteServiceError("Collector invite not found.", 404);
  }

  if (invite.acceptedAt || invite.status === "ACCEPTED") {
    throw new CollectorInviteServiceError("This collector invite has already been accepted.", 409);
  }

  if (invite.revokedAt || invite.status === "REVOKED") {
    throw new CollectorInviteServiceError("This collector invite has been revoked.", 409);
  }

  if (isCollectorInviteExpired(invite.expiresAt, now) || invite.status === "EXPIRED") {
    throw new CollectorInviteServiceError("This collector invite has expired.", 409);
  }

  const client = await clerkClient();
  const user = await client.users.getUser(input.userId);
  const signedInEmail = clerkPrimaryEmail(user);
  const existingRole = normalizeAppRole(user.publicMetadata?.role);
  const metadataSchoolId = typeof user.publicMetadata?.schoolId === "string"
    ? user.publicMetadata.schoolId
    : null;
  const inviteEmail = invite.email.toLowerCase();

  if (existingRole && existingRole !== "collector") {
    throw new CollectorInviteServiceError(
      "This signed-in account already belongs to another Edujay role. Sign out and accept the invite with the collector's own account.",
      409,
    );
  }

  if (existingRole === "collector" && metadataSchoolId && metadataSchoolId !== invite.schoolId) {
    throw new CollectorInviteServiceError(
      "This collector account already belongs to another school on Edujay. Sign out and accept the invite with the correct account.",
      409,
    );
  }

  if (!signedInEmail || signedInEmail !== inviteEmail) {
    throw new CollectorInviteServiceError(
      "Please sign in with the email address that received this collector invite.",
      409,
    );
  }

  const [collectorForUser, collectorForEmail] = await Promise.all([
    prisma.collector.findUnique({
      where: { id: input.userId },
      select: { id: true, schoolId: true, email: true },
    }),
    prisma.collector.findFirst({
      where: {
        OR: [{ email: inviteEmail }, { username: inviteEmail }],
      },
      select: { id: true, schoolId: true, email: true },
    }),
  ]);

  if (collectorForUser && collectorForUser.schoolId !== invite.schoolId) {
    throw new CollectorInviteServiceError(
      "This account already belongs to another school on Edujay.",
      409,
    );
  }

  if (collectorForEmail && collectorForEmail.schoolId !== invite.schoolId) {
    throw new CollectorInviteServiceError(
      "This collector email is already connected to another school on Edujay.",
      409,
    );
  }

  if (collectorForUser && collectorForEmail && collectorForEmail.id !== collectorForUser.id) {
    throw new CollectorInviteServiceError(
      "This collector email is already connected to another account in this school.",
      409,
    );
  }

  const acceptedCollector = await prisma.$transaction(async (tx) => {
    const importedCollector = !collectorForUser && collectorForEmail ? collectorForEmail : null;
    const collector = collectorForUser
      ? await tx.collector.update({
          where: { id: input.userId },
          data: {
            schoolId: invite.schoolId,
            username: inviteEmail,
            name: invite.name,
            surname: invite.surname,
            sex: invite.sex,
            email: inviteEmail,
            phone: invite.phone ?? null,
            status: "ACTIVE",
          },
          select: { id: true },
        })
      : importedCollector
        ? await tx.collector.update({
            where: { id: importedCollector.id },
            data: {
              id: input.userId,
              schoolId: invite.schoolId,
              username: inviteEmail,
              name: invite.name,
              surname: invite.surname,
              sex: invite.sex,
              email: inviteEmail,
              phone: invite.phone ?? null,
              status: "ACTIVE",
            },
            select: { id: true },
          })
      : await tx.collector.create({
          data: {
            id: input.userId,
            schoolId: invite.schoolId,
            username: inviteEmail,
            name: invite.name,
            surname: invite.surname,
            sex: invite.sex,
            email: inviteEmail,
            phone: invite.phone ?? null,
            address: null,
            status: "ACTIVE",
          },
          select: { id: true },
        });

    const updated = await tx.collectorInvite.updateMany({
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
        acceptedCollectorId: collector.id,
      },
    });

    if (updated.count !== 1) {
      throw new CollectorInviteServiceError(
        "This invite is no longer available to accept.",
        409,
      );
    }

    await writeCollectorInviteAudit(tx, {
      schoolId: invite.schoolId,
      inviteId: invite.id,
      action: "INVITE_ACCEPTED",
      performedBy: input.userId,
      metadata: {
        email: inviteEmail,
        collectorId: collector.id,
        sex: invite.sex,
      },
    });

    return collector;
  });

  await client.users.updateUserMetadata(input.userId, {
    publicMetadata: {
      ...user.publicMetadata,
      role: "collector",
      schoolId: invite.schoolId,
    },
  });

  revalidateReferenceData(invite.schoolId, "collectors");
  revalidateDashboard(invite.schoolId);

  return {
    role: "collector" as const,
    schoolId: invite.schoolId,
    collectorId: acceptedCollector.id,
  };
}
