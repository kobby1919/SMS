import "server-only";
import { z } from "zod";
import prisma from "@/src/lib/prisma";
import { AuthorizationError, requireRole } from "@/src/lib/authz";
import { assertDashboardReadBudget, assertDashboardWorkBudget } from "@/src/lib/dashboard-read-budget";
import { DEFAULT_TEACHER_ACCOUNTABILITY_SETTINGS } from "@/src/lib/services/teacher-accountability-settings";
import { attendanceClock, attendanceDateBounds, attendanceSchedule, eligibleAttendanceStudentIds, latestAttendanceMarks, schoolAttendanceDate, schoolDayPosition, shiftAttendanceDate, type DayPosition } from "@/src/lib/attendance-review";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => value >= "1970-01-01" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
const integer = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(2147483647));
const filters = z.object({ classId: integer.optional(), date: date.optional(), studentId: z.string().trim().min(1).max(200).optional(), status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED", "UNKNOWN", "NO_LESSONS"]).optional(), page: integer.pipe(z.number().max(100000)).optional() });

export async function getAdminAttendanceReview(params: Record<string, string | string[] | undefined>, now = new Date(), options: { includeHistory?: boolean; dashboard?: boolean; expectedSchoolId?: string } = {}) {
  const { schoolId } = await requireRole(["admin"]);
  if (options.expectedSchoolId && options.expectedSchoolId !== schoolId) throw new AuthorizationError("School access denied.", 403);
  const parsed = filters.safeParse(Object.fromEntries(Object.entries(params).filter(([key, value]) => Object.hasOwn(filters.shape, key) && value !== undefined && value !== "")));
  return prisma.$transaction(async (db) => {
    const settings = await db.schoolNotificationSetting.findUnique({ where: { schoolId }, select: { timezone: true, activeDays: true, openingTime: true, closingTime: true } });
    const academicPeriods = options.dashboard ? await db.cAConfig.findMany({ where: { schoolId, isActive: true }, take: 2, select: { academicYear: true, currentTerm: true, classworkWeight: true, examWeight: true } }) : [];
    const timezone = settings?.timezone || "Africa/Accra";
    const activeDays = settings?.activeDays ?? ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
    const today = schoolAttendanceDate(now, timezone);
    const selection = parsed.success ? parsed.data : {};
    const selectedDate = selection.date ?? today;
    const reviewDate = selectedDate <= today ? selectedDate : today;
    const bounds = attendanceDateBounds(reviewDate, timezone);
    const since = options.includeHistory === false ? reviewDate : shiftAttendanceDate(reviewDate, -29);
    const rangeStart = attendanceDateBounds(since, timezone).start;
    const cutoff = new Date(Math.min(bounds.end.getTime() - 1, now.getTime()));
    if (options.dashboard) await assertDashboardReadBudget([
      [db.class.count({ where: { schoolId } }), 200],
      [db.student.count({ where: { schoolId, status: "ACTIVE" } }), 5000],
      [db.publishedTimetableLesson.count({ where: { schoolId } }), 20000],
      [db.timetablePublication.count({ where: { schoolId, publishedAt: { gte: rangeStart, lte: cutoff } } }), 50],
      [db.attendance.count({ where: { schoolId, date: { gte: rangeStart, lt: bounds.end } } }), 50000],
    ]);
    const classes = await db.class.findMany({ where: { schoolId }, select: { id: true, name: true }, orderBy: { name: "asc" } });
    let error: string | null = parsed.success ? null : "Some attendance filters are invalid.";
    if (selectedDate > today) error = "Future attendance cannot be reviewed.";
    if (selection.classId && !classes.some((cls) => cls.id === selection.classId)) error = "This class is not available in your school.";
    const selectedStudent = selection.studentId ? await db.student.findFirst({ where: { id: selection.studentId, schoolId, class: { is: { schoolId } } }, select: { id: true, name: true, surname: true, classId: true, status: true, createdAt: true } }) : null;
    if (selection.studentId && !selectedStudent) error = "This student is not available in your school.";
    const basePublication = await db.timetablePublication.findFirst({ where: { schoolId, publishedAt: { lt: rangeStart } }, orderBy: [{ publishedAt: "desc" }, { version: "desc" }], include: { lessons: { where: { schoolId } } } });
    const recentPublications = await db.timetablePublication.findMany({ where: { schoolId, publishedAt: { gte: rangeStart, lte: cutoff } }, orderBy: [{ publishedAt: "desc" }, { version: "desc" }], include: { lessons: { where: { schoolId } } } });
    const publications = [...recentPublications, ...(basePublication ? [basePublication] : [])];
    const schedule = attendanceSchedule(publications, reviewDate, timezone, activeDays, now);
    const selectedLessons = schedule.lessons.filter((lesson) => !selection.classId || lesson.classId === selection.classId);
    const students = await db.student.findMany({ where: { schoolId, status: "ACTIVE", createdAt: { lte: cutoff }, class: { is: { schoolId } }, ...(selection.classId ? { OR: [{ classId: selection.classId }, { attendances: { some: { schoolId, date: { gte: bounds.start, lt: bounds.end }, lessonId: { in: selectedLessons.map((lesson) => lesson.sourceId) } } } }] } : {}), ...(error ? { id: "__invalid_selection__" } : {}) }, select: { id: true, name: true, surname: true, classId: true, createdAt: true }, orderBy: [{ name: "asc" }, { surname: "asc" }, { id: "asc" }] });
    const studentIds = [...new Set([...students.map((student) => student.id), ...(selectedStudent && !error ? [selectedStudent.id] : [])])];
    const records = studentIds.length ? await db.attendance.findMany({ where: { schoolId, studentId: { in: studentIds }, student: { is: { schoolId } }, lesson: { is: { schoolId } }, date: { gte: rangeStart, lt: bounds.end }, createdAt: { lte: now }, updatedAt: { lte: now } }, select: { id: true, studentId: true, lessonId: true, date: true, status: true, updatedAt: true } }) : [];
    // Lesson totals must not depend on which student's history is opened.
    const lessonRecords = selectedLessons.length && !error ? await db.attendance.findMany({
      where: { schoolId, lessonId: { in: selectedLessons.map((lesson) => lesson.sourceId) }, student: { is: { schoolId } }, lesson: { is: { schoolId } }, date: { gte: bounds.start, lt: bounds.end }, createdAt: { lte: now }, updatedAt: { lte: now } },
      select: { id: true, studentId: true, lessonId: true, date: true, status: true, updatedAt: true },
    }) : [];
    const byDayStudent = new Map<string, typeof records>();
    if (options.dashboard) assertDashboardWorkBudget(selectedLessons.length * (students.length + records.length + lessonRecords.length));
    for (const record of records) { const key = `${schoolAttendanceDate(record.date, timezone)}:${record.studentId}`; const list = byDayStudent.get(key) ?? []; list.push(record); byDayStudent.set(key, list); }
    const daySchedules = new Map<string, ReturnType<typeof attendanceSchedule>>();
    for (let key = since; key <= reviewDate; key = shiftAttendanceDate(key, 1)) daySchedules.set(key, attendanceSchedule(publications, key, timezone, activeDays, now));
    function position(student: { id: string; classId: number; createdAt: Date }, key: string) {
      const day = daySchedules.get(key)!;
      const marks = latestAttendanceMarks(byDayStudent.get(`${key}:${student.id}`) ?? []);
      const matched = marks.filter((mark) => day.lessons.some((lesson) => lesson.sourceId === mark.lessonId));
      const recordedClassIds = [...new Set(matched.map((mark) => day.lessons.find((lesson) => lesson.sourceId === mark.lessonId)!.classId))];
      const placementKnown = key === today || recordedClassIds.length === 1;
      const recordClassId = key === today ? student.classId : recordedClassIds.length === 1 ? recordedClassIds[0] : null;
      const classLessons = day.lessons.filter((lesson) => lesson.classId === recordClassId);
      const expected = classLessons.filter((lesson) => student.createdAt <= attendanceClock(key, lesson.startTime, timezone) || matched.some((mark) => mark.lessonId === lesson.sourceId)).map((lesson) => lesson.sourceId);
      const placementChanged = key === today && recordedClassIds.some((id) => id !== student.classId);
      const joinedBeforeLessons = classLessons.length > 0 && classLessons.every((lesson) => student.createdAt <= attendanceClock(key, lesson.startTime, timezone));
      const completeEvidence = !day.ambiguous && !placementChanged && recordedClassIds.length <= 1 && placementKnown && joinedBeforeLessons;
      // Presence is positive evidence even after a class move; negative evidence needs a known placement.
      const evidenceIds = [...new Set([...expected, ...matched.map((mark) => mark.lessonId)])];
      let status = schoolDayPosition(matched, evidenceIds, completeEvidence);
      if (status === "NO_LESSONS" && (marks.length > 0 || day.ambiguous || (day.operatingDay && key !== today && !placementKnown))) status = "UNKNOWN";
      return { date: key, status, classId: recordClassId, expected: placementKnown && !placementChanged && recordedClassIds.length <= 1 ? evidenceIds.length : null, marked: matched.length, className: recordClassId === null ? "Class not recorded" : day.lessons.find((lesson) => lesson.classId === recordClassId)?.className ?? classes.find((cls) => cls.id === recordClassId)?.name ?? "Historical class", ambiguous: day.ambiguous || placementChanged || recordedClassIds.length > 1, unmatched: marks.length - matched.length };
    }
    const roster = students.map((student) => {
      const daily = position(student, reviewDate);
      const history = [...daySchedules.keys()].filter((key) => student.createdAt < daySchedules.get(key)!.end).map((key) => position(student, key));
      return { student, ...daily, absentDays: history.filter((day) => day.status === "ABSENT").length, lateDays: history.filter((day) => day.status === "LATE").length };
    }).filter((row) => !selection.classId || row.classId === selection.classId);
    const totals: Record<DayPosition, number> = { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0, UNKNOWN: 0, NO_LESSONS: 0 };
    for (const row of roster) totals[row.status]++;
    const policy = await db.teacherAccountabilitySetting.findUnique({ where: { schoolId }, select: { allowEarlyAttendanceMarking: true, attendanceOpenMinutesBeforeLesson: true, attendanceEscalateMinutesAfterLesson: true } }) ?? DEFAULT_TEACHER_ACCOUNTABILITY_SETTINGS;
    const lessonRows = selectedLessons.map((lesson) => {
      const starts = attendanceClock(reviewDate, lesson.startTime, timezone);
      const dayMarks = latestAttendanceMarks(lessonRecords.filter((mark) => mark.lessonId === lesson.sourceId));
      const markedIds = new Set(dayMarks.map((mark) => mark.studentId));
      const rosterIds = eligibleAttendanceStudentIds(students.filter((student) => student.classId === lesson.classId), starts, markedIds);
      const marked = reviewDate === today ? dayMarks.filter((mark) => rosterIds.has(mark.studentId)).length : dayMarks.length;
      const expected = reviewDate === today ? rosterIds.size : null;
      const rosterChanged = reviewDate === today && dayMarks.some((mark) => !rosterIds.has(mark.studentId));
      const openAt = new Date(starts.getTime() - (policy?.allowEarlyAttendanceMarking ? policy.attendanceOpenMinutesBeforeLesson * 60000 : 0));
      const closedAt = policy ? new Date(attendanceClock(reviewDate, lesson.endTime, timezone).getTime() + policy.attendanceEscalateMinutesAfterLesson * 60000) : null;
      const state = expected === null ? "HISTORICAL" : schedule.ambiguous || rosterChanged ? "REVIEW" : expected === 0 ? "NO_ROSTER" : marked === expected ? "COMPLETE" : now < openAt ? "UPCOMING" : closedAt && now > closedAt ? "WINDOW_CLOSED" : marked > 0 ? "PARTIAL" : "UNMARKED";
      return { ...lesson, expected, marked, recorded: dayMarks.length, state, openAt, closedAt };
    });
    const history = selectedStudent && !error ? [...daySchedules.keys()].filter((key) => selectedStudent.createdAt < daySchedules.get(key)!.end).reverse().map((key) => position(selectedStudent, key)) : [];
    if (selectedStudent && selection.classId && selectedStudent.classId !== selection.classId && !history.some((day) => day.marked > 0 && day.classId === selection.classId)) error = "This student has no available history for the selected class.";
    const recurring = roster.filter((row) => row.absentDays >= 3).sort((a, b) => b.absentDays - a.absentDays || a.student.id.localeCompare(b.student.id));
    const matches = error ? [] : roster.filter((row) => !selection.status || row.status === selection.status);
    const pageCount = Math.max(1, Math.ceil(matches.length / 25));
    const page = Math.min(selection.page ?? 1, pageCount);
    return { schoolId, operatingSettings: settings, academicPeriods, date: reviewDate, today, timezone, since, selection, classes, error, totals, rosterCount: roster.length, count: matches.length, page, pageCount, rows: matches.slice((page - 1) * 25, page * 25), recurring: error ? [] : recurring.slice(0, 10), recurringCount: error ? 0 : recurring.length, history: error ? [] : history, selectedStudent: error ? null : selectedStudent, lessons: error ? [] : lessonRows, publication: schedule.publication ? { id: schedule.publication.id, publishedAt: schedule.publication.publishedAt } : null, operatingDay: schedule.operatingDay, ambiguous: schedule.ambiguous };
  }, { isolationLevel: "RepeatableRead", maxWait: 5000, timeout: 30000 });
}
