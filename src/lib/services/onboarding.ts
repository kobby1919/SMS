import { createHash, randomBytes } from "crypto";
import { clerkClient } from "@clerk/nextjs/server";
import prisma from "@/src/lib/prisma";
import type { AuthzContext } from "@/src/lib/authz";
import type { AppRole } from "@/src/lib/roles";

const INVITE_TOKEN_BYTES = 32;

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
      onboardingStatus: true,
      setupStep: true,
      setupCompletedAt: true,
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
  },
  context: AuthzContext,
) {
  return prisma.school.update({
    where: { id: context.schoolId },
    data: {
      name: input.name,
      contactEmail: input.contactEmail || null,
      phone: input.phone || null,
      address: input.address || null,
      onboardingStatus: "PROFILE_DONE",
      setupStep: "academic",
    },
  });
}

export async function completeSchoolOnboarding(context: AuthzContext) {
  const school = await getSchoolOnboardingState(context.schoolId);

  if (!school) {
    throw new Error("School not found.");
  }

  if (school._count.grades === 0 || school._count.classes === 0 || school._count.subjects === 0) {
    throw new Error("Add at least one grade, class, and subject before finishing setup.");
  }

  return prisma.school.update({
    where: { id: context.schoolId },
    data: {
      onboardingStatus: "COMPLETED",
      setupStep: null,
      setupCompletedAt: new Date(),
    },
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

  return prisma.waitlistEntry.update({
    where: { id: request.id },
    data: {
      status: "REJECTED",
      reviewedBy: context.userId,
      reviewedAt: new Date(),
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

  if (!invite || invite.acceptedAt) {
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
