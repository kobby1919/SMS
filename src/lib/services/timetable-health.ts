import type { Day } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import {
  dateTimeToTimeString,
  formatSchoolDayRange,
  getSchoolOperatingWindowStatus,
  isTimeRangeWithinWindow,
  timeToMinutes,
} from "@/src/lib/services/school-operating-hours";

type LessonForHealth = {
  id: number;
  day: Day;
  startTime: Date;
  endTime: Date;
  subjectId: number;
  classId: number;
  teacherId: string;
  subject: { name: string };
  class: { name: string; _count: { students: number } };
  teacher: { name: string; surname: string; subjects: { id: number }[] };
  periodTemplate: null | { name: string; type: string; startTime: string; endTime: string; isActive: boolean };
};

export type TimetableHealthIssue = {
  id: string;
  severity: "critical" | "warning";
  title: string;
  detail: string;
  lessonId?: number;
  classId?: number;
};

export type TimetableHealthSummary = {
  status: "HEALTHY" | "NEEDS_REVIEW" | "CRITICAL";
  score: number;
  totalLessons: number;
  criticalCount: number;
  warningCount: number;
  activeDayLabel: string;
  schoolHoursLabel: string;
  issues: TimetableHealthIssue[];
};

function personName(person: { name: string; surname: string }) {
  return `${person.name} ${person.surname}`.trim();
}

function lessonLabel(lesson: LessonForHealth) {
  return `${lesson.class.name} - ${lesson.subject.name}`;
}

function lessonTimeLabel(lesson: LessonForHealth) {
  return `${dateTimeToTimeString(lesson.startTime)}-${dateTimeToTimeString(lesson.endTime)}`;
}

function overlaps(a: LessonForHealth, b: LessonForHealth) {
  const aStart = timeToMinutes(dateTimeToTimeString(a.startTime));
  const aEnd = timeToMinutes(dateTimeToTimeString(a.endTime));
  const bStart = timeToMinutes(dateTimeToTimeString(b.startTime));
  const bEnd = timeToMinutes(dateTimeToTimeString(b.endTime));
  return aStart < bEnd && aEnd > bStart;
}

function pushConflictIssues(
  issues: TimetableHealthIssue[],
  lessons: LessonForHealth[],
  groupKey: "classId" | "teacherId",
) {
  const grouped = new Map<string, LessonForHealth[]>();
  for (const lesson of lessons) {
    const key = `${lesson.day}:${lesson[groupKey]}`;
    grouped.set(key, [...(grouped.get(key) ?? []), lesson]);
  }

  for (const group of grouped.values()) {
    const sorted = [...group].sort(
      (a, b) =>
        timeToMinutes(dateTimeToTimeString(a.startTime)) -
        timeToMinutes(dateTimeToTimeString(b.startTime)),
    );
    let conflictCount = 0;
    const examples: string[] = [];
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const current = sorted[i];
        const next = sorted[j];
        if (!overlaps(current, next)) break;

        conflictCount++;
        if (examples.length < 3) {
          examples.push(
            groupKey === "classId"
              ? `${current.subject.name} overlaps ${next.subject.name} around ${lessonTimeLabel(current)}`
              : `${current.class.name} overlaps ${next.class.name} around ${lessonTimeLabel(current)}`,
          );
        }
      }
    }
    if (conflictCount > 0) {
      const first = sorted[0];
      const isClassConflict = groupKey === "classId";
      issues.push({
        id: `${groupKey}-conflict-${first.day}-${first[groupKey]}`,
        severity: "critical",
        title: isClassConflict ? "Class has overlapping lessons" : "Teacher has overlapping lessons",
        detail: isClassConflict
          ? `${first.class.name} has ${conflictCount} timetable overlap${conflictCount === 1 ? "" : "s"} on ${first.day.toLowerCase()}. Examples: ${examples.join("; ")}.`
          : `${personName(first.teacher)} has ${conflictCount} timetable overlap${conflictCount === 1 ? "" : "s"} on ${first.day.toLowerCase()}. Examples: ${examples.join("; ")}.`,
        lessonId: first.id,
        classId: first.classId,
      });
    }
  }
}

export async function getTimetableHealthSummary(schoolId: string): Promise<TimetableHealthSummary> {
  const [operatingRules, classes, lessons] = await Promise.all([
    getSchoolOperatingWindowStatus(schoolId),
    prisma.class.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        grade: { select: { order: true } },
      },
      orderBy: [{ grade: { order: "asc" } }, { name: "asc" }],
    }),
    prisma.lesson.findMany({
      where: { schoolId },
      include: {
        subject: { select: { name: true } },
        class: { select: { name: true, _count: { select: { students: true } } } },
        teacher: { select: { name: true, surname: true, subjects: { select: { id: true } } } },
        periodTemplate: { select: { name: true, type: true, startTime: true, endTime: true, isActive: true } },
      },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    }),
  ]);

  const issues: TimetableHealthIssue[] = [];
  const activeDays = operatingRules.activeDays;
  const lessonsWithoutPeriod: LessonForHealth[] = [];
  const periodMismatches: LessonForHealth[] = [];
  const emptyClassLessonCounts = new Map<string, { classId: number; className: string; count: number }>();

  for (const lesson of lessons) {
    const lessonStart = dateTimeToTimeString(lesson.startTime);
    const lessonEnd = dateTimeToTimeString(lesson.endTime);

    if (!activeDays.includes(lesson.day)) {
      issues.push({
        id: `inactive-day-${lesson.id}`,
        severity: "critical",
        title: "Lesson sits outside active school days",
        detail: `${lessonLabel(lesson)} is scheduled on ${lesson.day.toLowerCase()}, but this school operates ${formatSchoolDayRange(activeDays)}.`,
        lessonId: lesson.id,
        classId: lesson.classId,
      });
    }

    if (
      !isTimeRangeWithinWindow(
        lessonStart,
        lessonEnd,
        operatingRules.openingTime,
        operatingRules.closingTime,
      )
    ) {
      issues.push({
        id: `outside-hours-${lesson.id}`,
        severity: "critical",
        title: "Lesson is outside school hours",
        detail: `${lessonLabel(lesson)} runs ${lessonStart}-${lessonEnd}, but school hours are ${operatingRules.openingTime}-${operatingRules.closingTime}.`,
        lessonId: lesson.id,
        classId: lesson.classId,
      });
    }

    if (lesson.class._count.students === 0) {
      const current = emptyClassLessonCounts.get(String(lesson.classId)) ?? {
        classId: lesson.classId,
        className: lesson.class.name,
        count: 0,
      };
      current.count++;
      emptyClassLessonCounts.set(String(lesson.classId), current);
    }

    if (!lesson.teacher.subjects.some((subject) => subject.id === lesson.subjectId)) {
      issues.push({
        id: `teacher-subject-${lesson.id}`,
        severity: "critical",
        title: "Teacher is not assigned to subject",
        detail: `${personName(lesson.teacher)} is scheduled for ${lesson.subject.name}, but that subject is not assigned to the teacher.`,
        lessonId: lesson.id,
        classId: lesson.classId,
      });
    }

    if (!lesson.periodTemplate) {
      lessonsWithoutPeriod.push(lesson);
    } else if (
      !lesson.periodTemplate.isActive ||
      lesson.periodTemplate.type !== "TEACHING" ||
      lesson.periodTemplate.startTime !== lessonStart ||
      lesson.periodTemplate.endTime !== lessonEnd
    ) {
      periodMismatches.push(lesson);
    }
  }

  if (lessonsWithoutPeriod.length > 0) {
    const examples = lessonsWithoutPeriod.slice(0, 3).map((lesson) => lessonLabel(lesson)).join("; ");
    issues.push({
      id: "lessons-without-period-template",
      severity: "warning",
      title: "Lessons need period links",
      detail: `${lessonsWithoutPeriod.length} lesson${lessonsWithoutPeriod.length === 1 ? "" : "s"} still use manual times instead of period templates. Examples: ${examples}.`,
      lessonId: lessonsWithoutPeriod[0].id,
      classId: lessonsWithoutPeriod[0].classId,
    });
  }

  if (periodMismatches.length > 0) {
    const examples = periodMismatches.slice(0, 3).map((lesson) => lessonLabel(lesson)).join("; ");
    issues.push({
      id: "lessons-period-template-mismatch",
      severity: "warning",
      title: "Lessons no longer match their period",
      detail: `${periodMismatches.length} lesson${periodMismatches.length === 1 ? "" : "s"} are linked to periods but their time/type no longer matches. Examples: ${examples}.`,
      lessonId: periodMismatches[0].id,
      classId: periodMismatches[0].classId,
    });
  }

  for (const item of emptyClassLessonCounts.values()) {
    issues.push({
      id: `empty-class-${item.classId}`,
      severity: "warning",
      title: "Class has lessons but no students",
      detail: `${item.className} has ${item.count} scheduled lesson${item.count === 1 ? "" : "s"} but no students. This can make attendance counts misleading.`,
      classId: item.classId,
    });
  }

  pushConflictIssues(issues, lessons, "classId");
  pushConflictIssues(issues, lessons, "teacherId");

  for (const cls of classes) {
    const classLessons = lessons.filter((lesson) => lesson.classId === cls.id);
    if (classLessons.length === 0) {
      issues.push({
        id: `class-no-lessons-${cls.id}`,
        severity: "warning",
        title: "Class has no timetable",
        detail: `${cls.name} has no lessons yet. Teachers, CA, homework, and attendance will not have a timetable source for this class.`,
        classId: cls.id,
      });
      continue;
    }

    const scheduledDays = new Set(classLessons.map((lesson) => lesson.day));
    for (const day of activeDays) {
      if (!scheduledDays.has(day as Day)) {
        issues.push({
          id: `class-missing-day-${cls.id}-${day}`,
          severity: "warning",
          title: "Class has no lesson on an active day",
          detail: `${cls.name} has no lesson on ${day.toLowerCase()}. If this is not intentional, add at least one lesson for that day.`,
          classId: cls.id,
        });
      }
    }
  }

  const criticalCount = issues.filter((issue) => issue.severity === "critical").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const score = Math.max(0, Math.round(100 - criticalCount * 12 - warningCount * 4));

  return {
    status: criticalCount > 0 ? "CRITICAL" : warningCount > 0 ? "NEEDS_REVIEW" : "HEALTHY",
    score,
    totalLessons: lessons.length,
    criticalCount,
    warningCount,
    activeDayLabel: formatSchoolDayRange(activeDays),
    schoolHoursLabel: `${operatingRules.openingTime}-${operatingRules.closingTime}`,
    issues,
  };
}
