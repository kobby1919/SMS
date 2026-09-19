import type { ReportPublicationStatus } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { getActiveAcademicPeriod } from "@/src/lib/services/academic-period";

const LOCKED_REPORT_STATUSES: ReportPublicationStatus[] = ["SUBMITTED", "REJECTED", "PUBLISHED"];

export class ClassTeacherSafetyError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
    this.name = "ClassTeacherSafetyError";
  }
}

export async function assertClassTeacherChangeAllowed({
  schoolId,
  classId,
  nextSupervisorId,
}: {
  schoolId: string;
  classId: number;
  nextSupervisorId?: string | null;
}) {
  const klass = await prisma.class.findFirst({
    where: { id: classId, schoolId },
    select: {
      id: true,
      name: true,
      supervisorId: true,
      supervisor: { select: { name: true, surname: true } },
    },
  });

  if (!klass) return;
  if ((klass.supervisorId ?? null) === (nextSupervisorId ?? null)) return;
  if (!klass.supervisorId) return;

  const activePeriod = await getActiveAcademicPeriod(schoolId);
  const lockedPublication = await prisma.reportCardPublication.findUnique({
    where: {
      schoolId_classId_term_academicYear: {
        schoolId,
        classId,
        term: activePeriod.currentTerm,
        academicYear: activePeriod.academicYear,
      },
    },
    select: { status: true },
  });

  if (!lockedPublication || !LOCKED_REPORT_STATUSES.includes(lockedPublication.status)) return;

  const teacherName = klass.supervisor
    ? `${klass.supervisor.name} ${klass.supervisor.surname}`.trim()
    : "the current class teacher";
  throw new ClassTeacherSafetyError(
    `Cannot change ${klass.name}'s class teacher because ${teacherName} has an active ${lockedPublication.status.toLowerCase()} report-card responsibility for ${activePeriod.academicYear} ${activePeriod.currentTerm.replace("_", " ")}. Return/unpublish the report set or finish the review first.`,
  );
}

export async function assertTeacherHasNoClassTeacherResponsibilities({
  schoolId,
  teacherId,
  actionLabel,
}: {
  schoolId: string;
  teacherId: string;
  actionLabel: string;
}) {
  const supervisedClasses = await prisma.class.findMany({
    where: { schoolId, supervisorId: teacherId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 6,
  });

  if (supervisedClasses.length === 0) return;

  const examples = supervisedClasses.slice(0, 3).map((klass) => klass.name).join(", ");
  throw new ClassTeacherSafetyError(
    `Cannot ${actionLabel} because this teacher is still assigned as class teacher for ${examples}. Reassign those classes first so class supervision, report submission, and parent routing stay consistent.`,
  );
}