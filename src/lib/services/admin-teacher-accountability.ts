import "server-only";
import prisma from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import { caPublishingDeadline } from "@/src/lib/services/teacher-ca-obligations";
import { homeworkCheckingDeadline } from "@/src/lib/services/teacher-homework-obligations";
import { isOutstandingDuty, summarizeTeacherFollowUps, teacherFollowUpName, type TeacherFollowUpItem } from "@/src/lib/queries/admin-teacher-follow-up";

const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const metadata = (value: Prisma.JsonValue | null) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const numericId = (value: string) => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : -1;
const dayStart = (date: Date) => { const value = new Date(date); value.setHours(0, 0, 0, 0); return value; };
const dayEnd = (date: Date) => { const value = new Date(date); value.setHours(23, 59, 59, 999); return value; };

export type AdminTeacherAccountabilitySnapshot = Omit<Awaited<ReturnType<typeof getAdminTeacherAccountability>>, "details">;

export async function getAdminTeacherAccountability(schoolId: string, now = new Date(), teacherId?: string, includeDetails = false) {
  return prisma.$transaction(async (tx) => {
    const policy = await tx.teacherAccountabilitySetting.findUnique({ where: { schoolId } });
    const operating = await tx.schoolNotificationSetting.findUnique({ where: { schoolId }, select: { activeDays: true } });
    const activeDays = operating?.activeDays.length ? operating.activeDays : ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
    const publication = await tx.timetablePublication.findFirst({ where: { schoolId, status: "ACTIVE" }, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], select: { id: true, publishedAt: true } });
    const config = await tx.cAConfig.findFirst({ where: { schoolId, isActive: true }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], select: { academicYear: true, currentTerm: true } });
    const teachers = await tx.teacher.findMany({ where: { schoolId, status: "ACTIVE" }, select: { id: true, name: true, surname: true, sex: true } });
    const names = new Map(teachers.map((teacher) => [teacher.id, teacherFollowUpName(teacher)]));
    const lessons = publication ? await tx.publishedTimetableLesson.findMany({ where: { schoolId, publicationId: publication.id, teacherId: { in: teachers.map((teacher) => teacher.id) } }, select: { sourceId: true, teacherId: true, classId: true, subjectId: true, className: true, subjectName: true, day: true, startTime: true, endTime: true } }) : [];
    const classIds = [...new Set(lessons.map((lesson) => lesson.classId))];
    const students = await tx.student.findMany({ where: { schoolId, status: "ACTIVE", classId: { in: classIds }, class: { schoolId } }, select: { id: true, classId: true, createdAt: true } });
    const studentsByClass = new Map<number, typeof students>();
    for (const student of students) {
      const entries = studentsByClass.get(student.classId) ?? [];
      entries.push(student);
      studentsByClass.set(student.classId, entries);
    }
    const rosterCache = new Map<string, Set<string>>();
    const roster = (classId: number, date?: Date) => {
      const key = `${classId}:${date?.toISOString().slice(0, 10) ?? "current"}`;
      let entries = rosterCache.get(key);
      if (!entries) {
        entries = new Set((studentsByClass.get(classId) ?? []).filter((student) => !date || student.createdAt <= dayEnd(date)).map((student) => student.id));
        rosterCache.set(key, entries);
      }
      return entries;
    };
    const scopeKey = (teacher: string, classId: number, subjectId: number) => `${teacher}:${classId}:${subjectId}`;
    const scopes = new Set(lessons.map((lesson) => scopeKey(lesson.teacherId, lesson.classId, lesson.subjectId)));
    const lessonMap = new Map(lessons.map((lesson) => [lesson.sourceId, lesson]));
    const obligations = await tx.teacherObligation.findMany({ where: { schoolId, teacher: { schoolId }, teacherId: { in: teachers.map((teacher) => teacher.id) }, type: { in: ["ATTENDANCE", "HOMEWORK_CHECKING", "CA_SCORE_PUBLISHING"] } }, select: { id: true, teacherId: true, type: true, sourceModel: true, sourceId: true, sourceKey: true, status: true, completedAt: true, expectedAt: true, metadata: true, escalations: { where: { schoolId }, select: { id: true, status: true, escalatedAt: true, reason: true } } } });
    const obligationMap = new Map(obligations.map((row) => [`${row.teacherId}:${row.sourceKey}`, row]));
    const items: TeacherFollowUpItem[] = [];
    const addDuty = (input: { teacherId: string; key: string; kind: "ATTENDANCE" | "HOMEWORK_CHECKING" | "CA_SCORE_PUBLISHING"; title: string; detail: string; deadline: Date; complete: boolean }) => {
      const row = obligationMap.get(`${input.teacherId}:${input.key}`);
      const exception = row?.escalations.some((escalation) => ["RESOLVED", "DISMISSED"].includes(escalation.status));
      if (!isOutstandingDuty({ deadline: input.deadline, complete: input.complete, status: row?.status, completedAt: row?.completedAt, exception }, now)) return;
      items.push({ id: `duty:${input.teacherId}:${input.key}`, teacherId: input.teacherId, teacherName: names.get(input.teacherId)!, kind: input.kind, title: input.title, detail: input.detail, at: input.deadline.toISOString(), reviewId: row?.id ?? null, correctionKind: null });
    };
    const notes: string[] = [];
    if (!policy) notes.push("Set the accountability policy before overdue duties can be evaluated.");
    if (!lessons.length) notes.push("Publish a timetable with active teachers before teaching duties can be evaluated.");
    if (!config) notes.push("Activate the academic period before CA publication duties can be evaluated.");

    if (policy && lessons.length) {
      const attendanceDuties = new Map<string, { lesson: typeof lessons[number]; date: Date; deadline: Date; key: string }>();
      for (const row of obligations.filter((row) => row.type === "ATTENDANCE" && row.sourceModel === "Lesson")) {
        const lesson = lessonMap.get(numericId(row.sourceId));
        const meta = metadata(row.metadata);
        if (!lesson || !activeDays.includes(lesson.day) || row.teacherId !== lesson.teacherId || meta.classId !== lesson.classId || meta.subjectId !== lesson.subjectId || typeof meta.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) continue;
        const date = new Date(`${meta.date}T00:00:00Z`);
        if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== meta.date || days[date.getDay()] !== lesson.day || date > now || row.sourceKey !== `attendance:${meta.date}:lesson:${lesson.sourceId}`) continue;
        const end = dayStart(date); end.setHours(lesson.endTime.getHours(), lesson.endTime.getMinutes(), 0, 0);
        attendanceDuties.set(row.sourceKey, { lesson, date, deadline: new Date(end.getTime() + policy.attendanceEscalateMinutesAfterLesson * 60000), key: row.sourceKey });
      }
      for (const lesson of lessons.filter((lesson) => activeDays.includes(lesson.day) && lesson.day === days[now.getDay()])) {
        const start = dayStart(now); start.setHours(lesson.startTime.getHours(), lesson.startTime.getMinutes(), 0, 0);
        const end = dayStart(now); end.setHours(lesson.endTime.getHours(), lesson.endTime.getMinutes(), 0, 0);
        const key = `attendance:${now.toISOString().slice(0, 10)}:lesson:${lesson.sourceId}`;
        if (!attendanceDuties.has(key) && publication!.publishedAt <= start) attendanceDuties.set(key, { lesson, date: dayStart(now), deadline: new Date(end.getTime() + policy.attendanceEscalateMinutesAfterLesson * 60000), key });
      }
      const dates = [...attendanceDuties.values()].map((duty) => duty.date.getTime());
      const earliestDate = dates.reduce((earliest, date) => Math.min(earliest, date), now.getTime());
      const attendance = dates.length ? await tx.attendance.findMany({ where: { schoolId, lessonId: { in: lessons.map((lesson) => lesson.sourceId) }, student: { schoolId, status: "ACTIVE" }, date: { gte: new Date(earliestDate), lte: dayEnd(now) } }, select: { lessonId: true, studentId: true, date: true } }) : [];
      const marksByLessonDay = new Map<string, Set<string>>();
      for (const record of attendance) {
        const key = `${record.lessonId}:${record.date.toISOString().slice(0, 10)}`;
        const marks = marksByLessonDay.get(key) ?? new Set<string>();
        marks.add(record.studentId);
        marksByLessonDay.set(key, marks);
      }
      for (const duty of attendanceDuties.values()) {
        const expected = roster(duty.lesson.classId, duty.date);
        if (!expected.size) continue;
        const savedMarks = marksByLessonDay.get(`${duty.lesson.sourceId}:${duty.date.toISOString().slice(0, 10)}`) ?? new Set<string>();
        const marked = new Set([...savedMarks].filter((studentId) => expected.has(studentId)));
        addDuty({ teacherId: duty.lesson.teacherId, key: duty.key, kind: "ATTENDANCE", title: `${duty.lesson.className}: ${duty.lesson.subjectName} attendance`, detail: `${marked.size} of ${expected.size} student records marked; ${duty.date.toISOString().slice(0, 10)}`, deadline: duty.deadline, complete: marked.size === expected.size });
      }
      const assignments = await tx.assignment.findMany({ where: { schoolId, dueDate: { lte: now }, lessonId: { in: lessons.map((lesson) => lesson.sourceId) }, lesson: { schoolId } }, select: { id: true, title: true, dueDate: true, lessonId: true, lesson: { select: { teacherId: true, classId: true, subjectId: true } }, homeworkSubmissions: { where: { schoolId, student: { schoolId, status: "ACTIVE" } }, select: { studentId: true, status: true, checkedAt: true } } } });
      for (const assignment of assignments) {
        const lesson = lessonMap.get(assignment.lessonId)!;
        if (assignment.lesson.teacherId !== lesson.teacherId || assignment.lesson.classId !== lesson.classId || assignment.lesson.subjectId !== lesson.subjectId) continue;
        const expected = roster(lesson.classId, assignment.dueDate);
        if (!expected.size) continue;
        const checked = new Set(assignment.homeworkSubmissions.filter((row) => expected.has(row.studentId) && row.status !== "PENDING" && row.checkedAt).map((row) => row.studentId));
        addDuty({ teacherId: lesson.teacherId, key: `homework-checking:assignment:${assignment.id}`, kind: "HOMEWORK_CHECKING", title: `${lesson.className}: ${assignment.title}`, detail: `${lesson.subjectName}; ${checked.size} of ${expected.size} homework records checked`, deadline: homeworkCheckingDeadline(assignment.dueDate, policy.homeworkCheckWindowSchoolDays, policy.teacherCloseoutTime), complete: checked.size === expected.size });
      }
      const activities = config ? await tx.cAActivity.findMany({ where: { schoolId, activityDate: { lte: now }, class: { schoolId }, subject: { schoolId }, teacher: { schoolId }, bucket: { schoolId, term: config.currentTerm, academicYear: config.academicYear } }, select: { id: true, title: true, activityDate: true, teacherId: true, classId: true, subjectId: true, bucket: { select: { classId: true, subjectId: true } }, scores: { where: { schoolId, student: { schoolId, status: "ACTIVE" } }, select: { studentId: true } } } }) : [];
      for (const activity of activities) {
        if (activity.bucket.classId !== activity.classId || activity.bucket.subjectId !== activity.subjectId || !scopes.has(scopeKey(activity.teacherId, activity.classId, activity.subjectId))) continue;
        const expected = roster(activity.classId, activity.activityDate);
        if (!expected.size) continue;
        const scored = new Set(activity.scores.filter((row) => expected.has(row.studentId)).map((row) => row.studentId));
        const lesson = lessons.find((row) => row.teacherId === activity.teacherId && row.classId === activity.classId && row.subjectId === activity.subjectId)!;
        addDuty({ teacherId: activity.teacherId, key: `ca-score-publishing:activity:${activity.id}`, kind: "CA_SCORE_PUBLISHING", title: `${lesson.className}: ${activity.title}`, detail: `${lesson.subjectName}; ${scored.size} of ${expected.size} student scores saved`, deadline: caPublishingDeadline(activity.activityDate, policy.caScorePublishWindowSchoolDays, policy.teacherCloseoutTime), complete: scored.size === expected.size });
      }
    }
    // Review queues retain history even when the timetable, roster or setup changes.
    const escalations = await tx.teacherEscalation.findMany({
      where: { schoolId, status: { in: ["OPEN", "ACKNOWLEDGED"] }, teacher: { schoolId }, obligation: { schoolId, status: { not: "CANCELLED" } } },
      select: { id: true, teacherId: true, reason: true, escalatedAt: true, teacher: { select: { name: true, surname: true, sex: true } }, obligation: { select: { title: true, teacherId: true } } },
    });
    for (const row of escalations) {
      if (row.teacherId !== row.obligation.teacherId) continue;
      items.push({ id: `escalation:${row.id}`, teacherId: row.teacherId, teacherName: teacherFollowUpName(row.teacher), kind: "ESCALATION", title: `Escalation review: ${row.obligation.title}`, detail: row.reason, at: row.escalatedAt.toISOString(), reviewId: row.id, correctionKind: null });
    }

    const corrections = await tx.teacherCorrectionRequest.findMany({ where: { schoolId, teacher: { schoolId }, status: "PENDING", OR: [{ sourceModel: "Attendance", fieldName: "attendanceStatus" }, { sourceModel: "HomeworkSubmission", fieldName: "homeworkSubmissionStatus" }, { sourceModel: "CAActivityScore", fieldName: "rawScore" }, { sourceModel: "ContinuousAssessment", fieldName: "examScore" }] }, select: { id: true, teacherId: true, sourceModel: true, sourceId: true, reason: true, createdAt: true, teacher: { select: { name: true, surname: true, sex: true } } } });
    const sourceIds = (model: string) => corrections.filter((row) => row.sourceModel === model).map((row) => numericId(row.sourceId));
    const correctionSources = {
      Attendance: new Set((await tx.attendance.findMany({ where: { schoolId, id: { in: sourceIds("Attendance") }, student: { schoolId }, lesson: { schoolId } }, select: { id: true } })).map((row) => row.id)),
      HomeworkSubmission: new Set((await tx.homeworkSubmission.findMany({ where: { schoolId, id: { in: sourceIds("HomeworkSubmission") }, student: { schoolId }, assignment: { schoolId } }, select: { id: true } })).map((row) => row.id)),
      CAActivityScore: new Set((await tx.cAActivityScore.findMany({ where: { schoolId, id: { in: sourceIds("CAActivityScore") }, student: { schoolId }, activity: { schoolId } }, select: { id: true } })).map((row) => row.id)),
      ContinuousAssessment: new Set((await tx.continuousAssessment.findMany({ where: { schoolId, id: { in: sourceIds("ContinuousAssessment") }, student: { schoolId }, class: { schoolId }, subject: { schoolId } }, select: { id: true } })).map((row) => row.id)),
    };
    for (const request of corrections) {
      if (!correctionSources[request.sourceModel as keyof typeof correctionSources]?.has(numericId(request.sourceId))) continue;
      const correctionKind = request.sourceModel === "Attendance" ? "ATTENDANCE" : request.sourceModel === "HomeworkSubmission" ? "HOMEWORK" : "ACADEMIC";
      items.push({ id: `correction:${request.id}`, teacherId: request.teacherId, teacherName: teacherFollowUpName(request.teacher), kind: "CORRECTION", title: `${correctionKind === "ACADEMIC" ? "Score" : correctionKind === "HOMEWORK" ? "Homework" : "Attendance"} correction awaiting review`, detail: request.reason, at: request.createdAt.toISOString(), reviewId: request.id, correctionKind });
    }
    const summary = summarizeTeacherFollowUps(items);
    return { ...summary, notes, evaluatedAt: now.toISOString(), details: teacherId || includeDetails ? items.filter((item) => !teacherId || item.teacherId === teacherId).sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id)) : [] };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 15000, timeout: 45000 });
}
