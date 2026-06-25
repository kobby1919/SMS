// src/app/(dashboard)/list/report-cards/[studentId]/page.tsx


import { redirect } from "next/navigation";
import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import { notFound } from "next/navigation";
import { getGradeBandByGrade, computeAggregate } from "@/src/lib/caGrades";
import ReportCardView from "@/src/components/ReportCardView";
import type { Term } from "@/src/generated/prisma";

export const dynamic = "force-dynamic";

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
  const term          = (sp.term ?? "TERM_2") as Term;
  const academicYear  = sp.year ?? "";

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

  // ── Authorization ─────────────────────────────────────────────────────────
  if (role === "student"  && userId !== studentId)            redirect("/");
  if (role === "parent"   && student.parent && userId !== student.parentId) redirect("/");
  if (role === "teacher") {
    const cls = await prisma.class.findFirst({ where: { id: student.classId, schoolId }, select: { supervisorId: true } });
    if (cls?.supervisorId !== userId) redirect("/");
  }

  // ── Academic year fallback ────────────────────────────────────────────────
  const configs      = await prisma.cAConfig.findMany({ where: { schoolId }, orderBy: { academicYear: "desc" } });
  const activeYear   = academicYear || configs[0]?.academicYear || "2024/25";
  const config       = configs.find((c) => c.academicYear === activeYear);
  const cwWeight     = config?.classworkWeight ?? 30;
  const exWeight     = config?.examWeight      ?? 70;

  // ── CA records for this student this term ─────────────────────────────────
  const caRecords = await prisma.continuousAssessment.findMany({
    where: {
      schoolId,
      studentId,
      classId:      student.classId,
      term,
      academicYear: activeYear,
    },
    include: {
      subject: { select: { id: true, name: true } },
    },
    orderBy: { subject: { name: "asc" } },
  });

  // ── Subjects on timetable for this class ──────────────────────────────────
  const lessons = await prisma.lesson.findMany({
    where:  { schoolId, classId: student.classId },
    select: { subject: { select: { id: true, name: true } } },
  });
  const timetableSubjects = new Map<number, string>();
  for (const l of lessons) {
    if (!timetableSubjects.has(l.subject.id)) timetableSubjects.set(l.subject.id, l.subject.name);
  }

  // ── All CA records for this class/term/year (to compute class positions) ──
  const classCARecords = await prisma.continuousAssessment.findMany({
    where: {
      schoolId,
      classId:      student.classId,
      term,
      academicYear: activeYear,
    },
    select: {
      studentId:  true,
      subjectId:  true,
      totalScore: true,
      gradePoint: true,
    },
  });

  // ── Compute per-subject positions ─────────────────────────────────────────
  const subjectPositions: Record<number, number> = {};
  for (const [subjectId] of timetableSubjects) {
    const subjectScores = classCARecords
      .filter((r) => r.subjectId === subjectId)
      .sort((a, b) => b.totalScore - a.totalScore);

    const myIdx = subjectScores.findIndex((r) => r.studentId === studentId);
    subjectPositions[subjectId] = myIdx >= 0 ? myIdx + 1 : 0;
  }

  // ── Compute class overall positions (by aggregate) ────────────────────────
  // Group all students' grade points by studentId
  const studentGPMap: Record<string, number[]> = {};
  for (const r of classCARecords) {
    if (!studentGPMap[r.studentId]) studentGPMap[r.studentId] = [];
    studentGPMap[r.studentId].push(r.gradePoint);
  }

  const classAggregates = Object.entries(studentGPMap)
    .map(([sid, gps]) => ({ studentId: sid, aggregate: computeAggregate(gps) }))
    .sort((a, b) => a.aggregate - b.aggregate);

  const overallPosition = classAggregates.findIndex((c) => c.studentId === studentId) + 1;
  const classSize       = (await prisma.student.count({ where: { schoolId, classId: student.classId } }));

  // ── Build subject rows ────────────────────────────────────────────────────
  const subjectRows = caRecords.map((ca) => {
    const band = getGradeBandByGrade(ca.grade);
    return {
      id:             ca.subject.id,
      name:           ca.subject.name,
      classworkScore: ca.classworkScore,
      examScore:      ca.examScore,
      totalScore:     ca.totalScore,
      grade:          ca.grade,
      gradePoint:     ca.gradePoint,
      label:          band.label,
      position:       subjectPositions[ca.subject.id] ?? 0,
      remarks:        ca.remarks,
    };
  });

  // ── Overall stats ─────────────────────────────────────────────────────────
  const gradePoints   = subjectRows.map((s) => s.gradePoint);
  const totalScores   = subjectRows.map((s) => s.totalScore);
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
      overallStats={{
        aggregate,
        avgScore,
        totalRawScore,
        totalPossible,
        overallPosition,
        classSize,
        subjectCount: subjectRows.length,
      }}
      attendance={{
        present: presentCount,
        absent:  absentCount,
        late:    lateCount,
        total:   presentCount + absentCount + lateCount,
      }}
      role={role ?? "admin"}
    />
  );
};

export default ReportCardPage;
