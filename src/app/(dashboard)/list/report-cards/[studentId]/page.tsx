// src/app/(dashboard)/list/report-cards/[studentId]/page.tsx


import { redirect } from "next/navigation";
import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import { notFound } from "next/navigation";
import { getGradeBandByGrade, computeAggregate } from "@/src/lib/caGrades";
import ReportCardView from "@/src/components/ReportCardView";
import type { Term } from "@/src/generated/prisma";
import { getSchoolBranding } from "@/src/lib/services/school-branding";
import { listClassSubjectsFromTimetable } from "@/src/lib/services/timetable";
import { getActiveAcademicPeriod } from "@/src/lib/services/academic-period";

export const dynamic = "force-dynamic";

type CATrend = "up" | "down" | "steady" | "new";
const VALID_TERMS = new Set<Term>(["TERM_1", "TERM_2", "TERM_3"]);

function termFromParam(value?: string): Term | null {
  return value && VALID_TERMS.has(value as Term) ? value as Term : null;
}

const ReportCardPage = async ({
  params,
  searchParams,
}: {
  params:       Promise<{ studentId: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { userId, role, schoolId } = await requirePageSession();
  if (!userId) redirect("/sign-in");

  const { studentId } = await params;
  const sp            = await searchParams;
  const requestedTerm = termFromParam(sp.term);
  const requestedYear = sp.year ?? "";
  const openedCAScoreId = sp.caScoreId ? Number(sp.caScoreId) : null;

  // ── Load student ──────────────────────────────────────────────────────────
  const student = await prisma.student.findFirst({
    where:   { id: studentId, schoolId },
    include: {
      class:  { include: { grade: true, supervisor: { select: { id: true, name: true, surname: true } } } },
      grade:  true,
      parent: { select: { name: true, surname: true, phone: true, email: true } },
    },
  });
  if (!student) notFound();

  // ── Academic year fallback ────────────────────────────────────────────────
  const [configs, branding, activePeriod] = await Promise.all([
    prisma.cAConfig.findMany({ where: { schoolId }, orderBy: { academicYear: "desc" } }),
    getSchoolBranding(schoolId),
    getActiveAcademicPeriod(schoolId),
  ]);
  const term = requestedTerm ?? activePeriod.currentTerm;
  const activeYear   = requestedYear || activePeriod.academicYear || configs[0]?.academicYear || "2025/26";
  const config       = configs.find((c) => c.academicYear === activeYear);
  const cwWeight     = config?.classworkWeight ?? 30;
  const exWeight     = config?.examWeight      ?? 70;

  // ── Subjects on timetable for this class ──────────────────────────────────
  const subjectsByClass = await listClassSubjectsFromTimetable(schoolId, [student.classId]);
  const timetableSubjects = subjectsByClass.get(student.classId) ?? new Map<number, string>();

  const teacherSubjectIds = new Set<number>();
  const isClassSupervisor =
    role === "teacher" && student.class.supervisor?.id === userId;

  if (role === "teacher") {
    const teacherLessons = await prisma.lesson.findMany({
      where: { schoolId, classId: student.classId, teacherId: userId },
      select: { subjectId: true },
    });
    for (const lesson of teacherLessons) {
      teacherSubjectIds.add(lesson.subjectId);
    }
  }

  // ── Authorization ─────────────────────────────────────────────────────────
  if (role === "student" && userId !== studentId) redirect("/");
  if (role === "parent" && userId !== student.parentId) redirect("/");
  if (role === "teacher" && !isClassSupervisor && teacherSubjectIds.size === 0) {
    redirect("/");
  }

  const visibleSubjectIds =
    role === "teacher" && !isClassSupervisor ? teacherSubjectIds : null;
  const visibleTimetableSubjects =
    visibleSubjectIds === null
      ? timetableSubjects
      : new Map(
          Array.from(timetableSubjects.entries()).filter(([subjectId]) =>
            visibleSubjectIds.has(subjectId),
          ),
        );
  const timetableSubjectIds = Array.from(visibleTimetableSubjects.keys());

  // ── CA records for this student this term ─────────────────────────────────
  const caRecords = await prisma.continuousAssessment.findMany({
    where: {
      schoolId,
      studentId,
      classId:      student.classId,
      term,
      academicYear: activeYear,
      ...(timetableSubjectIds.length > 0
        ? { subjectId: { in: timetableSubjectIds } }
        : {}),
    },
    include: {
      subject: { select: { id: true, name: true } },
    },
    orderBy: { subject: { name: "asc" } },
  });

  const previousCARecords = await prisma.continuousAssessment.findMany({
    where: {
      schoolId,
      studentId,
      classId: student.classId,
      ...(timetableSubjectIds.length > 0
        ? { subjectId: { in: timetableSubjectIds } }
        : {}),
      OR: [
        { academicYear: { not: activeYear } },
        { term: { not: term } },
      ],
    },
    select: {
      subjectId: true,
      classworkScore: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  const previousCABySubject = new Map<number, { classworkScore: number }>();
  for (const record of previousCARecords) {
    if (!previousCABySubject.has(record.subjectId)) {
      previousCABySubject.set(record.subjectId, record);
    }
  }
  const latestCARecords = await prisma.continuousAssessment.findMany({
    where: {
      schoolId,
      studentId,
      classId: student.classId,
      ...(timetableSubjectIds.length > 0
        ? { subjectId: { in: timetableSubjectIds } }
        : {}),
    },
    select: {
      subjectId: true,
      term: true,
      academicYear: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  const latestCABySubject = new Map<number, { term: Term; academicYear: string; updatedAt: Date }>();
  for (const record of latestCARecords) {
    if (!latestCABySubject.has(record.subjectId)) {
      latestCABySubject.set(record.subjectId, record);
    }
  }

  const openedCAUpdate = openedCAScoreId
    ? await prisma.cAActivityScore.findFirst({
        where: {
          id: openedCAScoreId,
          schoolId,
          studentId,
          activity: {
            classId: student.classId,
            ...(timetableSubjectIds.length > 0
              ? { subjectId: { in: timetableSubjectIds } }
              : {}),
            bucket: {
              term,
              academicYear: activeYear,
            },
          },
        },
        include: {
          activity: {
            select: {
              title: true,
              subjectId: true,
              subject: { select: { name: true } },
            },
          },
        },
      })
    : null;
  const latestScoreForOpenedSubject = openedCAUpdate
    ? await prisma.cAActivityScore.findFirst({
        where: {
          schoolId,
          studentId,
          activity: {
            classId: student.classId,
            subjectId: openedCAUpdate.activity.subjectId,
            bucket: {
              term,
              academicYear: activeYear,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        select: { id: true, updatedAt: true },
      })
    : null;

  // ── All CA records for this class/term/year (to compute class positions) ──
  const classCARecords = await prisma.continuousAssessment.findMany({
    where: {
      schoolId,
      classId:      student.classId,
      term,
      academicYear: activeYear,
      ...(timetableSubjectIds.length > 0
        ? { subjectId: { in: timetableSubjectIds } }
        : {}),
    },
    select: {
      studentId:  true,
      subjectId:  true,
      totalScore: true,
      gradePoint: true,
      examScore: true,
    },
  });

  // ── Compute per-subject positions ─────────────────────────────────────────
  const subjectPositions: Record<number, number> = {};
  for (const [subjectId] of visibleTimetableSubjects) {
    const subjectScores = classCARecords
      .filter((r) => r.subjectId === subjectId && r.examScore > 0)
      .sort((a, b) => b.totalScore - a.totalScore);

    const myIdx = subjectScores.findIndex((r) => r.studentId === studentId);
    subjectPositions[subjectId] = myIdx >= 0 ? myIdx + 1 : 0;
  }

  // ── Compute class overall positions (by aggregate) ────────────────────────
  // Group all students' grade points by studentId
  const studentGPMap: Record<string, number[]> = {};
  for (const r of classCARecords) {
    if (r.examScore <= 0) continue;
    if (!studentGPMap[r.studentId]) studentGPMap[r.studentId] = [];
    studentGPMap[r.studentId].push(r.gradePoint);
  }

  const classAggregates = Object.entries(studentGPMap)
    .map(([sid, gps]) => ({ studentId: sid, aggregate: computeAggregate(gps) }))
    .sort((a, b) => a.aggregate - b.aggregate);

  const positionIndex = classAggregates.findIndex((c) => c.studentId === studentId);
  const overallPosition = positionIndex >= 0 ? positionIndex + 1 : 0;
  const classSize       = (await prisma.student.count({ where: { schoolId, classId: student.classId } }));
  const publication = await prisma.reportCardPublication.findUnique({
    where: {
      schoolId_classId_term_academicYear: {
        schoolId,
        classId: student.classId,
        term,
        academicYear: activeYear,
      },
    },
    select: { status: true, publishedAt: true },
  });

  // ── Build subject rows ────────────────────────────────────────────────────
  const caRecordsBySubject = new Map(caRecords.map((ca) => [ca.subjectId, ca]));
  const subjectRows = Array.from(visibleTimetableSubjects.entries()).map(([subjectId, subjectName]) => {
    const ca = caRecordsBySubject.get(subjectId);
    if (!ca) {
      return {
        id: subjectId,
        name: subjectName,
        classworkScore: 0,
        examScore: 0,
        totalScore: 0,
        grade: "F9",
        gradePoint: 9,
        isComplete: false,
        caChange: 0,
        caTrend: "new" as CATrend,
        hasNewerCARecord: false,
        label: "CA not started",
        position: 0,
        remarks: "No CA records have been entered for this subject yet.",
      };
    }
    const band = getGradeBandByGrade(ca.grade);
    const previous = previousCABySubject.get(ca.subjectId);
    const latest = latestCABySubject.get(ca.subjectId);
    const caChange = previous
      ? Math.round((ca.classworkScore - previous.classworkScore) * 100) / 100
      : 0;
    const caTrend: CATrend = previous
      ? caChange > 0
        ? "up"
        : caChange < 0
          ? "down"
          : "steady"
      : "new";
    return {
      id:             ca.subject.id,
      name:           subjectName,
      classworkScore: ca.classworkScore,
      examScore:      ca.examScore,
      totalScore:     ca.totalScore,
      grade:          ca.grade,
      gradePoint:     ca.gradePoint,
      isComplete:     ca.examScore > 0,
      caChange,
      caTrend,
      hasNewerCARecord: Boolean(
        latest &&
        (
          latest.academicYear !== ca.academicYear ||
          latest.term !== ca.term ||
          latest.updatedAt.getTime() > ca.updatedAt.getTime()
        ),
      ),
      label:          band.label,
      position:       subjectPositions[ca.subject.id] ?? 0,
      remarks:        ca.remarks,
    };
  });

  // ── Overall stats ─────────────────────────────────────────────────────────
  const completedRows = subjectRows.filter((s) => s.isComplete);
  const gradePoints   = completedRows.map((s) => s.gradePoint);
  const totalScores   = completedRows.map((s) => s.totalScore);
  const aggregate     = computeAggregate(gradePoints);
  const avgScore      = totalScores.length > 0
    ? Math.round((totalScores.reduce((a, b) => a + b, 0) / totalScores.length) * 10) / 10
    : 0;
  const totalRawScore = totalScores.reduce((a, b) => a + b, 0);
  const totalPossible = totalScores.length * 100;

  // ── Attendance for this term (approximate: current academic year) ─────────
  const termStart = new Date(parseInt(activeYear.split("/")[0]), term === "TERM_1" ? 8 : term === "TERM_2" ? 0 : 4, 1);
  const termEnd   = new Date();
  const [presentCount, absentCount, lateCount] = await Promise.all([
    prisma.attendance.count({ where: { schoolId, studentId, status: "PRESENT", date: { gte: termStart, lte: termEnd } } }),
    prisma.attendance.count({ where: { schoolId, studentId, status: "ABSENT",  date: { gte: termStart, lte: termEnd } } }),
    prisma.attendance.count({ where: { schoolId, studentId, status: "LATE",    date: { gte: termStart, lte: termEnd } } }),
  ]);

  return (
    <ReportCardView
      branding={{
        displayName: branding.displayName,
        shortName: branding.shortName,
        primaryColor: branding.primaryColor,
        logoUrl: branding.logoUrl,
      }}
      student={{
        id:       student.id,
        name:     student.name,
        surname:  student.surname,
        img:      student.img,
        sex:      student.sex,
        bloodType: student.bloodType,
      }}
      classInfo={{
        name:       student.class.name,
        gradeLevel: student.class.grade.level,
        supervisor: student.class.supervisor
          ? `${student.class.supervisor.name} ${student.class.supervisor.surname}`
          : "—",
        classSize,
      }}
      parent={{
        name:    student.parent?.name    ?? "",
        surname: student.parent?.surname ?? "",
        phone:   student.parent?.phone   ?? "",
        email:   student.parent?.email   ?? "",
      }}
      term={term}
      academicYear={activeYear}
      cwWeight={cwWeight}
      exWeight={exWeight}
      subjectRows={subjectRows}
      openedCAUpdate={openedCAUpdate ? {
        subjectName: openedCAUpdate.activity.subject.name,
        activityTitle: openedCAUpdate.activity.title,
        openedAt: openedCAUpdate.updatedAt,
        isLatest: latestScoreForOpenedSubject?.id === openedCAUpdate.id,
      } : undefined}
      overallStats={{
        aggregate,
        avgScore,
        totalRawScore,
        totalPossible,
        overallPosition,
        classSize,
        subjectCount: completedRows.length,
        pendingSubjectCount: subjectRows.length - completedRows.length,
      }}
      attendance={{
        present: presentCount,
        absent:  absentCount,
        late:    lateCount,
        total:   presentCount + absentCount + lateCount,
      }}
      role={role ?? "admin"}
      publication={{
        isPublished: publication?.status === "PUBLISHED",
        publishedAt: publication?.publishedAt,
      }}
    />
  );
};

export default ReportCardPage;
