import "server-only";
import prisma from "@/src/lib/prisma";
import type { Term } from "@/src/generated/prisma";
import { hasRecordedExam, examEntryState, examEvidenceState } from "@/src/lib/academic-readiness-rules";
import { getSubjectCAProgress } from "@/src/lib/services/ca-activity";
import { assertReportSetEditable } from "@/src/lib/services/report-publication";
import { getGradeBand } from "@/src/lib/caGrades";
import { requireActiveAcademicConfig } from "@/src/lib/services/academic-period";

export async function recordExamScores(input: {
  schoolId: string; teacherId: string; classId: number; subjectId: number; term: Term; academicYear: string;
  rows: { studentId: string; examScore: number; remarks?: string }[];
}, now = new Date()) {
  const { schoolId, teacherId, classId, subjectId, term, academicYear, rows } = input;
  const context = { schoolId, classId, term, academicYear };
  if (!rows.length || new Set(rows.map((r) => r.studentId)).size !== rows.length) throw new Error("Each student must appear once in the exam batch.");
  try {
    return await prisma.$transaction(async (tx) => {
      const config = await requireActiveAcademicConfig(schoolId, tx);
      if (!config || config.academicYear !== academicYear || config.currentTerm !== term) throw new Error("Exam scores must use the active academic year and term.");
      if (config.examWeight <= 0) throw new Error("This academic period does not require exam scores.");
      const teacher = await tx.teacher.findFirst({ where: { id: teacherId, schoolId, status: "ACTIVE" }, select: { id: true } });
      const cls = await tx.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } });
      const subject = await tx.subject.findFirst({ where: { id: subjectId, schoolId }, select: { id: true } });
      const publications = await tx.timetablePublication.findMany({ where: { schoolId, status: "ACTIVE" }, take: 2, select: { id: true } });
      const publication = publications.length === 1 ? publications[0] : null;
      const lesson = teacher && cls && subject && publication ? await tx.publishedTimetableLesson.findFirst({ where: { schoolId, publicationId: publication.id, classId, subjectId, teacherId, publication: { schoolId, status: "ACTIVE" } }, select: { id: true } }) : null;
      if (!lesson) throw new Error("You can only record exams for your subject in the active published timetable.");
      const window = await tx.examEntryWindow.findUnique({ where: { schoolId_classId_term_academicYear: context } });
      if (examEntryState(config.examWeight, window) !== "OPEN") throw new Error("Exam entry is not open for this class period.");
      await assertReportSetEditable(tx, context);
      const count = await tx.student.count({ where: { schoolId, classId, status: "ACTIVE", id: { in: rows.map((r) => r.studentId) } } });
      if (count !== rows.length) throw new Error("Every exam student must be active in your school and class.");
      const results = [];
      for (const row of rows) {
        if (!Number.isFinite(row.examScore) || row.examScore < 0 || row.examScore > config.examWeight) throw new Error(`Exam marks must be between 0 and ${config.examWeight}.`);
        const key = { ...context, studentId: row.studentId, subjectId };
        const existing = await tx.continuousAssessment.findUnique({ where: { schoolId_studentId_subjectId_classId_term_academicYear: key } });
        if (examEvidenceState(existing, config.examWeight) === "INVALID") throw new Error("Existing exam evidence requires review through the correction workflow.");
        if (hasRecordedExam(existing) && existing!.examScore !== row.examScore) throw new Error("Saved exam scores, including zero, can only change through the correction workflow.");
        const progress = await getSubjectCAProgress(key, tx);
        if (!Number.isFinite(progress.earnedMarks) || progress.earnedMarks < 0 || progress.earnedMarks > config.classworkWeight) throw new Error("CA evidence needs reconciliation before saving the exam total.");
        const totalScore = Math.round((progress.earnedMarks + row.examScore) * 100) / 100;
        const band = getGradeBand(totalScore);
        const data = { classworkScore: progress.earnedMarks, examScore: row.examScore, examRecordedAt: existing?.examRecordedAt ?? now, totalScore, grade: band.grade, gradePoint: band.gradePoint, configId: config.id, teacherId, remarks: row.remarks ?? existing?.remarks ?? "" };
        const record = await tx.continuousAssessment.upsert({ where: { schoolId_studentId_subjectId_classId_term_academicYear: key }, create: { ...key, ...data }, update: data });
        if (!hasRecordedExam(existing)) await tx.cAAuditLog.create({ data: { schoolId, actorId: teacherId, action: "EXAM_SCORE_RECORDED", entityType: "ContinuousAssessment", entityId: String(record.id), message: "Teacher explicitly recorded an exam mark.", metadata: { studentId: row.studentId, subjectId, classId, term, academicYear, examScore: row.examScore } } });
        results.push(record);
      }
      return results;
    }, { isolationLevel: "Serializable", timeout: 30000 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error.code === "P2034" || error.code === "P2002")) throw new Error("Assessment records changed while saving. Refresh and try again.");
    throw error;
  }
}
