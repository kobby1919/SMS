import prisma from "@/src/lib/prisma";
import type { HomeworkSubmissionStatus, Prisma } from "@/src/generated/prisma";

type PrismaClientOrTx = typeof prisma | Prisma.TransactionClient;

type HomeworkSubmissionSyncResult = {
  assignmentId: number;
  classId: number;
  studentCount: number;
};

export async function syncHomeworkSubmissionsForAssignment(
  assignmentId: number,
  schoolId: string,
  db: PrismaClientOrTx = prisma,
): Promise<HomeworkSubmissionSyncResult> {
  const assignment = await db.assignment.findFirst({
    where: { id: assignmentId, schoolId },
    select: {
      id: true,
      schoolId: true,
      lesson: {
        select: {
          classId: true,
          class: {
            select: {
              students: {
                where: { schoolId },
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  if (!assignment) {
    throw new Error("Assignment not found for this school.");
  }

  const rows = assignment.lesson.class.students.map((student) => ({
    schoolId,
    assignmentId: assignment.id,
    studentId: student.id,
  }));

  if (rows.length > 0) {
    await db.homeworkSubmission.createMany({
      data: rows,
      skipDuplicates: true,
    });
  }

  return {
    assignmentId: assignment.id,
    classId: assignment.lesson.classId,
    studentCount: rows.length,
  };
}

export async function markHomeworkSubmission(params: {
  schoolId: string;
  assignmentId: number;
  studentId: string;
  status: HomeworkSubmissionStatus;
  checkedById?: string | null;
  submittedAt?: Date | null;
  note?: string | null;
}) {
  const assignment = await prisma.assignment.findFirst({
    where: {
      id: params.assignmentId,
      schoolId: params.schoolId,
      lesson: {
        class: {
          students: {
            some: {
              id: params.studentId,
              schoolId: params.schoolId,
            },
          },
        },
      },
    },
    select: { id: true },
  });

  if (!assignment) {
    throw new Error("Student is not part of the class for this homework.");
  }

  return prisma.homeworkSubmission.upsert({
    where: {
      schoolId_assignmentId_studentId: {
        schoolId: params.schoolId,
        assignmentId: params.assignmentId,
        studentId: params.studentId,
      },
    },
    create: {
      schoolId: params.schoolId,
      assignmentId: params.assignmentId,
      studentId: params.studentId,
      status: params.status,
      checkedById: params.checkedById ?? null,
      submittedAt: params.submittedAt ?? null,
      checkedAt: new Date(),
      note: params.note?.trim() || null,
    },
    update: {
      status: params.status,
      checkedById: params.checkedById ?? null,
      submittedAt: params.submittedAt ?? null,
      checkedAt: new Date(),
      note: params.note?.trim() || null,
    },
  });
}

export async function markHomeworkSubmissionsForAssignment(params: {
  schoolId: string;
  assignmentId: number;
  status: HomeworkSubmissionStatus;
  checkedById?: string | null;
  submittedAt?: Date | null;
  note?: string | null;
  onlyPending?: boolean;
}) {
  const targetSubmissions = await prisma.homeworkSubmission.findMany({
    where: {
      schoolId: params.schoolId,
      assignmentId: params.assignmentId,
      ...(params.onlyPending === false ? {} : { status: "PENDING" }),
    },
    select: {
      id: true,
      studentId: true,
    },
  });

  if (targetSubmissions.length === 0) return [];

  const submissionIds = targetSubmissions.map((submission) => submission.id);
  const now = new Date();

  await prisma.homeworkSubmission.updateMany({
    where: {
      schoolId: params.schoolId,
      id: { in: submissionIds },
    },
    data: {
      status: params.status,
      checkedById: params.checkedById ?? null,
      submittedAt: params.submittedAt ?? null,
      checkedAt: now,
      note: params.note?.trim() || null,
    },
  });

  return prisma.homeworkSubmission.findMany({
    where: {
      schoolId: params.schoolId,
      id: { in: submissionIds },
    },
    include: {
      student: { select: { id: true, name: true, surname: true } },
    },
    orderBy: [{ student: { surname: "asc" } }, { student: { name: "asc" } }],
  });
}
