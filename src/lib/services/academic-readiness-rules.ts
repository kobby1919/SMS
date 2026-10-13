import "server-only";
import prisma from "@/src/lib/prisma";
import { examEntryState, validAssessmentWeights } from "@/src/lib/academic-readiness-rules";

// This is configuration/scope evidence, not readiness totals or a release action.
export async function getAcademicReadinessRules(schoolId: string) {
  if (!schoolId.trim()) throw new Error("School scope is required.");
  return prisma.$transaction(async (tx) => {
    const configs = await tx.cAConfig.findMany({ where: { schoolId, isActive: true }, take: 2 });
    const publications = await tx.timetablePublication.findMany({ where: { schoolId, status: "ACTIVE" }, take: 2 });
    const policy = await tx.teacherAccountabilitySetting.findUnique({ where: { schoolId } });
    const operating = await tx.schoolNotificationSetting.findUnique({ where: { schoolId }, select: { timezone: true, activeDays: true } });
    const config = configs.length === 1 && validAssessmentWeights(configs[0]) ? configs[0] : null;
    const publication = publications.length === 1 ? publications[0] : null;
    const issues: string[] = [];
    if (!config) issues.push("Activate one valid academic year and term before evaluating readiness.");
    if (!publication) issues.push("One active published timetable is required for teaching scope.");
    if (!policy) issues.push("Configure CA recording deadlines before evaluating overdue scores.");
    const lessons = publication ? await tx.publishedTimetableLesson.findMany({ where: { schoolId, publicationId: publication.id }, select: { classId: true, subjectId: true, teacherId: true } }) : [];
    const teachers = await tx.teacher.findMany({ where: { schoolId, status: "ACTIVE", id: { in: lessons.map((l) => l.teacherId) } }, select: { id: true } });
    const classes = await tx.class.findMany({ where: { schoolId, id: { in: lessons.map((l) => l.classId) } }, select: { id: true } });
    const subjects = await tx.subject.findMany({ where: { schoolId, id: { in: lessons.map((l) => l.subjectId) } }, select: { id: true } });
    const teacherIds = new Set(teachers.map((t) => t.id)), classIds = new Set(classes.map((c) => c.id)), subjectIds = new Set(subjects.map((s) => s.id));
    const valid = lessons.filter((l) => teacherIds.has(l.teacherId) && classIds.has(l.classId) && subjectIds.has(l.subjectId));
    if (valid.length !== lessons.length) issues.push("Some published teaching assignments need review.");
    const scope = [...new Map(valid.map((l) => [`${l.classId}:${l.subjectId}:${l.teacherId}`, l])).values()];
    const windows = config ? await tx.examEntryWindow.findMany({ where: { schoolId, academicYear: config.academicYear, term: config.currentTerm, classId: { in: [...classIds] } } }) : [];
    return { period: config ? { academicYear: config.academicYear, term: config.currentTerm, classworkWeight: config.classworkWeight, examWeight: config.examWeight } : null, publicationId: publication?.id ?? null, scope, caPolicy: policy, operating, examWindows: [...classIds].map((classId) => ({ classId, state: examEntryState(config?.examWeight ?? Number.NaN, windows.find((w) => w.classId === classId) ?? null) })), issues };
  }, { isolationLevel: "RepeatableRead", timeout: 30000 });
}
