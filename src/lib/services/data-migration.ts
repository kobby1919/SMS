import {
  BursarInviteStatus,
  BursarStatus,
  ParentInviteStatus,
  StudentStatus,
  TeacherInviteStatus,
  TeacherStatus,
} from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";

export type MigrationAreaKey =
  | "students"
  | "parents"
  | "teachers"
  | "bursars"
  | "classes"
  | "subjects"
  | "fees";

export type MigrationAreaStatus =
  | "NOT_STARTED"
  | "HAS_RECORDS"
  | "NEEDS_CLEANUP"
  | "READY_FOR_INVITES"
  | "OPERATIONAL";

export type MigrationAreaSummary = {
  key: MigrationAreaKey;
  title: string;
  description: string;
  status: MigrationAreaStatus;
  primaryCount: number;
  primaryLabel: string;
  secondaryCount: number;
  secondaryLabel: string;
  riskCount: number;
  riskLabel: string;
  nextAction: string;
};

export type DataMigrationDashboard = {
  isFreshSchool: boolean;
  totals: {
    students: number;
    parents: number;
    teachers: number;
    bursars: number;
    classes: number;
    subjects: number;
    bills: number;
    pendingInvites: number;
    importLogs: number;
  };
  areas: MigrationAreaSummary[];
  recentImportLogs: Array<{
    id: number;
    action: string;
    performedBy: string;
    createdAt: Date;
    fileName: string | null;
    importType: string | null;
    rowCount: number | null;
  }>;
};

function statusForPeople({
  total,
  pendingInviteCount,
  cleanupCount,
}: {
  total: number;
  pendingInviteCount: number;
  cleanupCount: number;
}): MigrationAreaStatus {
  if (total === 0 && pendingInviteCount === 0) return "NOT_STARTED";
  if (cleanupCount > 0) return "NEEDS_CLEANUP";
  if (pendingInviteCount > 0) return "READY_FOR_INVITES";
  return "OPERATIONAL";
}

function statusForFoundation(total: number): MigrationAreaStatus {
  return total > 0 ? "HAS_RECORDS" : "NOT_STARTED";
}

function getStringMetadata(
  metadata: unknown,
  key: string,
): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getNumberMetadata(
  metadata: unknown,
  key: string,
): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null;
  }
  return null;
}

export async function getDataMigrationDashboard(
  schoolId: string,
): Promise<DataMigrationDashboard> {
  const [
    totalStudents,
    incompleteStudents,
    missingAdmissionStudents,
    activeStudents,
    totalParents,
    parentsWithoutActiveWardLinks,
    activeParentLinks,
    pendingParentInvites,
    totalTeachers,
    activeTeachers,
    incompleteTeachers,
    pendingTeacherInvites,
    totalBursars,
    activeBursars,
    suspendedBursars,
    pendingBursarInvites,
    totalClasses,
    totalSubjects,
    totalBills,
    feeStructures,
    recentImportLogs,
    importLogCount,
  ] = await Promise.all([
    prisma.student.count({ where: { schoolId } }),
    prisma.student.count({ where: { schoolId, status: StudentStatus.INCOMPLETE_SETUP } }),
    prisma.student.count({ where: { schoolId, admissionNumber: null } }),
    prisma.student.count({ where: { schoolId, status: StudentStatus.ACTIVE } }),
    prisma.parent.count({ where: { schoolId } }),
    prisma.parent.count({
      where: {
        schoolId,
        studentRelationships: {
          none: { schoolId, status: "ACTIVE" },
        },
      },
    }),
    prisma.parentStudentRelationship.count({ where: { schoolId, status: "ACTIVE" } }),
    prisma.parentInvite.count({ where: { schoolId, status: ParentInviteStatus.PENDING } }),
    prisma.teacher.count({ where: { schoolId } }),
    prisma.teacher.count({ where: { schoolId, status: TeacherStatus.ACTIVE } }),
    prisma.teacher.count({ where: { schoolId, status: TeacherStatus.INCOMPLETE_SETUP } }),
    prisma.teacherInvite.count({ where: { schoolId, status: TeacherInviteStatus.PENDING } }),
    prisma.bursar.count({ where: { schoolId } }),
    prisma.bursar.count({ where: { schoolId, status: BursarStatus.ACTIVE } }),
    prisma.bursar.count({ where: { schoolId, status: BursarStatus.SUSPENDED } }),
    prisma.bursarInvite.count({ where: { schoolId, status: BursarInviteStatus.PENDING } }),
    prisma.class.count({ where: { schoolId } }),
    prisma.subject.count({ where: { schoolId } }),
    prisma.studentBill.count({ where: { schoolId } }),
    prisma.feeStructure.count({ where: { schoolId } }),
    prisma.onboardingAuditLog.findMany({
      where: { schoolId, action: "IMPORT_RECORDED" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        action: true,
        performedBy: true,
        metadata: true,
        createdAt: true,
      },
    }),
    prisma.onboardingAuditLog.count({ where: { schoolId, action: "IMPORT_RECORDED" } }),
  ]);

  const pendingInvites = pendingParentInvites + pendingTeacherInvites + pendingBursarInvites;
  const studentRiskCount = missingAdmissionStudents + incompleteStudents;
  const studentRiskLabel = missingAdmissionStudents > 0 && incompleteStudents > 0
    ? "admission/setup review"
    : missingAdmissionStudents > 0
      ? "missing admission no."
      : incompleteStudents > 0
        ? "incomplete setup"
        : "records to review";
  const parentRiskCount = parentsWithoutActiveWardLinks + pendingParentInvites;
  const parentRiskLabel = parentsWithoutActiveWardLinks > 0 && pendingParentInvites > 0
    ? "links/invites to review"
    : parentsWithoutActiveWardLinks > 0
      ? "parents without wards"
      : pendingParentInvites > 0
        ? "pending parent invites"
        : "links to review";
  const isFreshSchool = [
    totalStudents,
    totalParents,
    totalTeachers,
    totalBursars,
    totalClasses,
    totalSubjects,
    totalBills,
    feeStructures,
    pendingInvites,
    importLogCount,
  ].every((count) => count === 0);

  const areas: MigrationAreaSummary[] = [
    {
      key: "students",
      title: "Students",
      description: "Admission records, class placement, lifecycle status, and parent link readiness.",
      status: studentRiskCount > 0
        ? "NEEDS_CLEANUP"
        : statusForFoundation(totalStudents),
      primaryCount: totalStudents,
      primaryLabel: "students",
      secondaryCount: activeStudents,
      secondaryLabel: "active students",
      riskCount: studentRiskCount,
      riskLabel: studentRiskLabel,
      nextAction: totalStudents === 0
        ? "Prepare student spreadsheet"
        : studentRiskCount > 0
          ? "Clean admission/status gaps"
          : "Ready for parent linking checks",
    },
    {
      key: "parents",
      title: "Parents and guardians",
      description: "Guardian profiles, active ward links, and invite readiness after student records are clean.",
      status: statusForPeople({
        total: totalParents,
        pendingInviteCount: pendingParentInvites,
        cleanupCount: parentsWithoutActiveWardLinks,
      }),
      primaryCount: totalParents,
      primaryLabel: "profiles",
      secondaryCount: activeParentLinks,
      secondaryLabel: "active ward links",
      riskCount: parentRiskCount,
      riskLabel: parentRiskLabel,
      nextAction: totalParents === 0
        ? "Import parents after students"
        : parentsWithoutActiveWardLinks > 0
          ? "Link every parent to the right active ward"
        : pendingParentInvites > 0
          ? "Track pending parent invites"
          : "Ready for bulk invite step",
    },
    {
      key: "teachers",
      title: "Teachers",
      description: "Teacher profiles, invitation status, and readiness for subject/class assignment.",
      status: statusForPeople({
        total: totalTeachers,
        pendingInviteCount: pendingTeacherInvites,
        cleanupCount: incompleteTeachers,
      }),
      primaryCount: totalTeachers,
      primaryLabel: "profiles",
      secondaryCount: activeTeachers,
      secondaryLabel: "active",
      riskCount: incompleteTeachers + pendingTeacherInvites,
      riskLabel: "needs setup",
      nextAction: totalTeachers === 0
        ? "Prepare teacher spreadsheet"
        : incompleteTeachers > 0
          ? "Complete teacher setup"
          : "Ready for capability setup",
    },
    {
      key: "bursars",
      title: "Bursars",
      description: "Finance users who can operate bills, receipts, and payment records after invite acceptance.",
      status: statusForPeople({
        total: totalBursars,
        pendingInviteCount: pendingBursarInvites,
        cleanupCount: suspendedBursars,
      }),
      primaryCount: totalBursars,
      primaryLabel: "profiles",
      secondaryCount: activeBursars,
      secondaryLabel: "active",
      riskCount: suspendedBursars + pendingBursarInvites,
      riskLabel: "needs review",
      nextAction: totalBursars === 0
        ? "Add or import bursars"
        : pendingBursarInvites > 0
          ? "Track pending bursar invites"
          : "Ready for finance access",
    },
    {
      key: "classes",
      title: "Classes",
      description: "The class structure every student, timetable slot, fee bill, and report depends on.",
      status: statusForFoundation(totalClasses),
      primaryCount: totalClasses,
      primaryLabel: "classes",
      secondaryCount: totalStudents,
      secondaryLabel: "students placed",
      riskCount: totalClasses === 0 ? 1 : 0,
      riskLabel: "missing foundation",
      nextAction: totalClasses === 0 ? "Set up classes first" : "Ready for student mapping",
    },
    {
      key: "subjects",
      title: "Subjects",
      description: "Curriculum records used by teacher capability, timetable, CA, syllabus, and reports.",
      status: statusForFoundation(totalSubjects),
      primaryCount: totalSubjects,
      primaryLabel: "subjects",
      secondaryCount: activeTeachers,
      secondaryLabel: "active teachers",
      riskCount: totalSubjects === 0 ? 1 : 0,
      riskLabel: "missing foundation",
      nextAction: totalSubjects === 0 ? "Set up subjects first" : "Ready for teacher capability",
    },
    {
      key: "fees",
      title: "Fees and bills",
      description: "Fee structures and existing student bills that must balance before live collection.",
      status: totalBills > 0 || feeStructures > 0 ? "HAS_RECORDS" : "NOT_STARTED",
      primaryCount: totalBills,
      primaryLabel: "bills",
      secondaryCount: feeStructures,
      secondaryLabel: "fee structures",
      riskCount: 0,
      riskLabel: "unvalidated balances",
      nextAction: totalBills === 0
        ? "Prepare fee structure before importing balances"
        : "Validate balances before inviting parents",
    },
  ];

  return {
    isFreshSchool,
    totals: {
      students: totalStudents,
      parents: totalParents,
      teachers: totalTeachers,
      bursars: totalBursars,
      classes: totalClasses,
      subjects: totalSubjects,
      bills: totalBills,
      pendingInvites,
      importLogs: importLogCount,
    },
    areas,
    recentImportLogs: recentImportLogs.map((log) => ({
      id: log.id,
      action: log.action,
      performedBy: log.performedBy,
      createdAt: log.createdAt,
      fileName: getStringMetadata(log.metadata, "fileName"),
      importType: getStringMetadata(log.metadata, "importType"),
      rowCount: getNumberMetadata(log.metadata, "rowCount"),
    })),
  };
}
