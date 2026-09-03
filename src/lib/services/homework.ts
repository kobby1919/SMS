import prisma from "@/src/lib/prisma";
import type { HomeworkSubmissionStatus, Prisma } from "@/src/generated/prisma";

type PrismaClientOrTx = typeof prisma | Prisma.TransactionClient;

type HomeworkSubmissionSyncResult = {
  assignmentId: number;
  classId: number;
  studentCount: number;
};

type HomeworkMarkResult = {
  submission: Awaited<ReturnType<typeof prisma.homeworkSubmission.findFirstOrThrow>>;
  changed: boolean;
  previousStatus: HomeworkSubmissionStatus | null;
  effectiveStatus: HomeworkSubmissionStatus;
};

function endOfDueDate(dueDate: Date) {
  const end = new Date(dueDate);
  end.setHours(23, 59, 59, 999);
  return end;
}

function isPastHomeworkDeadline(dueDate: Date, now = new Date()) {
  return endOfDueDate(dueDate) < now;
}

function normalizeHomeworkStatus(status: HomeworkSubmissionStatus, dueDate: Date, now = new Date()) {
  if (status === "SUBMITTED" && isPastHomeworkDeadline(dueDate, now)) {
    return "LATE";
  }
  return status;
}

function isFinalHomeworkStatus(status: HomeworkSubmissionStatus) {
  return status === "SUBMITTED" ||
    status === "LATE" ||
    status === "MISSING" ||
    status === "EXCUSED";
}

function notesMatch(left?: string | null, right?: string | null) {
  return (left?.trim() || null) === (right?.trim() || null);
}

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
  const validStudentIds = rows.map((row) => row.studentId);

  if (rows.length > 0) {
    await db.homeworkSubmission.createMany({
      data: rows,
      skipDuplicates: true,
    });
  }
  await db.homeworkSubmission.deleteMany({
    where: {
      schoolId,
      assignmentId: assignment.id,
      ...(validStudentIds.length > 0
        ? { studentId: { notIn: validStudentIds } }
        : {}),
    },
  });

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
}): Promise<HomeworkMarkResult> {
  const now = new Date();
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
    select: { id: true, dueDate: true },
  });

  if (!assignment) {
    throw new Error("Student is not part of the class for this homework.");
  }

  const effectiveStatus = normalizeHomeworkStatus(params.status, assignment.dueDate, now);
  const note = params.note?.trim() || null;
  if (effectiveStatus === "EXCUSED" && !note) {
    throw new Error("Excused homework requires a short note.");
  }
  const existing = await prisma.homeworkSubmission.findUnique({
    where: {
      schoolId_assignmentId_studentId: {
        schoolId: params.schoolId,
        assignmentId: params.assignmentId,
        studentId: params.studentId,
      },
    },
  });

  if (
    existing?.checkedAt &&
    isFinalHomeworkStatus(existing.status) &&
    effectiveStatus === "PENDING"
  ) {
    throw new Error("Checked homework cannot be reset to pending. Choose the correct final status and add a reason.");
  }

  if (
    existing?.checkedAt &&
    isFinalHomeworkStatus(existing.status) &&
    existing.status !== effectiveStatus &&
    !note
  ) {
    throw new Error("Add a reason before correcting an already checked homework record.");
  }

  const submittedAt =
    effectiveStatus === "SUBMITTED" || effectiveStatus === "LATE"
      ? params.submittedAt ?? existing?.submittedAt ?? now
      : null;

  if (
    existing &&
    existing.status === effectiveStatus &&
    notesMatch(existing.note, note) &&
    ((existing.submittedAt?.getTime() ?? null) === (submittedAt?.getTime() ?? null))
  ) {
    return {
      submission: existing,
      changed: false,
      previousStatus: existing.status,
      effectiveStatus,
    };
  }

  const submission = await prisma.homeworkSubmission.upsert({
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
      status: effectiveStatus,
      checkedById: params.checkedById ?? null,
      submittedAt,
      checkedAt: now,
      note,
    },
    update: {
      status: effectiveStatus,
      checkedById: params.checkedById ?? null,
      submittedAt,
      checkedAt: now,
      note,
    },
  });

  return {
    submission,
    changed: true,
    previousStatus: existing?.status ?? null,
    effectiveStatus,
  };
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
  const now = new Date();
  const assignment = await prisma.assignment.findFirst({
    where: { id: params.assignmentId, schoolId: params.schoolId },
    select: { dueDate: true },
  });

  if (!assignment) {
    throw new Error("Assignment not found for this school.");
  }

  const effectiveStatus = normalizeHomeworkStatus(params.status, assignment.dueDate, now);
  const note = params.note?.trim() || null;
  if (params.status === "SUBMITTED" && isPastHomeworkDeadline(assignment.dueDate, now)) {
    throw new Error("After the due date, mark late submissions individually so each late record is intentional.");
  }
  if (effectiveStatus === "PENDING") {
    throw new Error("Bulk reset to pending is not allowed after homework records have been created.");
  }
  if (effectiveStatus === "EXCUSED" && !note) {
    throw new Error("Excused homework requires a short note.");
  }

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

  await prisma.homeworkSubmission.updateMany({
    where: {
      schoolId: params.schoolId,
      id: { in: submissionIds },
    },
    data: {
      status: effectiveStatus,
      checkedById: params.checkedById ?? null,
      submittedAt:
        effectiveStatus === "SUBMITTED" || effectiveStatus === "LATE"
          ? params.submittedAt ?? now
          : null,
      checkedAt: now,
      note,
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
