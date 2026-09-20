import { clerkClient } from "@clerk/nextjs/server";
import type { z } from "zod";
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
import { ensurePrimaryParentStudentRelationship } from "@/src/lib/services/parent-student-relationships";
import { writeParentAccessAudit } from "@/src/lib/services/parent-access-audit";
import { nextTeacherProfileStatus } from "@/src/lib/services/teacher-profile-completion";
import { assertTeacherSubjectRemovalAllowed } from "@/src/lib/services/teacher-assignment-safety";
import { writeTeacherAdminAuditLog } from "@/src/lib/services/teacher-admin-audit";

type ParentCreateInput = z.infer<typeof parentCreateSchema>;
type ParentUpdateInput = z.infer<typeof parentUpdateSchema>;
type StudentCreateInput = z.infer<typeof studentCreateSchema>;
type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;
type TeacherCreateInput = z.infer<typeof teacherCreateSchema>;
type TeacherUpdateInput = z.infer<typeof teacherUpdateSchema>;

function displayName(user: { name: string; surname?: string | null }) {
  return [user.name, user.surname].filter(Boolean).join(" ");
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
) {
  const [studentClass, parent] = await Promise.all([
    prisma.class.findFirst({
      where: { id: input.classId, schoolId },
      select: { gradeId: true },
    }),
    prisma.parent.findFirst({
      where: { id: input.parentId, schoolId },
      select: { id: true },
    }),
  ]);

  if (!studentClass) throw new UserManagementError("Class not found.", 404);
  if (!parent) throw new UserManagementError("Parent not found.", 404);

  const clerk = await clerkClient();
  let clerkUserId: string;
  try {
    const clerkUser = await clerk.users.createUser({
      username: input.username,
      ...(input.email ? { emailAddress: [input.email] } : {}),
      password: input.password,
      firstName: input.name,
      lastName: input.surname,
      publicMetadata: { role: "student", schoolId },
    });
    clerkUserId = clerkUser.id;
  } catch (error) {
    if (isClerkIdentifierExistsError(error)) {
      throw new UserManagementError("Username or email already exists.", 409);
    }
    throw error;
  }

  try {
    const student = await prisma.student.create({
      data: {
        id: clerkUserId,
        schoolId,
        username: input.username,
        name: input.name,
        surname: input.surname,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address,
        bloodType: input.bloodType,
        sex: input.sex,
        classId: input.classId,
        gradeId: studentClass.gradeId,
        parentId: input.parentId,
      },
    });

    await ensurePrimaryParentStudentRelationship({
      schoolId,
      parentId: input.parentId,
      studentId: student.id,
    });

    revalidateReferenceData(schoolId, "students");
    revalidateDashboard(schoolId);
    return student;
  } catch (error) {
    await removeClerkUserQuietly(clerkUserId);
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
) {
  const [student, studentClass, parent] = await Promise.all([
    prisma.student.findFirst({
      where: { id: studentId, schoolId },
      select: { id: true, name: true, surname: true },
    }),
    prisma.class.findFirst({
      where: { id: input.classId, schoolId },
      select: { gradeId: true },
    }),
    prisma.parent.findFirst({
      where: { id: input.parentId, schoolId },
      select: { id: true },
    }),
  ]);
  if (!student) throw new UserManagementError("Student not found.", 404);
  if (!studentClass) throw new UserManagementError("Class not found.", 404);
  if (!parent) throw new UserManagementError("Parent not found.", 404);

  const clerk = await clerkClient();
  await clerk.users.updateUser(studentId, {
    firstName: input.name,
    lastName: input.surname,
  });

  try {
    const updated = await prisma.student.update({
      where: { id: studentId },
      data: {
        name: input.name,
        surname: input.surname,
        phone: input.phone || null,
        address: input.address,
        bloodType: input.bloodType,
        sex: input.sex,
        classId: input.classId,
        gradeId: studentClass.gradeId,
        parentId: input.parentId,
      },
    });

    await ensurePrimaryParentStudentRelationship({
      schoolId,
      parentId: input.parentId,
      studentId,
    });

    revalidateReferenceData(schoolId, "students");
    revalidateDashboard(schoolId);
    return updated;
  } catch (error) {
    await restoreClerkNameQuietly(studentId, student.name, student.surname);
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

