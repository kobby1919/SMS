import { createHash, randomBytes } from "crypto";
import { clerkClient } from "@clerk/nextjs/server";
import prisma from "@/src/lib/prisma";
import type { AuthzContext } from "@/src/lib/authz";
import type { AppRole } from "@/src/lib/roles";
import { appBaseUrl, sendFirstAdminInviteEmail } from "@/src/lib/services/notifications";
import type { OnboardingAuditAction, Prisma } from "@/src/generated/prisma";

const INVITE_TOKEN_BYTES = 32;

const DEFAULT_GRADES = [
  { level: "Basic 1", order: 1 },
  { level: "Basic 2", order: 2 },
  { level: "Basic 3", order: 3 },
  { level: "Basic 4", order: 4 },
  { level: "Basic 5", order: 5 },
  { level: "Basic 6", order: 6 },
  { level: "JHS 1", order: 7 },
  { level: "JHS 2", order: 8 },
  { level: "JHS 3", order: 9 },
];

const DEFAULT_SUBJECTS = [
  "English Language",
  "Mathematics",
  "Science",
  "Social Studies",
  "Computing",
  "Creative Arts",
  "Religious and Moral Education",
];

export type CreatedSchoolInvite = {
  schoolId: string;
  schoolName: string;
  inviteId: string;
  email: string;
  inviteToken: string;
  invitePath: string;
  expiresAt: Date;
};

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function writeOnboardingAudit(input: {
  action: OnboardingAuditAction;
  performedBy: string;
  schoolId?: string | null;
  waitlistId?: string | null;
  inviteId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.onboardingAuditLog.create({
    data: {
      action: input.action,
      performedBy: input.performedBy,
      schoolId: input.schoolId ?? null,
      waitlistId: input.waitlistId ?? null,
      inviteId: input.inviteId ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

function createInviteToken(): string {
  return randomBytes(INVITE_TOKEN_BYTES).toString("base64url");
}

function slugifySchoolName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug || `school-${randomBytes(3).toString("hex")}`;
}

async function uniqueSchoolSlug(name: string): Promise<string> {
  const base = slugifySchoolName(name);
  let candidate = base;
  let suffix = 1;

  while (await prisma.school.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}

export async function listWaitlistEntriesForReview() {
  return prisma.waitlistEntry.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      school: {
        select: {
          id: true,
          name: true,
          slug: true,
          onboardingStatus: true,
          invites: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              email: true,
              expiresAt: true,
              acceptedAt: true,
              revokedAt: true,
              lastSentAt: true,
            },
          },
        },
      },
    },
  });
}

export async function getSchoolOnboardingState(schoolId: string) {
  return prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true,
      name: true,
      slug: true,
      contactEmail: true,
      phone: true,
      address: true,
      logoUrl: true,
      onboardingStatus: true,
      setupStep: true,
      setupCompletedAt: true,
      onboardingAuditLogs: {
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          action: true,
          performedBy: true,
          metadata: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          grades: true,
          classes: true,
          subjects: true,
          teachers: true,
          students: true,
        },
      },
    },
  });
}

export async function updateSchoolProfileSetup(
  input: {
    name: string;
    contactEmail?: string;
    phone?: string;
    address?: string;
    logoUrl?: string;
  },
  context: AuthzContext,
) {
  const school = await prisma.school.update({
    where: { id: context.schoolId },
    data: {
      name: input.name,
      contactEmail: input.contactEmail || null,
      phone: input.phone || null,
      address: input.address || null,
      logoUrl: input.logoUrl || null,
      onboardingStatus: "PROFILE_DONE",
      setupStep: "academic",
    },
  });

  await writeOnboardingAudit({
    action: "PROFILE_UPDATED",
    performedBy: context.userId,
    schoolId: context.schoolId,
    metadata: { name: input.name },
  });

  return school;
}

export async function completeSchoolOnboarding(context: AuthzContext) {
  const school = await getSchoolOnboardingState(context.schoolId);

  if (!school) {
    throw new Error("School not found.");
  }

  if (school._count.grades === 0 || school._count.classes === 0 || school._count.subjects === 0) {
    throw new Error("Add at least one grade, class, and subject before finishing setup.");
  }

  const updated = await prisma.school.update({
    where: { id: context.schoolId },
    data: {
      onboardingStatus: "COMPLETED",
      setupStep: null,
      setupCompletedAt: new Date(),
    },
  });

  await writeOnboardingAudit({
    action: "ONBOARDING_COMPLETED",
    performedBy: context.userId,
    schoolId: context.schoolId,
    metadata: {
      grades: school._count.grades,
      classes: school._count.classes,
      subjects: school._count.subjects,
    },
  });

  return updated;
}

export async function createDefaultAcademicSetup(context: AuthzContext) {
  const existing = await getSchoolOnboardingState(context.schoolId);
  if (!existing) {
    throw new Error("School not found.");
  }

  await prisma.$transaction(async (tx) => {
    for (const grade of DEFAULT_GRADES) {
      await tx.grade.upsert({
        where: {
          schoolId_level: {
            schoolId: context.schoolId,
            level: grade.level,
          },
        },
        update: { order: grade.order },
        create: {
          schoolId: context.schoolId,
          level: grade.level,
          order: grade.order,
        },
      });
    }

    for (const subject of DEFAULT_SUBJECTS) {
      await tx.subject.upsert({
        where: {
          schoolId_name: {
            schoolId: context.schoolId,
            name: subject,
          },
        },
        update: {},
        create: {
          schoolId: context.schoolId,
          name: subject,
        },
      });
    }

    const grades = await tx.grade.findMany({
      where: { schoolId: context.schoolId },
      select: { id: true, level: true },
    });

    for (const grade of grades) {
      await tx.class.upsert({
        where: {
          schoolId_name: {
            schoolId: context.schoolId,
            name: `${grade.level} A`,
          },
        },
        update: { gradeId: grade.id },
        create: {
          schoolId: context.schoolId,
          name: `${grade.level} A`,
          capacity: 40,
          gradeId: grade.id,
        },
      });
    }

    await tx.school.update({
      where: { id: context.schoolId },
      data: {
        onboardingStatus: "ACADEMIC_DONE",
        setupStep: "users",
      },
    });
  });

  await writeOnboardingAudit({
    action: "DEFAULT_ACADEMICS_CREATED",
    performedBy: context.userId,
    schoolId: context.schoolId,
    metadata: {
      grades: DEFAULT_GRADES.length,
      subjects: DEFAULT_SUBJECTS.length,
    },
  });
}

export async function recordOnboardingImport(
  input: { importType: "teachers" | "students"; fileName: string; rowCount: number },
  context: AuthzContext,
) {
  await writeOnboardingAudit({
    action: "IMPORT_RECORDED",
    performedBy: context.userId,
    schoolId: context.schoolId,
    metadata: input,
  });
}

export async function getInvitePreview(token: string) {
  const invite = await prisma.schoolInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: {
      id: true,
      email: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      school: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!invite) return null;

  return {
    email: invite.email,
    schoolName: invite.school.name,
    schoolSlug: invite.school.slug,
    expiresAt: invite.expiresAt,
    accepted: Boolean(invite.acceptedAt),
    revoked: Boolean(invite.revokedAt),
    expired: invite.expiresAt.getTime() < Date.now(),
  };
}

export async function approveWaitlistEntry(
  input: { waitlistEntryId: string; expiresInDays: number },
  context: AuthzContext,
): Promise<CreatedSchoolInvite> {
  const request = await prisma.waitlistEntry.findUnique({
    where: { id: input.waitlistEntryId },
  });

  if (!request) {
    throw new Error("Onboarding request not found.");
  }

  if (request.status === "REJECTED") {
    throw new Error("Rejected onboarding requests cannot be approved.");
  }

  if (request.schoolId || request.status === "SCHOOL_CREATED") {
    throw new Error("This onboarding request already has a school.");
  }

  const schoolId = `school_${randomBytes(8).toString("hex")}`;
  const slug = await uniqueSchoolSlug(request.schoolName);
  const inviteToken = createInviteToken();
  const tokenHash = hashInviteToken(inviteToken);
  const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60_000);

  const result = await prisma.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: {
        id: schoolId,
        name: request.schoolName,
        slug,
        contactEmail: request.email.toLowerCase(),
        onboardingStatus: "PENDING_SETUP",
        setupStep: "profile",
      },
      select: {
        id: true,
        name: true,
      },
    });

    const invite = await tx.schoolInvite.create({
      data: {
        schoolId: school.id,
        email: request.email.toLowerCase(),
        role: "ADMIN",
        tokenHash,
        expiresAt,
        createdBy: context.userId,
      },
      select: {
        id: true,
        expiresAt: true,
      },
    });

    await tx.waitlistEntry.update({
      where: { id: request.id },
      data: {
        status: "SCHOOL_CREATED",
        reviewedBy: context.userId,
        reviewedAt: new Date(),
        schoolId: school.id,
      },
    });

    await tx.onboardingAuditLog.createMany({
      data: [
        {
          action: "WAITLIST_APPROVED",
          performedBy: context.userId,
          schoolId: school.id,
          waitlistId: request.id,
          metadata: { email: request.email, schoolName: request.schoolName },
        },
        {
          action: "SCHOOL_CREATED",
          performedBy: context.userId,
          schoolId: school.id,
          waitlistId: request.id,
          metadata: { slug },
        },
        {
          action: "INVITE_CREATED",
          performedBy: context.userId,
          schoolId: school.id,
          waitlistId: request.id,
          inviteId: invite.id,
          metadata: { email: request.email, expiresAt },
        },
      ],
    });

    return { school, invite };
  });

  return {
    schoolId: result.school.id,
    schoolName: result.school.name,
    inviteId: result.invite.id,
    email: request.email.toLowerCase(),
    inviteToken,
    invitePath: `/onboarding/accept?token=${encodeURIComponent(inviteToken)}`,
    expiresAt: result.invite.expiresAt,
  };
}

export async function rejectWaitlistEntry(
  input: { waitlistEntryId: string },
  context: AuthzContext,
) {
  const request = await prisma.waitlistEntry.findUnique({
    where: { id: input.waitlistEntryId },
    select: { id: true, schoolId: true, status: true },
  });

  if (!request) {
    throw new Error("Onboarding request not found.");
  }

  if (request.schoolId || request.status === "SCHOOL_CREATED") {
    throw new Error("A request with a created school cannot be rejected.");
  }

  const rejected = await prisma.waitlistEntry.update({
    where: { id: request.id },
    data: {
      status: "REJECTED",
      reviewedBy: context.userId,
      reviewedAt: new Date(),
    },
  });

  await writeOnboardingAudit({
    action: "WAITLIST_REJECTED",
    performedBy: context.userId,
    waitlistId: request.id,
    metadata: { status: request.status },
  });

  return rejected;
}

export async function resendSchoolInvite(
  input: { inviteId: string },
  context: AuthzContext,
): Promise<CreatedSchoolInvite> {
  const invite = await prisma.schoolInvite.findUnique({
    where: { id: input.inviteId },
    include: { school: { select: { id: true, name: true } } },
  });

  if (!invite) {
    throw new Error("Invite not found.");
  }

  if (invite.acceptedAt) {
    throw new Error("Accepted invites cannot be resent.");
  }

  if (invite.revokedAt) {
    throw new Error("Revoked invites cannot be resent.");
  }

  if (invite.expiresAt.getTime() < Date.now()) {
    throw new Error("Expired invites cannot be resent. Create a fresh onboarding request or invite.");
  }

  const inviteToken = createInviteToken();
  const tokenHash = hashInviteToken(inviteToken);
  const invitePath = `/onboarding/accept?token=${encodeURIComponent(inviteToken)}`;
  const inviteUrl = `${appBaseUrl()}${invitePath}`;

  await sendFirstAdminInviteEmail({
    to: invite.email,
    schoolName: invite.school.name,
    inviteUrl,
    expiresAt: invite.expiresAt,
  });

  await prisma.schoolInvite.update({
    where: { id: invite.id },
    data: {
      tokenHash,
      lastSentAt: new Date(),
    },
  });

  await writeOnboardingAudit({
    action: "INVITE_RESENT",
    performedBy: context.userId,
    schoolId: invite.schoolId,
    inviteId: invite.id,
    metadata: { email: invite.email, rotatedToken: true },
  });

  return {
    schoolId: invite.schoolId,
    schoolName: invite.school.name,
    inviteId: invite.id,
    email: invite.email,
    inviteToken,
    invitePath,
    expiresAt: invite.expiresAt,
  };
}

export async function revokeSchoolInvite(
  input: { inviteId: string },
  context: AuthzContext,
) {
  const invite = await prisma.schoolInvite.findUnique({
    where: { id: input.inviteId },
    select: {
      id: true,
      schoolId: true,
      email: true,
      acceptedAt: true,
      revokedAt: true,
    },
  });

  if (!invite) {
    throw new Error("Invite not found.");
  }

  if (invite.acceptedAt) {
    throw new Error("Accepted invites cannot be revoked.");
  }

  if (invite.revokedAt) {
    throw new Error("Invite is already revoked.");
  }

  await prisma.schoolInvite.update({
    where: { id: invite.id },
    data: {
      revokedAt: new Date(),
      revokedBy: context.userId,
    },
  });

  await writeOnboardingAudit({
    action: "INVITE_REVOKED",
    performedBy: context.userId,
    schoolId: invite.schoolId,
    inviteId: invite.id,
    metadata: { email: invite.email },
  });
}

export async function recordInviteSent(
  input: { inviteId: string; provider: string; warning?: string },
  context: AuthzContext,
) {
  const invite = await prisma.schoolInvite.update({
    where: { id: input.inviteId },
    data: { lastSentAt: new Date() },
    select: {
      id: true,
      schoolId: true,
      email: true,
    },
  });

  await writeOnboardingAudit({
    action: "INVITE_SENT",
    performedBy: context.userId,
    schoolId: invite.schoolId,
    inviteId: invite.id,
    metadata: {
      email: invite.email,
      provider: input.provider,
      warning: input.warning,
    },
  });
}

export function inviteRoleToAppRole(role: "ADMIN"): AppRole {
  return role.toLowerCase() as AppRole;
}

function clerkPrimaryEmail(user: Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUser"]>>) {
  const primaryEmail = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  );

  return primaryEmail?.emailAddress.toLowerCase();
}

export async function acceptSchoolInviteForUser(
  input: { token: string; userId: string },
): Promise<{ role: AppRole; schoolId: string }> {
  const tokenHash = hashInviteToken(input.token);
  const invite = await prisma.schoolInvite.findUnique({
    where: { tokenHash },
    include: {
      school: {
        select: { id: true },
      },
    },
  });

  if (!invite || invite.acceptedAt || invite.revokedAt) {
    throw new Error("This invitation is invalid or has already been used.");
  }

  if (invite.expiresAt.getTime() < Date.now()) {
    throw new Error("This invitation has expired.");
  }

  const client = await clerkClient();
  const user = await client.users.getUser(input.userId);
  const signedInEmail = clerkPrimaryEmail(user);

  if (!signedInEmail || signedInEmail !== invite.email.toLowerCase()) {
    throw new Error("Please sign in with the email address that received this invitation.");
  }

  const role = inviteRoleToAppRole(invite.role);

  await prisma.$transaction(async (tx) => {
    await tx.admin.upsert({
      where: { id: input.userId },
      update: {
        username: invite.email.toLowerCase(),
        schoolId: invite.schoolId,
      },
      create: {
        id: input.userId,
        username: invite.email.toLowerCase(),
        schoolId: invite.schoolId,
      },
    });

    await tx.schoolInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    await tx.onboardingAuditLog.create({
      data: {
        action: "INVITE_ACCEPTED",
        performedBy: input.userId,
        schoolId: invite.schoolId,
        inviteId: invite.id,
        metadata: { email: invite.email },
      },
    });
  });

  await client.users.updateUserMetadata(input.userId, {
    publicMetadata: {
      ...user.publicMetadata,
      role,
      schoolId: invite.schoolId,
    },
  });

  return { role, schoolId: invite.schoolId };
}
