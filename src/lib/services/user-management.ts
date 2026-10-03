import { clerkClient } from "@clerk/nextjs/server";
import { createHash, randomUUID } from "crypto";
import type { z } from "zod";
import { Prisma } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import {
  parentCreateSchema,
  parentUpdateSchema,
  studentCreateSchema,
  studentUpdateSchema,
  teacherCreateSchema,
  teacherUpdateSchema,
} from "@/src/lib/validation/users";
import {
  revalidateDashboard,
  revalidateReferenceData,
} from "@/src/lib/cacheTags";
import {
  syncParentRelationshipsForStudentLifecycle,
} from "@/src/lib/services/parent-student-relationships";
import { writeParentAccessAudit } from "@/src/lib/services/parent-access-audit";
import { nextTeacherProfileStatus } from "@/src/lib/services/teacher-profile-completion";
import { assertTeacherSubjectRemovalAllowed } from "@/src/lib/services/teacher-assignment-safety";
import { writeTeacherAdminAuditLog } from "@/src/lib/services/teacher-admin-audit";
import { validateAdmissionNumberForSchool } from "@/src/lib/admission-number";

type ParentCreateInput = z.infer<typeof parentCreateSchema>;
type ParentUpdateInput = z.infer<typeof parentUpdateSchema>;
type StudentCreateInput = z.infer<typeof studentCreateSchema>;
type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;
type TeacherCreateInput = z.infer<typeof teacherCreateSchema>;
type TeacherUpdateInput = z.infer<typeof teacherUpdateSchema>;

function displayName(user: { name: string; surname?: string | null }) {
  return [user.name, user.surname].filter(Boolean).join(" ");
}

export function studentRecordUsername(schoolId: string, admissionNumber: string) {
  return `student:${schoolId}:${admissionNumber.trim().toUpperCase()}`;
}

function studentSetupStatus(input: { parentId?: string | null; classId?: number | null }) {
  return input.parentId && input.classId ? "ACTIVE" as const : "INCOMPLETE_SETUP" as const;
}

function normalizeEmail(value?: string | null) {
  const email = value?.trim().toLowerCase() ?? "";
  return email || null;
}

function normalizePhone(value?: string | null) {
  const phone = value?.replace(/\s+/g, "").trim() ?? "";
  return phone || null;
}

function generatedParentUsername(schoolId: string, identityKey: string) {
  const hash = createHash("sha256").update(`${schoolId}:${identityKey}`).digest("hex").slice(0, 24);
  return `parent:${schoolId}:${hash}`;
}

function smartParentIdentityKey(input: StudentCreateInput) {
  const email = normalizeEmail(input.parentEmail);
  const phone = normalizePhone(input.parentPhone);
  if (email) return `email:${email}`;
  if (phone) return `phone:${phone}`;
  return null;
}

async function resolveSmartParentForStudent(
  tx: Prisma.TransactionClient,
  schoolId: string,
  input: StudentCreateInput,
) {
  if (input.parentId?.trim()) {
    const parent = await tx.parent.findFirst({
      where: { id: input.parentId.trim(), schoolId },
      select: { id: true },
    });
    if (!parent) throw new UserManagementError("Parent not found.", 404);
    return parent.id;
  }

  const parentEmail = normalizeEmail(input.parentEmail);
  const parentPhone = normalizePhone(input.parentPhone);
  const parentName = input.parentName?.trim();
  const parentSurname = input.parentSurname?.trim();
  const identityKey = smartParentIdentityKey(input);

  if (!parentName || !parentSurname || !identityKey) {
    throw new UserManagementError(
      "Select an existing parent or provide guardian name plus email or phone.",
      400,
    );
  }

  const matchingParents = await tx.parent.findMany({
    where: {
      schoolId,
      OR: [
        ...(parentEmail ? [{ email: { equals: parentEmail, mode: Prisma.QueryMode.insensitive } }] : []),
        ...(parentPhone ? [{ phone: { not: null } }] : []),
      ],
    },
    select: { id: true, email: true, phone: true },
  });

  const emailMatches = parentEmail
    ? matchingParents.filter((parent) => parent.email?.toLowerCase() === parentEmail)
    : [];
  const phoneMatches = parentPhone
    ? matchingParents.filter((parent) => normalizePhone(parent.phone) === parentPhone)
    : [];

  if (emailMatches.length > 1 || phoneMatches.length > 1) {
    throw new UserManagementError(
      "Multiple parent records match this guardian contact. Clean up the parent records before linking this student.",
      409,
    );
  }

  const emailMatch = emailMatches[0] ?? null;
  const phoneMatch = phoneMatches[0] ?? null;

  if (emailMatch && phoneMatch && emailMatch.id !== phoneMatch.id) {
    throw new UserManagementError(
      "Guardian email and phone match two different parents. Fix the parent records before linking this student.",
      409,
    );
  }

  const existingParent = emailMatch ?? phoneMatch;
  if (existingParent) {
    const existingEmail = normalizeEmail(existingParent.email);
    const existingPhone = normalizePhone(existingParent.phone);

    if (parentEmail && existingEmail && existingEmail !== parentEmail) {
      throw new UserManagementError(
        "Guardian phone matches an existing parent, but the email is different. Fix the parent record before linking this student.",
        409,
      );
    }

    if (parentPhone && existingPhone && existingPhone !== parentPhone) {
      throw new UserManagementError(
        "Guardian email matches an existing parent, but the phone is different. Fix the parent record before linking this student.",
        409,
      );
    }

    const updateMissingContact: Prisma.ParentUpdateInput = {};
    if (parentEmail && !existingParent.email) updateMissingContact.email = parentEmail;
    if (parentPhone && !existingParent.phone) updateMissingContact.phone = parentPhone;

    if (Object.keys(updateMissingContact).length > 0) {
      await tx.parent.update({
        where: { id: existingParent.id },
        data: updateMissingContact,
      });
    }

    return existingParent.id;
  }

  const parent = await tx.parent.create({
    data: {
      id: `par_${randomUUID()}`,
      schoolId,
      username: generatedParentUsername(schoolId, identityKey),
      name: parentName,
      surname: parentSurname,
      email: parentEmail,
      phone: parentPhone,
      address: input.address || "Not provided",
    },
    select: { id: true },
  });

  return parent.id;
}

export class UserManagementError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "UserManagementError";
  }
}

function isClerkIdentifierExistsError(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "errors" in error &&
    Array.isArray((error as { errors?: unknown }).errors) &&
    (error as { errors: Array<{ code?: string }> }).errors[0]?.code ===
      "form_identifier_exists";
}

async function removeClerkUserQuietly(userId: string) {
  try {
    const clerk = await clerkClient();
    await clerk.users.deleteUser(userId);
  } catch (error) {
    console.error("[user-management] failed to compensate Clerk user", {
      userId,
      error,
    });
  }
}

async function restoreClerkNameQuietly(
  userId: string,
  firstName: string,
  lastName: string,
) {
  try {
    const clerk = await clerkClient();
    await clerk.users.updateUser(userId, { firstName, lastName });
  } catch (error) {
    console.error("[user-management] failed to restore Clerk user name", {
      userId,
      error,
    });
  }
}

export async function createTeacher(
  schoolId: string,
  input: TeacherCreateInput,
) {
  const subjects = input.subjectIds.length
    ? await prisma.subject.findMany({
        where: { id: { in: input.subjectIds }, schoolId },
        select: { id: true },
      })
    : [];

  if (subjects.length !== input.subjectIds.length) {
    throw new UserManagementError("One or more subjects were not found.", 404);
  }

  const clerk = await clerkClient();
  let clerkUserId: string;
  try {
    const clerkUser = await clerk.users.createUser({
      username: input.username,
      emailAddress: [input.email],
      password: input.password,
      firstName: input.name,
      lastName: input.surname,
      publicMetadata: { role: "teacher", schoolId },
    });
    clerkUserId = clerkUser.id;
  } catch (error) {
    if (isClerkIdentifierExistsError(error)) {
      throw new UserManagementError("Username or email already exists.", 409);
    }
    throw error;
  }

  try {
    const teacher = await prisma.teacher.create({
      data: {
        id: clerkUserId,
        schoolId,
        username: input.username,
        name: input.name,
        surname: input.surname,
        email: input.email,
        phone: input.phone || null,
        address: input.address,
        bloodType: input.bloodType,
        sex: input.sex,
        status: nextTeacherProfileStatus({
          name: input.name,
          surname: input.surname,
          email: input.email,
          phone: input.phone || null,
          address: input.address,
        }),
        subjects: subjects.length
          ? { connect: subjects.map(({ id }) => ({ id })) }
          : undefined,
      },
    });

    revalidateReferenceData(schoolId, "teachers");
    if (input.subjectIds.length) revalidateReferenceData(schoolId, "subjects");
    revalidateReferenceData(schoolId, "timetable");
    revalidateDashboard(schoolId);
    return teacher;
  } catch (error) {
    await removeClerkUserQuietly(clerkUserId);
    throw error;
  }
}

export async function createStudent(
  schoolId: string,
  input: StudentCreateInput,
  actor: { userId: string } = { userId: "system" },
) {
  const admissionNumber = input.admissionNumber.trim().toUpperCase();
  const [school, studentClass, existingAdmission] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { code: true },
    }),
    prisma.class.findFirst({
      where: { id: input.classId, schoolId },
      select: { gradeId: true },
    }),
    prisma.student.findFirst({
      where: { schoolId, admissionNumber },
      select: { id: true },
    }),
  ]);

  if (!school?.code) throw new UserManagementError("Save the school code before creating students.", 400);
  const admissionCheck = validateAdmissionNumberForSchool(admissionNumber, school.code);
  if (!admissionCheck.ok) {
    throw new UserManagementError(admissionCheck.message ?? "Admission number format is not valid.", 400);
  }
  if (!studentClass) throw new UserManagementError("Class not found.", 404);
  if (existingAdmission) throw new UserManagementError("Admission number already exists for this school.", 409);

  try {
    const student = await prisma.$transaction(async (tx) => {
      const parentId = await resolveSmartParentForStudent(tx, schoolId, input);

      const row = await tx.student.create({
        data: {
          id: `stu_${randomUUID()}`,
          schoolId,
          username: studentRecordUsername(schoolId, admissionNumber),
          admissionNumber,
          name: input.name,
          surname: input.surname,
          email: input.email || null,
          phone: input.phone || null,
          address: input.address,
          bloodType: input.bloodType,
          sex: input.sex,
          status: studentSetupStatus({ parentId, classId: input.classId }),
          classId: input.classId,
          gradeId: studentClass.gradeId,
          parentId,
        },
      });

      await syncParentRelationshipsForStudentLifecycle(tx, {
        schoolId,
        parentId,
        studentId: row.id,
        nextStatus: row.status,
        actorId: actor.userId,
      });

      return row;
    });

    revalidateReferenceData(schoolId, "students");
    revalidateReferenceData(schoolId, "parents");
    revalidateDashboard(schoolId);
    return student;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new UserManagementError("Admission number already exists for this school.", 409);
    }
    throw error;
  }
}

export async function createParent(
  schoolId: string,
  input: ParentCreateInput,
) {
  const existing = await prisma.parent.findFirst({
    where: { username: input.username, schoolId },
    select: { id: true },
  });
  if (existing) throw new UserManagementError("Username already taken.", 409);

  const parent = await prisma.parent.create({
    data: {
      id: input.username,
      schoolId,
      username: input.username,
      name: input.name,
      surname: input.surname,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address,
    },
  });
  revalidateDashboard(schoolId);
  return parent;
}

export async function listParents(schoolId: string) {
  return prisma.parent.findMany({
    where: { schoolId },
    select: { id: true, name: true, surname: true },
    orderBy: [{ name: "asc" }, { surname: "asc" }],
  });
}

export async function updateTeacher(
  schoolId: string,
  teacherId: string,
  input: TeacherUpdateInput,
  actor: { userId: string; role: string } = { userId: "system", role: "system" },
) {
  const [teacher, subjects] = await Promise.all([
    prisma.teacher.findFirst({
      where: { id: teacherId, schoolId },
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
        status: true,
        subjects: { select: { id: true, name: true } },
      },
    }),
    input.subjectIds.length
      ? prisma.subject.findMany({
          where: { id: { in: input.subjectIds }, schoolId },
          select: { id: true, name: true },
        })
      : [],
  ]);
  if (!teacher) throw new UserManagementError("Teacher not found.", 404);
  if (subjects.length !== input.subjectIds.length) {
    throw new UserManagementError("One or more subjects were not found.", 404);
  }

  await assertTeacherSubjectRemovalAllowed({
    schoolId,
    teacherId,
    nextSubjectIds: subjects.map(({ id }) => id),
  });

  const previousSubjectIds = teacher.subjects.map((subject) => subject.id);
  const nextSubjectIds = subjects.map((subject) => subject.id);
  const addedSubjects = subjects.filter((subject) => !previousSubjectIds.includes(subject.id));
  const removedSubjects = teacher.subjects.filter((subject) => !nextSubjectIds.includes(subject.id));
  const subjectCapabilityChanged = addedSubjects.length > 0 || removedSubjects.length > 0;

  const clerk = await clerkClient();
  await clerk.users.updateUser(teacherId, {
    firstName: input.name,
    lastName: input.surname,
  });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.teacher.update({
        where: { id: teacherId },
        data: {
          name: input.name,
          surname: input.surname,
          phone: input.phone || null,
          address: input.address,
          bloodType: input.bloodType,
          sex: input.sex,
          status: nextTeacherProfileStatus({
            status: teacher.status,
            name: input.name,
            surname: input.surname,
            email: teacher.email,
            phone: input.phone || null,
            address: input.address,
          }),
          subjects: { set: subjects.map(({ id }) => ({ id })) },
        },
      });

      if (subjectCapabilityChanged) {
        await writeTeacherAdminAuditLog(tx, {
          schoolId,
          teacherId,
          actorId: actor.userId,
          actorRole: actor.role,
          sourceModel: "TEACHER_PROFILE_SUBJECTS",
          sourceId: teacherId,
          before: {
            teacherId,
            teacherName: displayName(teacher),
            subjects: teacher.subjects.map((subject) => ({ id: subject.id, name: subject.name })),
          },
          after: {
            teacherId,
            teacherName: displayName(row),
            subjects: subjects.map((subject) => ({ id: subject.id, name: subject.name })),
          },
          message: `${displayName(row)} subject capability changed. Added: ${addedSubjects.map((subject) => subject.name).join(", ") || "None"}. Removed: ${removedSubjects.map((subject) => subject.name).join(", ") || "None"}.`,
        });
      }

      return row;
    });
    revalidateReferenceData(schoolId, "teachers");
    revalidateReferenceData(schoolId, "subjects");
    revalidateReferenceData(schoolId, "timetable");
    revalidateDashboard(schoolId);
    return updated;
  } catch (error) {
    await restoreClerkNameQuietly(teacherId, teacher.name, teacher.surname);
    throw error;
  }
}
export async function updateStudent(
  schoolId: string,
  studentId: string,
  input: StudentUpdateInput,
  actor: { userId: string } = { userId: "system" },
) {
  const admissionNumber = input.admissionNumber.trim().toUpperCase();
  const parentId = input.parentId?.trim();
  if (!parentId) throw new UserManagementError("Parent is required.", 400);

  const [school, student, studentClass, parent, existingAdmission] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { code: true },
    }),
    prisma.student.findFirst({
      where: { id: studentId, schoolId },
      select: { id: true, name: true, surname: true },
    }),
    prisma.class.findFirst({
      where: { id: input.classId, schoolId },
      select: { gradeId: true },
    }),
    prisma.parent.findFirst({
      where: { id: parentId, schoolId },
      select: { id: true },
    }),
    prisma.student.findFirst({
      where: { schoolId, admissionNumber, NOT: { id: studentId } },
      select: { id: true },
    }),
  ]);
  if (!school?.code) throw new UserManagementError("Save the school code before updating student admission numbers.", 400);
  const admissionCheck = validateAdmissionNumberForSchool(admissionNumber, school.code);
  if (!admissionCheck.ok) {
    throw new UserManagementError(admissionCheck.message ?? "Admission number format is not valid.", 400);
  }
  if (!student) throw new UserManagementError("Student not found.", 404);
  if (!studentClass) throw new UserManagementError("Class not found.", 404);
  if (!parent) throw new UserManagementError("Parent not found.", 404);
  if (existingAdmission) throw new UserManagementError("Admission number already exists for this school.", 409);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.student.update({
        where: { id: studentId },
        data: {
          username: studentRecordUsername(schoolId, admissionNumber),
          admissionNumber,
          name: input.name,
          surname: input.surname,
          phone: input.phone || null,
          address: input.address,
          bloodType: input.bloodType,
          sex: input.sex,
          status: input.status,
          classId: input.classId,
          gradeId: studentClass.gradeId,
          parentId,
        },
      });

      await syncParentRelationshipsForStudentLifecycle(tx, {
        schoolId,
        parentId,
        studentId,
        nextStatus: input.status,
        actorId: actor.userId,
      });

      return row;
    });

    revalidateReferenceData(schoolId, "students");
    revalidateDashboard(schoolId);
    return updated;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new UserManagementError("Admission number already exists for this school.", 409);
    }
    throw error;
  }
}

export async function updateParent(
  schoolId: string,
  parentId: string,
  input: ParentUpdateInput,
  actorId = "system",
) {
  const parent = await prisma.parent.findFirst({
    where: { id: parentId, schoolId },
    select: { id: true, email: true },
  });
  if (!parent) throw new UserManagementError("Parent not found.", 404);

  const updated = await prisma.parent.update({
    where: { id: parentId },
    data: {
      name: input.name,
      surname: input.surname,
      email: input.email || null,
      phone: input.phone || null,
      address: input.address,
    },
  });

  const previousEmail = parent.email?.toLowerCase() ?? null;
  const nextEmail = updated.email?.toLowerCase() ?? null;
  if (previousEmail !== nextEmail) {
    await writeParentAccessAudit(prisma, {
      schoolId,
      parentId,
      action: "EMAIL_CHANGED",
      performedBy: actorId,
      metadata: {
        previousEmail,
        nextEmail,
      },
    });
  }
  revalidateDashboard(schoolId);
  return updated;
}

