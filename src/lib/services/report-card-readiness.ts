import type { Term } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { listClassSubjectsFromTimetable } from "@/src/lib/services/timetable";

export type ReportReadinessBlocker = {
  studentId: string;
  studentName: string;
  subjectId: number;
  subjectName: string;
  reason: "MISSING_CA" | "MISSING_EXAM";
};

export type ClassReportReadiness = {
  classId: number;
  studentCount: number;
  subjectCount: number;
  expectedEntryCount: number;
  readyEntryCount: number;
  caStartedEntryCount: number;
  missingCount: number;
  missingCACount: number;
  missingExamCount: number;
  isReady: boolean;
  blockers: ReportReadinessBlocker[];
};

export async function getClassReportReadiness({
  schoolId,
  classId,
  term,
  academicYear,
  subjectIds,
}: {
  schoolId: string;
  classId: number;
  term: Term;
  academicYear: string;
  subjectIds?: number[];
}): Promise<ClassReportReadiness> {
  const subjectsByClass = await listClassSubjectsFromTimetable(schoolId, [classId]);
  const timetableSubjects = subjectsByClass.get(classId) ?? new Map<number, string>();
  const scopedSubjects = subjectIds?.length
    ? new Map(Array.from(timetableSubjects.entries()).filter(([id]) => subjectIds.includes(id)))
    : timetableSubjects;
  const scopedSubjectIds = Array.from(scopedSubjects.keys());

  const [students, caRecords] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId, classId },
      select: { id: true, name: true, surname: true },
      orderBy: [{ surname: "asc" }, { name: "asc" }],
    }),
    scopedSubjectIds.length > 0
      ? prisma.continuousAssessment.findMany({
          where: {
            schoolId,
            classId,
            term,
            academicYear,
            subjectId: { in: scopedSubjectIds },
          },
          select: {
            studentId: true,
            subjectId: true,
            classworkScore: true,
            examScore: true,
          },
        })
      : [],
  ]);

  const caByStudentSubject = new Map(
    caRecords.map((record) => [`${record.studentId}:${record.subjectId}`, record]),
  );
  const blockers: ReportReadinessBlocker[] = [];
  let readyEntryCount = 0;
  let caStartedEntryCount = 0;

  for (const student of students) {
    for (const [subjectId, subjectName] of scopedSubjects) {
      const record = caByStudentSubject.get(`${student.id}:${subjectId}`);
      const studentName = `${student.name} ${student.surname}`;

      if (!record) {
        blockers.push({
          studentId: student.id,
          studentName,
          subjectId,
          subjectName,
          reason: "MISSING_CA",
        });
        continue;
      }

      caStartedEntryCount += 1;
      if (record.examScore > 0) {
        readyEntryCount += 1;
      } else {
        blockers.push({
          studentId: student.id,
          studentName,
          subjectId,
          subjectName,
          reason: "MISSING_EXAM",
        });
      }
    }
  }

  const expectedEntryCount = students.length * scopedSubjects.size;
  const missingCACount = blockers.filter((blocker) => blocker.reason === "MISSING_CA").length;
  const missingExamCount = blockers.filter((blocker) => blocker.reason === "MISSING_EXAM").length;

  return {
    classId,
    studentCount: students.length,
    subjectCount: scopedSubjects.size,
    expectedEntryCount,
    readyEntryCount,
    caStartedEntryCount,
    missingCount: blockers.length,
    missingCACount,
    missingExamCount,
    isReady: expectedEntryCount > 0 && blockers.length === 0,
    blockers,
  };
}
