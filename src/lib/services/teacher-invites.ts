import prisma from "@/src/lib/prisma";
import type { AuthzContext } from "@/src/lib/authz";
import { revalidateDashboard, revalidateReferenceData } from "@/src/lib/cacheTags";
import type { TeacherInviteCreateInput } from "@/src/lib/validation/teacher-invites";
import { createTeacherInviteTokenBundle } from "@/src/lib/services/teacher-invite-tokens";

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

  const invite = await prisma.teacherInvite.create({
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
