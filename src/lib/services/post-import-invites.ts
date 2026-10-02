import {
  BursarInviteAuditAction,
  BursarStatus,
  ParentInviteAuditAction,
  Prisma,
  TeacherInviteAuditAction,
  TeacherInviteType,
  TeacherStatus,
} from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { revalidateDashboard, revalidateReferenceData } from "@/src/lib/cacheTags";
import { createBursarInviteTokenBundle } from "@/src/lib/services/bursar-invite-tokens";
import { createParentInviteTokenBundle } from "@/src/lib/services/parent-invite-tokens";
import { createTeacherInviteTokenBundle } from "@/src/lib/services/teacher-invite-tokens";
import {
  sendBursarInviteEmail,
  sendParentInviteEmail,
  sendTeacherInviteEmail,
} from "@/src/lib/services/notifications";

export type PostImportInviteRole = "teachers" | "parents" | "bursars";

export type PostImportInviteSummaryItem = {
  role: PostImportInviteRole;
  label: string;
  importedNeedsInvite: number;
  invited: number;
  active: number;
  blocked: number;
  blockedReason: string;
};

export type PostImportInviteSummary = {
  items: PostImportInviteSummaryItem[];
};

export type PostImportInviteResult = {
  role: PostImportInviteRole;
  created: number;
  skipped: number;
  failed: number;
  warnings: string[];
};

export class PostImportInviteError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PostImportInviteError";
    this.status = status;
  }
}

type InviteContext = {
  schoolId: string;
  actorId: string;
};

function normalizeEmail(value: string | null | undefined) {
  const email = value?.trim().toLowerCase();
  return email || null;
}

function schoolDisplayName(school: {
  name: string;
  displayName?: string | null;
  emailFromName?: string | null;
}) {
  return school.emailFromName || school.displayName || school.name;
}

function displayName(person: { name: string; surname: string }) {
  return `${person.name} ${person.surname}`.trim();
}

async function writeTeacherInviteAudit(
  tx: Prisma.TransactionClient,
  input: {
    schoolId: string;
    inviteId: string;
    action: TeacherInviteAuditAction;
    performedBy: string;
    metadata: Record<string, unknown>;
  },
) {
  await tx.teacherInviteAuditLog.create({
    data: {
      schoolId: input.schoolId,
      inviteId: input.inviteId,
      action: input.action,
      performedBy: input.performedBy,
      metadata: input.metadata as Prisma.InputJsonValue,
    },
  });
}

async function writeParentInviteAudit(
  tx: Prisma.TransactionClient,
  input: {
    schoolId: string;
    inviteId: string;
    action: ParentInviteAuditAction;
    performedBy: string;
    metadata: Record<string, unknown>;
  },
) {
  await tx.parentInviteAuditLog.create({
    data: {
      schoolId: input.schoolId,
      inviteId: input.inviteId,
      action: input.action,
      performedBy: input.performedBy,
      metadata: input.metadata as Prisma.InputJsonValue,
    },
  });
}

async function writeBursarInviteAudit(
  tx: Prisma.TransactionClient,
  input: {
    schoolId: string;
    inviteId: string;
    action: BursarInviteAuditAction;
    performedBy: string;
    metadata: Record<string, unknown>;
  },
) {
  await tx.bursarInviteAuditLog.create({
    data: {
      schoolId: input.schoolId,
      inviteId: input.inviteId,
      action: input.action,
      performedBy: input.performedBy,
      metadata: input.metadata as Prisma.InputJsonValue,
    },
  });
}

async function activeTeacherInviteEmails(schoolId: string, now = new Date()) {
  const invites = await prisma.teacherInvite.findMany({
    where: {
      schoolId,
      status: "PENDING",
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    select: { email: true },
  });
  return new Set(invites.map((invite) => invite.email.toLowerCase()));
}

async function activeParentInviteEmails(schoolId: string, now = new Date()) {
  const invites = await prisma.parentInvite.findMany({
    where: {
      schoolId,
      status: "PENDING",
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    select: { email: true },
  });
  return new Set(invites.map((invite) => invite.email.toLowerCase()));
}

async function activeBursarInviteEmails(schoolId: string, now = new Date()) {
  const invites = await prisma.bursarInvite.findMany({
    where: {
      schoolId,
      status: "PENDING",
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    select: { email: true },
  });
  return new Set(invites.map((invite) => invite.email.toLowerCase()));
}

function pushUniqueEmail<T extends { email: string | null }>(
  rows: T[],
  blockedEmails: Set<string>,
  warnings: string[],
  roleLabel: string,
) {
  const selected: T[] = [];
  const seen = new Set(blockedEmails);

  for (const row of rows) {
    const email = normalizeEmail(row.email);
    if (!email) continue;
    if (seen.has(email)) {
      warnings.push(`${email}: duplicate ${roleLabel} profile or existing invite skipped.`);
      continue;
    }
    seen.add(email);
    selected.push(row);
  }

  return selected;
}

async function hasTeacherInviteConflict(
  tx: Prisma.TransactionClient,
  schoolId: string,
  email: string,
  now: Date,
) {
  const conflict = await tx.teacherInvite.findFirst({
    where: {
      schoolId,
      email,
      OR: [
        { status: "ACCEPTED", acceptedAt: { not: null } },
        { status: "PENDING", acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
      ],
    },
    select: { id: true },
  });
  return Boolean(conflict);
}

async function hasParentInviteConflict(
  tx: Prisma.TransactionClient,
  schoolId: string,
  email: string,
  now: Date,
) {
  const conflict = await tx.parentInvite.findFirst({
    where: {
      schoolId,
      email,
      OR: [
        { status: "ACCEPTED", acceptedAt: { not: null } },
        { status: "PENDING", acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
      ],
    },
    select: { id: true },
  });
  return Boolean(conflict);
}

async function hasBursarInviteConflict(
  tx: Prisma.TransactionClient,
  schoolId: string,
  email: string,
  now: Date,
) {
  const conflict = await tx.bursarInvite.findFirst({
    where: {
      schoolId,
      email,
      OR: [
        { status: "ACCEPTED", acceptedAt: { not: null } },
        { status: "PENDING", acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
      ],
    },
    select: { id: true },
  });
  return Boolean(conflict);
}

export async function getPostImportInviteSummary(
  schoolId: string,
): Promise<PostImportInviteSummary> {
  const now = new Date();
  const [
    teachers,
    parents,
    bursars,
    teacherPendingEmails,
    parentPendingEmails,
    bursarPendingEmails,
    acceptedTeacherEmails,
    acceptedParentEmails,
    acceptedBursarEmails,
  ] = await Promise.all([
    prisma.teacher.findMany({
      where: { schoolId, status: { notIn: [TeacherStatus.SUSPENDED, TeacherStatus.LEFT_SCHOOL] } },
      select: { email: true, sex: true, status: true },
    }),
    prisma.parent.findMany({
      where: { schoolId },
      select: {
        email: true,
        studentRelationships: {
          where: { schoolId, status: "ACTIVE" },
          select: { id: true },
          take: 1,
        },
      },
    }),
    prisma.bursar.findMany({
      where: { schoolId, status: { notIn: [BursarStatus.SUSPENDED, BursarStatus.LEFT_SCHOOL] } },
      select: { email: true, status: true },
    }),
    activeTeacherInviteEmails(schoolId, now),
    activeParentInviteEmails(schoolId, now),
    activeBursarInviteEmails(schoolId, now),
    prisma.teacherInvite.findMany({
      where: { schoolId, status: "ACCEPTED", acceptedAt: { not: null } },
      select: { email: true },
    }),
    prisma.parentInvite.findMany({
      where: { schoolId, status: "ACCEPTED", acceptedAt: { not: null } },
      select: { email: true },
    }),
    prisma.bursarInvite.findMany({
      where: { schoolId, status: "ACCEPTED", acceptedAt: { not: null } },
      select: { email: true },
    }),
  ]);

  const acceptedTeachers = new Set(acceptedTeacherEmails.map((invite) => invite.email.toLowerCase()));
  const acceptedParents = new Set(acceptedParentEmails.map((invite) => invite.email.toLowerCase()));
  const acceptedBursars = new Set(acceptedBursarEmails.map((invite) => invite.email.toLowerCase()));

  const teacherImportedNeedsInvite = teachers.filter((teacher) => {
    const email = normalizeEmail(teacher.email);
    return email && teacher.sex && !teacherPendingEmails.has(email) && !acceptedTeachers.has(email);
  }).length;
  const parentImportedNeedsInvite = parents.filter((parent) => {
    const email = normalizeEmail(parent.email);
    return email && parent.studentRelationships.length > 0 && !parentPendingEmails.has(email) && !acceptedParents.has(email);
  }).length;
  const bursarImportedNeedsInvite = bursars.filter((bursar) => {
    const email = normalizeEmail(bursar.email);
    return email && !bursarPendingEmails.has(email) && !acceptedBursars.has(email);
  }).length;

  const items: PostImportInviteSummaryItem[] = [
    {
        role: "teachers",
        label: "Teachers",
        importedNeedsInvite: teacherImportedNeedsInvite,
        invited: teacherPendingEmails.size,
        active: acceptedTeachers.size,
        blocked: teachers.length - teacherImportedNeedsInvite - teacherPendingEmails.size - acceptedTeachers.size,
        blockedReason: "Missing email, missing sex, suspended, left school, or already handled.",
      },
      {
        role: "parents",
        label: "Parents",
        importedNeedsInvite: parentImportedNeedsInvite,
        invited: parentPendingEmails.size,
        active: acceptedParents.size,
        blocked: parents.length - parentImportedNeedsInvite - parentPendingEmails.size - acceptedParents.size,
        blockedReason: "Missing email, no active ward link, or already handled.",
      },
      {
        role: "bursars",
        label: "Bursars",
        importedNeedsInvite: bursarImportedNeedsInvite,
        invited: bursarPendingEmails.size,
        active: acceptedBursars.size,
        blocked: bursars.length - bursarImportedNeedsInvite - bursarPendingEmails.size - acceptedBursars.size,
        blockedReason: "Missing email, suspended, left school, or already handled.",
      },
  ];

  return {
    items: items.map((item) => ({ ...item, blocked: Math.max(0, item.blocked) })),
  };
}

function teacherTypeForProfile(teacher: {
  classes: Array<{ id: number }>;
  subjects: Array<{ id: number }>;
}): TeacherInviteType {
  if (teacher.classes.length > 0 && teacher.subjects.length > 0) return TeacherInviteType.BOTH;
  if (teacher.classes.length > 0) return TeacherInviteType.CLASS_TEACHER;
  return TeacherInviteType.SUBJECT_TEACHER;
}

async function bulkInviteTeachers(context: InviteContext): Promise<PostImportInviteResult> {
  const now = new Date();
  const [school, pendingEmails, acceptedInvites, teachers] = await Promise.all([
    prisma.school.findUnique({
      where: { id: context.schoolId },
      select: { name: true, displayName: true, emailFromName: true },
    }),
    activeTeacherInviteEmails(context.schoolId, now),
    prisma.teacherInvite.findMany({
      where: { schoolId: context.schoolId, status: "ACCEPTED", acceptedAt: { not: null } },
      select: { email: true },
    }),
    prisma.teacher.findMany({
      where: {
        schoolId: context.schoolId,
        status: { notIn: [TeacherStatus.SUSPENDED, TeacherStatus.LEFT_SCHOOL] },
        email: { not: null },
        sex: { not: null },
      },
      select: {
        id: true,
        name: true,
        surname: true,
        sex: true,
        email: true,
        phone: true,
        classes: { select: { id: true } },
        subjects: { select: { id: true } },
      },
      orderBy: [{ surname: "asc" }, { name: "asc" }],
    }),
  ]);

  if (!school) throw new PostImportInviteError("School not found.", 404);

  const acceptedEmails = new Set(acceptedInvites.map((invite) => invite.email.toLowerCase()));
  const warnings: string[] = [];
  const candidates = pushUniqueEmail(
    teachers,
    new Set([...pendingEmails, ...acceptedEmails]),
    warnings,
    "teacher",
  );
  let created = 0;
  let failed = 0;

  for (const teacher of candidates) {
    const email = normalizeEmail(teacher.email);
    const teacherSex = teacher.sex;
    if (!email || !teacherSex) continue;

    try {
      const tokenBundle = createTeacherInviteTokenBundle(now);
      const invite = await prisma.$transaction(async (tx) => {
        if (await hasTeacherInviteConflict(tx, context.schoolId, email, now)) {
          throw new PostImportInviteError("An active or accepted teacher invite already exists for this email.", 409);
        }

        const createdInvite = await tx.teacherInvite.create({
          data: {
            schoolId: context.schoolId,
            name: teacher.name,
            surname: teacher.surname,
            sex: teacherSex,
            email,
            phone: teacher.phone,
            teacherType: teacherTypeForProfile(teacher),
            tokenHash: tokenBundle.tokenHash,
            expiresAt: tokenBundle.expiresAt,
            createdBy: context.actorId,
          },
          select: { id: true, name: true, surname: true, email: true, teacherType: true },
        });

        await tx.teacher.updateMany({
          where: { id: teacher.id, schoolId: context.schoolId, status: { not: TeacherStatus.ACTIVE } },
          data: { status: TeacherStatus.INVITED },
        });

        await writeTeacherInviteAudit(tx, {
          schoolId: context.schoolId,
          inviteId: createdInvite.id,
          action: "INVITE_CREATED",
          performedBy: context.actorId,
          metadata: {
            source: "post_import_bulk_invite",
            importedTeacherId: teacher.id,
            email,
            teacherType: createdInvite.teacherType,
            expiresAt: tokenBundle.expiresAt.toISOString(),
          },
        });

        return createdInvite;
      });

      const emailResult = await sendTeacherInviteEmail({
        to: email,
        schoolName: schoolDisplayName(school),
        teacherName: displayName(invite),
        inviteUrl: tokenBundle.inviteUrl,
        expiresAt: tokenBundle.expiresAt,
      });

      await prisma.$transaction(async (tx) => {
        if (emailResult.ok) {
          await tx.teacherInvite.update({ where: { id: invite.id }, data: { lastSentAt: new Date() } });
        }
        await writeTeacherInviteAudit(tx, {
          schoolId: context.schoolId,
          inviteId: invite.id,
          action: "INVITE_SENT",
          performedBy: context.actorId,
          metadata: {
            source: "post_import_bulk_invite",
            email,
            provider: emailResult.provider,
            warning: emailResult.ok ? undefined : emailResult.message,
          },
        });
      });

      if (!emailResult.ok) warnings.push(`${email}: ${emailResult.message}`);
      created += 1;
    } catch (error) {
      failed += 1;
      warnings.push(`${email}: ${error instanceof Error ? error.message : "Invite failed."}`);
    }
  }

  revalidateReferenceData(context.schoolId, "teachers");
  revalidateDashboard(context.schoolId);

  return { role: "teachers", created, skipped: teachers.length - candidates.length, failed, warnings };
}

async function bulkInviteParents(context: InviteContext): Promise<PostImportInviteResult> {
  const now = new Date();
  const [school, pendingEmails, acceptedInvites, parents] = await Promise.all([
    prisma.school.findUnique({
      where: { id: context.schoolId },
      select: { name: true, displayName: true, emailFromName: true },
    }),
    activeParentInviteEmails(context.schoolId, now),
    prisma.parentInvite.findMany({
      where: { schoolId: context.schoolId, status: "ACCEPTED", acceptedAt: { not: null } },
      select: { email: true },
    }),
    prisma.parent.findMany({
      where: {
        schoolId: context.schoolId,
        email: { not: null },
        studentRelationships: { some: { schoolId: context.schoolId, status: "ACTIVE" } },
      },
      select: {
        id: true,
        name: true,
        surname: true,
        sex: true,
        email: true,
        phone: true,
        studentRelationships: {
          where: { schoolId: context.schoolId, status: "ACTIVE" },
          select: {
            studentId: true,
            student: { select: { name: true, surname: true, status: true } },
          },
        },
      },
      orderBy: [{ surname: "asc" }, { name: "asc" }],
    }),
  ]);

  if (!school) throw new PostImportInviteError("School not found.", 404);

  const acceptedEmails = new Set(acceptedInvites.map((invite) => invite.email.toLowerCase()));
  const warnings: string[] = [];
  const candidates = pushUniqueEmail(
    parents,
    new Set([...pendingEmails, ...acceptedEmails]),
    warnings,
    "parent",
  );
  let created = 0;
  let failed = 0;

  for (const parent of candidates) {
    const email = normalizeEmail(parent.email);
    const studentIds = parent.studentRelationships
      .filter((relationship) => relationship.student.status === "ACTIVE")
      .map((relationship) => relationship.studentId);
    const wardNames = parent.studentRelationships
      .filter((relationship) => relationship.student.status === "ACTIVE")
      .map((relationship) => displayName(relationship.student));

    if (!email || studentIds.length === 0) continue;

    try {
      const tokenBundle = createParentInviteTokenBundle(now);
      const invite = await prisma.$transaction(async (tx) => {
        if (await hasParentInviteConflict(tx, context.schoolId, email, now)) {
          throw new PostImportInviteError("An active or accepted parent invite already exists for this email.", 409);
        }

        const createdInvite = await tx.parentInvite.create({
          data: {
            schoolId: context.schoolId,
            name: parent.name,
            surname: parent.surname,
            sex: parent.sex,
            email,
            phone: parent.phone,
            tokenHash: tokenBundle.tokenHash,
            expiresAt: tokenBundle.expiresAt,
            createdBy: context.actorId,
          },
          select: { id: true, name: true, surname: true, email: true },
        });

        await tx.parentInviteStudent.createMany({
          data: studentIds.map((studentId) => ({
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
          performedBy: context.actorId,
          metadata: {
            source: "post_import_bulk_invite",
            importedParentId: parent.id,
            email,
            studentIds,
            wardNames,
            expiresAt: tokenBundle.expiresAt.toISOString(),
          },
        });

        return createdInvite;
      });

      const emailResult = await sendParentInviteEmail({
        to: email,
        schoolName: schoolDisplayName(school),
        parentName: displayName(invite),
        wardNames,
        inviteUrl: tokenBundle.inviteUrl,
        expiresAt: tokenBundle.expiresAt,
      });

      await prisma.$transaction(async (tx) => {
        if (emailResult.ok) {
          await tx.parentInvite.update({ where: { id: invite.id }, data: { lastSentAt: new Date() } });
        }
        await writeParentInviteAudit(tx, {
          schoolId: context.schoolId,
          inviteId: invite.id,
          action: "INVITE_SENT",
          performedBy: context.actorId,
          metadata: {
            source: "post_import_bulk_invite",
            email,
            provider: emailResult.provider,
            warning: emailResult.ok ? undefined : emailResult.message,
          },
        });
      });

      if (!emailResult.ok) warnings.push(`${email}: ${emailResult.message}`);
      created += 1;
    } catch (error) {
      failed += 1;
      warnings.push(`${email}: ${error instanceof Error ? error.message : "Invite failed."}`);
    }
  }

  revalidateReferenceData(context.schoolId, "parents");
  revalidateDashboard(context.schoolId);

  return { role: "parents", created, skipped: parents.length - candidates.length, failed, warnings };
}

async function bulkInviteBursars(context: InviteContext): Promise<PostImportInviteResult> {
  const now = new Date();
  const [school, pendingEmails, acceptedInvites, bursars] = await Promise.all([
    prisma.school.findUnique({
      where: { id: context.schoolId },
      select: { name: true, displayName: true, emailFromName: true },
    }),
    activeBursarInviteEmails(context.schoolId, now),
    prisma.bursarInvite.findMany({
      where: { schoolId: context.schoolId, status: "ACCEPTED", acceptedAt: { not: null } },
      select: { email: true },
    }),
    prisma.bursar.findMany({
      where: {
        schoolId: context.schoolId,
        status: { notIn: [BursarStatus.SUSPENDED, BursarStatus.LEFT_SCHOOL] },
        email: { not: null },
      },
      select: { id: true, name: true, surname: true, sex: true, email: true, phone: true },
      orderBy: [{ surname: "asc" }, { name: "asc" }],
    }),
  ]);

  if (!school) throw new PostImportInviteError("School not found.", 404);

  const acceptedEmails = new Set(acceptedInvites.map((invite) => invite.email.toLowerCase()));
  const warnings: string[] = [];
  const candidates = pushUniqueEmail(
    bursars,
    new Set([...pendingEmails, ...acceptedEmails]),
    warnings,
    "bursar",
  );
  let created = 0;
  let failed = 0;

  for (const bursar of candidates) {
    const email = normalizeEmail(bursar.email);
    if (!email) continue;

    try {
      const tokenBundle = createBursarInviteTokenBundle(now);
      const invite = await prisma.$transaction(async (tx) => {
        if (await hasBursarInviteConflict(tx, context.schoolId, email, now)) {
          throw new PostImportInviteError("An active or accepted bursar invite already exists for this email.", 409);
        }

        const createdInvite = await tx.bursarInvite.create({
          data: {
            schoolId: context.schoolId,
            name: bursar.name,
            surname: bursar.surname,
            sex: bursar.sex,
            email,
            phone: bursar.phone,
            tokenHash: tokenBundle.tokenHash,
            expiresAt: tokenBundle.expiresAt,
            createdBy: context.actorId,
          },
          select: { id: true, name: true, surname: true, email: true },
        });

        await writeBursarInviteAudit(tx, {
          schoolId: context.schoolId,
          inviteId: createdInvite.id,
          action: "INVITE_CREATED",
          performedBy: context.actorId,
          metadata: {
            source: "post_import_bulk_invite",
            importedBursarId: bursar.id,
            email,
            expiresAt: tokenBundle.expiresAt.toISOString(),
          },
        });

        return createdInvite;
      });

      const emailResult = await sendBursarInviteEmail({
        to: email,
        schoolName: schoolDisplayName(school),
        bursarName: displayName(invite),
        inviteUrl: tokenBundle.inviteUrl,
        expiresAt: tokenBundle.expiresAt,
      });

      await prisma.$transaction(async (tx) => {
        if (emailResult.ok) {
          await tx.bursarInvite.update({ where: { id: invite.id }, data: { lastSentAt: new Date() } });
        }
        await writeBursarInviteAudit(tx, {
          schoolId: context.schoolId,
          inviteId: invite.id,
          action: "INVITE_SENT",
          performedBy: context.actorId,
          metadata: {
            source: "post_import_bulk_invite",
            email,
            provider: emailResult.provider,
            warning: emailResult.ok ? undefined : emailResult.message,
          },
        });
      });

      if (!emailResult.ok) warnings.push(`${email}: ${emailResult.message}`);
      created += 1;
    } catch (error) {
      failed += 1;
      warnings.push(`${email}: ${error instanceof Error ? error.message : "Invite failed."}`);
    }
  }

  revalidateReferenceData(context.schoolId, "bursars");
  revalidateDashboard(context.schoolId);

  return { role: "bursars", created, skipped: bursars.length - candidates.length, failed, warnings };
}

export async function bulkInviteImportedProfiles(
  role: PostImportInviteRole,
  context: InviteContext,
): Promise<PostImportInviteResult> {
  if (role === "teachers") return bulkInviteTeachers(context);
  if (role === "parents") return bulkInviteParents(context);
  return bulkInviteBursars(context);
}
