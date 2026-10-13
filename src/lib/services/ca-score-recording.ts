import "server-only";
import prisma from "@/src/lib/prisma";
import { activityEligibility } from "@/src/lib/academic-readiness-rules";
import { requireActiveAcademicConfig } from "@/src/lib/services/academic-period";
import { assertReportSetEditable } from "@/src/lib/services/report-publication";
import { upsertCAActivityScore, syncComputedCARecord } from "@/src/lib/services/ca-activity";

export async function recordCAActivityScores(input: { schoolId: string; teacherId: string; activityId: number; rows: { studentId: string; rawScore: number; comment?: string }[] }, now = new Date()) {
  const { schoolId, teacherId, activityId, rows } = input;
  if (!rows.length || new Set(rows.map((r) => r.studentId)).size !== rows.length) throw new Error("Each student must appear once in the score batch.");
  try {
    return await prisma.$transaction(async (tx) => {
      const config = await requireActiveAcademicConfig(schoolId, tx);
      if (config.classworkWeight <= 0) throw new Error("This academic period does not require CA scores.");
      const activity = await tx.cAActivity.findFirst({ where: { id: activityId, schoolId, teacherId, class: { schoolId }, subject: { schoolId }, teacher: { schoolId, status: "ACTIVE" }, bucket: { schoolId, academicYear: config.academicYear, term: config.currentTerm } }, include: { bucket: true } });
      if (!activity || activity.bucket.classId !== activity.classId || activity.bucket.subjectId !== activity.subjectId) throw new Error("Activity is outside your active academic scope.");
      if (activity.activityDate > now) throw new Error("Scores cannot be recorded before the activity takes place.");
      if (activity.isLocked || activity.bucket.isLocked) throw new Error("This activity is locked. Use the correction workflow.");
      const publications = await tx.timetablePublication.findMany({ where: { schoolId, status: "ACTIVE" }, take: 2, select: { id: true } });
      const publication = publications.length === 1 ? publications[0] : null;
      const lesson = publication ? await tx.publishedTimetableLesson.findFirst({ where: { schoolId, publicationId: publication.id, classId: activity.classId, subjectId: activity.subjectId, teacherId }, select: { id: true } }) : null;
      if (!lesson) throw new Error("This activity is outside your published teaching assignment.");
      const context = { schoolId, classId: activity.classId, subjectId: activity.subjectId, term: config.currentTerm, academicYear: config.academicYear };
      await assertReportSetEditable(tx, context);
      const students = await tx.student.findMany({ where: { schoolId, classId: activity.classId, status: "ACTIVE" }, select: { id: true, createdAt: true, classJoinedAt: true } });
      const eligible = new Set(students.filter((s) => activityEligibility(s, activity.activityDate) === "ELIGIBLE").map((s) => s.id));
      if (rows.length !== eligible.size || rows.some((r) => !eligible.has(r.studentId))) throw new Error("Save one score for every eligible student, without earlier duties for later class joins.");
      const maximum = Number(activity.rawMaxScore);
      if (!Number.isFinite(maximum) || maximum <= 0 || rows.some((r) => !Number.isFinite(r.rawScore) || r.rawScore < 0 || r.rawScore > maximum)) throw new Error("A raw score is outside this activity's valid maximum.");
      const results = [];
      for (const row of rows) results.push(await upsertCAActivityScore({ ...row, schoolId, activityId, recordedBy: teacherId }, tx));
      for (const row of rows) await syncComputedCARecord({ ...context, studentId: row.studentId, teacherId }, tx);
      const lock = await tx.cAActivity.updateMany({ where: { id: activityId, schoolId, isLocked: false, updatedAt: activity.updatedAt }, data: { isLocked: true } });
      if (lock.count !== 1) throw new Error("The activity changed while saving. Refresh before continuing.");
      await tx.cAAuditLog.create({ data: { schoolId, actorId: teacherId, action: "CA_ACTIVITY_SCORES_SUBMITTED_AND_LOCKED", entityType: "CAActivity", entityId: String(activityId), message: "Eligible student scores, computed totals and activity lock saved together.", metadata: { studentIds: rows.map((r) => r.studentId), scoreIds: results.map((r) => r.score.id) } } });
      return results;
    }, { isolationLevel: "Serializable", timeout: 60000 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && ["P2034", "P2002"].includes(String(error.code))) throw new Error("Scores changed during saving. Refresh and check the saved activity before retrying.");
    throw error;
  }
}
