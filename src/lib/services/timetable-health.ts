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
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const current = sorted[i];
        const next = sorted[j];
        if (!overlaps(current, next)) break;

        const isClassConflict = groupKey === "classId";
        issues.push({
          id: `${groupKey}-conflict-${current.id}-${next.id}`,
          severity: "critical",
          title: isClassConflict ? "Class has overlapping lessons" : "Teacher has overlapping lessons",
          detail: isClassConflict
            ? `${current.class.name} has ${current.subject.name} and ${next.subject.name} overlapping on ${current.day.toLowerCase()} around ${lessonTimeLabel(current)}.`
            : `${personName(current.teacher)} is assigned to ${current.class.name} and ${next.class.name} at overlapping times on ${current.day.toLowerCase()}.`,
          lessonId: current.id,
          classId: current.classId,
        });
      }
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
      issues.push({
        id: `empty-class-${lesson.id}`,
        severity: "warning",
        title: "Lesson class has no students",
        detail: `${lessonLabel(lesson)} is scheduled, but ${lesson.class.name} has no students. This can make attendance counts misleading.`,
        lessonId: lesson.id,
        classId: lesson.classId,
      });
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
      issues.push({
        id: `lesson-without-period-${lesson.id}`,
        severity: "warning",
        title: "Lesson is not linked to a period",
        detail: `${lessonLabel(lesson)} uses manual time ${lessonStart}-${lessonEnd}. Link it to a teaching period so the timetable stays consistent.`,
        lessonId: lesson.id,
        classId: lesson.classId,
      });
    } else if (
      !lesson.periodTemplate.isActive ||
      lesson.periodTemplate.type !== "TEACHING" ||
      lesson.periodTemplate.startTime !== lessonStart ||
      lesson.periodTemplate.endTime !== lessonEnd
    ) {
      issues.push({
        id: `lesson-period-mismatch-${lesson.id}`,
        severity: "warning",
        title: "Lesson period needs review",
        detail: `${lessonLabel(lesson)} is linked to ${lesson.periodTemplate.name}, but the lesson time or period type no longer matches the template.`,
        lessonId: lesson.id,
        classId: lesson.classId,
      });
    }
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
    issues: issues.slice(0, 12),
  };
}
