// src/app/(dashboard)/teacher/page.tsx

import prisma from "@/src/lib/prisma";
import { requirePageSession } from "@/src/lib/authz";
import Announcements from "@/src/components/Announcements";
import EventCalendar from "@/src/components/EventCalendar";
import EventList from "@/src/components/EventList";
import WelcomeBanner from "@/src/components/WelcomeBanner";
import UpcomingExams from "@/src/components/UpcomingExams";
import { getActiveAcademicPeriod } from "@/src/lib/services/academic-period";
import { getTeacherSelfAccountabilityOverview } from "@/src/lib/queries/teacher-self-accountability";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarCheck2,
  ClipboardCheck,
  FilePenLine,
  GraduationCap,
  Layers3,
  Megaphone,
  NotebookPen,
  ShieldCheck,
  Users,
} from "lucide-react";

const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
const schoolDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("en-GH", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatTerm(term: string) {
  return term.replace("TERM_", "Term ");
}

function startMonthForTerm(term: string) {
  if (term === "TERM_1") return 8;
  if (term === "TERM_2") return 0;
  return 4;
}

function currentSyllabusWeek(term: string, academicYear: string) {
  const startYear = Number.parseInt(academicYear.split("/")[0], 10);
  const now = new Date();
  const fallbackYear = Number.isFinite(startYear) ? startYear : now.getFullYear();
  const termStart = new Date(fallbackYear, startMonthForTerm(term), 1);
  const diffMs = now.getTime() - termStart.getTime();
  const week = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, Math.min(16, week));
}

function topicEndWeek(topic: { weekNumber: number; durationWeeks: number }) {
  return topic.weekNumber + topic.durationWeeks - 1;
}

const TeacherPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { userId, schoolId } = await requirePageSession(["teacher"]);
  const resolvedSearchParams = await searchParams;
  const today = new Date();
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);
  const todayDay = dayNames[today.getDay()];

  const [teacher, lessons, activePeriod, accountability] = await Promise.all([
    prisma.teacher.findFirst({
      where: { id: userId, schoolId },
      include: { classes: { select: { id: true, name: true } } },
    }),
    prisma.lesson.findMany({
      where:   { schoolId, teacherId: userId },
      include: {
        subject: { select: { name: true } },
        class:   {
          select: {
            id: true,
            name: true,
            gradeId: true,
            _count: { select: { students: true } },
          },
        },
      },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    }),
    getActiveAcademicPeriod(schoolId),
    getTeacherSelfAccountabilityOverview({ schoolId, teacherId: userId }),
  ]);

  const todayLessons = lessons.filter((lesson) => lesson.day === todayDay);
  const todayLessonIds = todayLessons.map((lesson) => lesson.id);

  const syllabusPairs = lessons
    .map((lesson) => ({
      subjectId: lesson.subjectId,
      gradeId: lesson.class.gradeId,
    }))
    .filter((pair, index, all) =>
      all.findIndex((item) => item.subjectId === pair.subjectId && item.gradeId === pair.gradeId) === index
    );

  const [todayAttendance, homeworkTasks, caTasks, syllabi] = await Promise.all([
    todayLessonIds.length > 0
      ? prisma.attendance.findMany({
          where: {
            schoolId,
            lessonId: { in: todayLessonIds },
            date: { gte: todayStart, lte: todayEnd },
          },
          select: { lessonId: true, studentId: true, status: true },
        })
      : [],
    prisma.assignment.findMany({
      where: {
        schoolId,
        lesson: { teacherId: userId },
        dueDate: { lte: todayEnd },
      },
      include: {
        lesson: {
          select: {
            subject: { select: { name: true } },
            class: { select: { name: true } },
          },
        },
        homeworkSubmissions: {
          select: { status: true },
        },
      },
      orderBy: [{ dueDate: "asc" }],
      take: 6,
    }),
    prisma.cAActivity.findMany({
      where: {
        schoolId,
        teacherId: userId,
        bucket: {
          term: activePeriod.currentTerm,
          academicYear: activePeriod.academicYear,
        },
      },
      include: {
        subject: { select: { name: true } },
        class: {
          select: {
            name: true,
            _count: { select: { students: true } },
          },
        },
        scores: { select: { studentId: true } },
      },
      orderBy: [{ activityDate: "desc" }, { id: "desc" }],
      take: 8,
    }),
    syllabusPairs.length > 0
      ? prisma.syllabus.findMany({
          where: {
            schoolId,
            status: "PUBLISHED",
            term: activePeriod.currentTerm,
            academicYear: activePeriod.academicYear,
            OR: syllabusPairs,
          },
          include: {
            subject: { select: { name: true } },
            grade: { select: { level: true } },
            topics: {
              select: {
                id: true,
                title: true,
                weekNumber: true,
                durationWeeks: true,
                progress: {
                  where: { schoolId },
                  select: { classId: true },
                },
              },
              orderBy: { order: "asc" },
            },
          },
        })
      : [],
  ]);

  const taughtClasses = Array.from(
    new Map(lessons.map((l) => [l.class.name, l.class.name])).values()
  );

  const attendanceByLesson = todayAttendance.reduce((map, record) => {
    const current = map.get(record.lessonId) ?? { total: 0, absent: 0, late: 0 };
    current.total += 1;
    if (record.status === "ABSENT") current.absent += 1;
    if (record.status === "LATE") current.late += 1;
    map.set(record.lessonId, current);
    return map;
  }, new Map<number, { total: number; absent: number; late: number }>());

  const lessonWork = todayLessons.map((lesson) => {
    const attendance = attendanceByLesson.get(lesson.id) ?? { total: 0, absent: 0, late: 0 };
    const expected = lesson.class._count.students;
    const attendanceState =
      attendance.total === 0
        ? "Not marked"
        : attendance.total < expected
          ? "Partial"
          : "Completed";

    return {
      lesson,
      expected,
      attendance,
      attendanceState,
    };
  });

  const pendingAttendanceCount = lessonWork.filter((item) => item.attendanceState !== "Completed").length;
  const pendingHomeworkChecks = homeworkTasks
    .map((assignment) => ({
      assignment,
      pending: assignment.homeworkSubmissions.filter((submission) => submission.status === "PENDING").length,
      missing: assignment.homeworkSubmissions.filter((submission) => submission.status === "MISSING").length,
    }))
    .filter((item) => item.pending > 0 || item.missing > 0);
  const pendingCATasks = caTasks
    .map((activity) => ({
      activity,
      pending: Math.max(activity.class._count.students - activity.scores.length, 0),
    }))
    .filter((item) => item.pending > 0);

  const syllabusWeek = currentSyllabusWeek(activePeriod.currentTerm, activePeriod.academicYear);
  const syllabusInsights = syllabi
    .flatMap((syllabus) => {
      const matchingClassIds = lessons
        .filter((lesson) => lesson.subjectId === syllabus.subjectId && lesson.class.gradeId === syllabus.gradeId)
        .map((lesson) => lesson.class.id)
        .filter((classId, index, all) => all.indexOf(classId) === index);

      return matchingClassIds.map((classId) => {
        const className = lessons.find((lesson) => lesson.class.id === classId)?.class.name ?? "Class";
        const coveredTopicIds = new Set(
          syllabus.topics
            .filter((topic) => topic.progress.some((progress) => progress.classId === classId))
            .map((topic) => topic.id),
        );
        const totalTopics = syllabus.topics.length;
        const coveredCount = coveredTopicIds.size;
        const overdueCount = syllabus.topics.filter(
          (topic) => topicEndWeek(topic) < syllabusWeek && !coveredTopicIds.has(topic.id)
        ).length;
        const dueNowCount = syllabus.topics.filter((topic) => {
          const endWeek = topicEndWeek(topic);
          return topic.weekNumber <= syllabusWeek && endWeek >= syllabusWeek && !coveredTopicIds.has(topic.id);
        }).length;
        const nextTopic = syllabus.topics.find((topic) => !coveredTopicIds.has(topic.id)) ?? null;
        const status =
          totalTopics === 0 ? "No topics" :
          coveredCount >= totalTopics ? "Completed" :
          overdueCount > 0 ? "Behind" :
          "On track";

        return {
          syllabusId: syllabus.id,
          subjectName: syllabus.subject.name,
          className,
          status,
          overdueCount,
          dueNowCount,
          nextTopicTitle: nextTopic?.title ?? "All topics covered",
          progressPct: totalTopics > 0 ? Math.round((coveredCount / totalTopics) * 100) : 0,
        };
      });
    })
    .sort((a, b) => {
      const statusRank = { Behind: 0, "On track": 1, Completed: 2, "No topics": 3 } as Record<string, number>;
      return (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9) || b.overdueCount - a.overdueCount;
    });
  const syllabusAttentionCount = syllabusInsights.filter((item) => item.status === "Behind" || item.dueNowCount > 0).length;

  const accountabilityAttentionCount =
    accountability.totals.pending +
    accountability.totals.completedLate +
    accountability.totals.missed +
    accountability.totals.escalated;
  const taskCount =
    pendingAttendanceCount +
    pendingHomeworkChecks.length +
    pendingCATasks.length +
    syllabusAttentionCount +
    accountabilityAttentionCount;

  const teacherFirstName = teacher?.name ?? "Teacher";
  const teacherFullName  = teacher ? `${teacher.name} ${teacher.surname}` : teacherFirstName;
  const lessonsByDay = schoolDays.map((day) => ({
    day,
    lessons: lessons.filter((lesson) => lesson.day === day),
  }));
  const todayLabel = new Intl.DateTimeFormat("en-GH", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(today);

  return (
    <div className="flex flex-col gap-4 p-3 sm:p-4 xl:flex-row">

      <div className="w-full xl:w-2/3 flex flex-col gap-4">

        <WelcomeBanner
          role="teacher"
          name={teacherFirstName}
          subtitle={`${todayLabel} · ${taskCount} item${taskCount === 1 ? "" : "s"} needing attention today`}
          tag={`${formatTerm(activePeriod.currentTerm)} · ${activePeriod.academicYear}`}
        />

        <section className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-sky-400/10 p-2 text-sky-200">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="text-base font-black">Accountability Check</h2>
                <p className="mt-1 text-sm font-medium text-slate-300">
                  Weekly reliability is {accountability.totals.reliabilityScore}%.
                  {accountabilityAttentionCount > 0
                    ? ` ${accountabilityAttentionCount} item${accountabilityAttentionCount === 1 ? "" : "s"} need attention.`
                    : " No late, missed, or escalated duty is waiting."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto">
              <div className="rounded-xl bg-white/10 px-3 py-2">
                <p className="text-lg font-black">{accountability.totals.today}</p>
                <p className="text-[10px] font-bold uppercase text-slate-300">Today</p>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-2">
                <p className="text-lg font-black">{accountability.totals.pending}</p>
                <p className="text-[10px] font-bold uppercase text-slate-300">Pending</p>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-2">
                <p className="text-lg font-black">{accountability.totals.completedLate}</p>
                <p className="text-[10px] font-bold uppercase text-slate-300">Late</p>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-2">
                <p className="text-lg font-black">{accountability.totals.openEscalations}</p>
                <p className="text-[10px] font-bold uppercase text-slate-300">Escalated</p>
              </div>
            </div>

            <Link
              href="/teacher/accountability"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-slate-100 lg:w-auto"
            >
              {accountabilityAttentionCount > 0 ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
              Open accountability
            </Link>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-black text-gray-800">Today&apos;s Work</h1>
              <p className="text-sm font-medium text-gray-400">
                Start from here. Attendance, CA, and homework actions stay tied to your timetable.
              </p>
            </div>
            <Link
              href="/list/assignments"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white transition hover:bg-slate-700 sm:w-auto"
            >
              <NotebookPen size={14} />
              Homework
            </Link>
          </div>

          {lessonWork.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
              <BookOpenCheck size={28} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-black text-gray-500">No lessons on your timetable today.</p>
              <p className="mt-1 text-xs font-semibold text-gray-400">Your weekly schedule is still available below.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {lessonWork.map(({ lesson, expected, attendance, attendanceState }) => (
                <div
                  key={lesson.id}
                  className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-sm font-black text-gray-800">{lesson.subject.name}</h2>
                        <span className="rounded-lg bg-white px-2 py-0.5 text-[11px] font-black text-indigo-600">
                          {lesson.class.name}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-gray-400">
                        {formatTime(lesson.startTime)} - {formatTime(lesson.endTime)} · {expected} student{expected === 1 ? "" : "s"}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex lg:items-center">
                      <span className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-black ${
                        attendanceState === "Completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : attendanceState === "Partial"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-rose-50 text-rose-700"
                      }`}>
                        <CalendarCheck2 size={14} className="mr-1.5" />
                        {attendanceState}
                      </span>
                      <Link
                        href={`/list/attendance/take?lessonId=${lesson.id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-700"
                      >
                        <ClipboardCheck size={14} />
                        Attendance
                      </Link>
                      <Link
                        href={`/list/ca?classId=${lesson.class.id}&view=activity`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white transition hover:bg-indigo-700"
                      >
                        <Layers3 size={14} />
                        CA
                      </Link>
                    </div>
                  </div>
                  {attendance.total > 0 && (
                    <p className="mt-2 text-[11px] font-semibold text-gray-400">
                      Attendance saved for {attendance.total}/{expected}. Absent: {attendance.absent}. Late: {attendance.late}.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-5">
          {[
            {
              label: "Today Lessons",
              value: todayLessons.length,
              icon: <BookOpenCheck size={16} />,
              tone: "bg-indigo-50 text-indigo-600",
            },
            {
              label: "Attendance Due",
              value: pendingAttendanceCount,
              icon: <CalendarCheck2 size={16} />,
              tone: pendingAttendanceCount > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600",
            },
            {
              label: "Homework Checks",
              value: pendingHomeworkChecks.length,
              icon: <NotebookPen size={16} />,
              tone: pendingHomeworkChecks.length > 0 ? "bg-amber-50 text-amber-600" : "bg-gray-50 text-gray-400",
            },
            {
              label: "CA Scores Due",
              value: pendingCATasks.length,
              icon: <FilePenLine size={16} />,
              tone: pendingCATasks.length > 0 ? "bg-violet-50 text-violet-600" : "bg-gray-50 text-gray-400",
            },
            {
              label: "Syllabus Pace",
              value: syllabusAttentionCount,
              icon: <BookOpenCheck size={16} />,
              tone: syllabusAttentionCount > 0 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600",
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.tone}`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-xl font-black text-gray-800 leading-none">{stat.value}</p>
                <p className="text-xs text-gray-400 font-medium mt-0.5">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-gray-800">Syllabus Pace</h2>
                <p className="text-xs font-semibold text-gray-400">Simple teaching guide progress.</p>
              </div>
              <BookOpenCheck size={18} className="text-emerald-500" />
            </div>
            {syllabusInsights.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-3 py-4 text-sm font-bold text-gray-400">
                No published syllabus is linked to your timetable yet.
              </p>
            ) : (
              <div className="space-y-2">
                {syllabusInsights.slice(0, 3).map((item) => (
                  <Link
                    key={`${item.syllabusId}-${item.className}`}
                    href={`/list/syllabus/${item.syllabusId}`}
                    className="block rounded-xl border border-gray-100 px-3 py-2 transition hover:border-emerald-200 hover:bg-emerald-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-gray-800">
                          {item.subjectName} · {item.className}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-xs font-semibold text-gray-400">
                          Next: {item.nextTopicTitle}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-black ${
                        item.status === "Behind"
                          ? "bg-amber-50 text-amber-700"
                          : item.status === "Completed"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-sky-50 text-sky-700"
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.progressPct}%` }} />
                    </div>
                    {(item.overdueCount > 0 || item.dueNowCount > 0) && (
                      <p className="mt-1.5 text-[10px] font-bold text-gray-400">
                        {item.overdueCount > 0 ? `${item.overdueCount} overdue` : `${item.dueNowCount} due this week`}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-gray-800">CA Scores Waiting</h2>
                <p className="text-xs font-semibold text-gray-400">Activities created but not fully marked.</p>
              </div>
              <FilePenLine size={18} className="text-indigo-500" />
            </div>
            {pendingCATasks.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-3 py-4 text-sm font-bold text-gray-400">No CA score task is waiting.</p>
            ) : (
              <div className="space-y-2">
                {pendingCATasks.slice(0, 4).map(({ activity, pending }) => (
                  <Link
                    key={activity.id}
                    href={`/list/ca?classId=${activity.classId}&view=activity`}
                    className="block rounded-xl border border-gray-100 px-3 py-2 transition hover:border-indigo-200 hover:bg-indigo-50"
                  >
                    <p className="text-sm font-black text-gray-800">{activity.subject.name}: {activity.title}</p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-400">
                      {activity.class.name} · {pending} score{pending === 1 ? "" : "s"} remaining
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-gray-800">Homework Checks</h2>
                <p className="text-xs font-semibold text-gray-400">Due or overdue work that needs status updates.</p>
              </div>
              <NotebookPen size={18} className="text-amber-500" />
            </div>
            {pendingHomeworkChecks.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-3 py-4 text-sm font-bold text-gray-400">No homework check is waiting.</p>
            ) : (
              <div className="space-y-2">
                {pendingHomeworkChecks.slice(0, 4).map(({ assignment, pending, missing }) => (
                  <Link
                    key={assignment.id}
                    href="/list/assignments"
                    className="block rounded-xl border border-gray-100 px-3 py-2 transition hover:border-amber-200 hover:bg-amber-50"
                  >
                    <p className="text-sm font-black text-gray-800">{assignment.lesson.subject.name}: {assignment.title}</p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-400">
                      {assignment.lesson.class.name} · {pending} pending · {missing} missing
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Users size={16} className="text-emerald-500" />
            <p className="text-sm font-black text-gray-800">Teaching Classes</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
              {taughtClasses.length > 0
                ? taughtClasses.map((name) => (
                    <span key={name} className="text-[11px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg">
                      {name}
                    </span>
                  ))
                : <span className="text-xs text-gray-300">No classes assigned</span>}
          </div>
        </div>

        <section className="bg-white p-5 rounded-2xl shadow-sm">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-lg font-black text-gray-800">Weekly Schedule</h1>
              <p className="text-sm text-gray-400 mt-0.5">{teacherFullName} · compact timetable</p>
            </div>
            <span className="text-xs font-black text-gray-400">{lessons.length} total periods</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {lessonsByDay.map(({ day, lessons: dayLessons }) => (
              <div
                key={day}
                className={`rounded-2xl border p-3 ${
                  day === todayDay ? "border-indigo-200 bg-indigo-50/60" : "border-gray-100 bg-gray-50/70"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-wider text-gray-500">
                    {day.toLowerCase()}
                  </h2>
                  <span className="text-[10px] font-black text-gray-400">
                    {dayLessons.length} period{dayLessons.length === 1 ? "" : "s"}
                  </span>
                </div>
                {dayLessons.length === 0 ? (
                  <p className="rounded-xl bg-white/70 px-3 py-3 text-xs font-bold text-gray-300">
                    No lesson
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dayLessons.map((lesson) => (
                      <div key={lesson.id} className="rounded-xl bg-white px-3 py-2">
                        <p className="truncate text-sm font-black text-gray-800">{lesson.subject.name}</p>
                        <p className="mt-0.5 text-xs font-semibold text-gray-400">
                          {lesson.class.name} · {formatTime(lesson.startTime)} - {formatTime(lesson.endTime)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="w-full xl:w-1/3 flex flex-col gap-4">
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-gray-800">Quick Actions</h2>
              <p className="text-xs font-semibold text-gray-400">Common teacher tasks.</p>
            </div>
            <GraduationCap size={18} className="text-indigo-500" />
          </div>
          <div className="grid gap-2">
            <Link href="/list/attendance/take" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-black text-emerald-700 transition hover:bg-emerald-100">
              <CalendarCheck2 size={14} /> Take Attendance
            </Link>
            <Link href="/list/ca?view=activity" className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2.5 text-xs font-black text-indigo-700 transition hover:bg-indigo-100">
              <Layers3 size={14} /> Add CA Activity
            </Link>
            <Link href="/list/assignments" className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-black text-amber-700 transition hover:bg-amber-100">
              <NotebookPen size={14} /> Give Homework
            </Link>
            <Link href="/list/announcements" className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-100">
              <Megaphone size={14} /> View Notices
            </Link>
          </div>
        </section>
        <UpcomingExams teacherId={userId} />
        <EventCalendar />
        <EventList dateParam={resolvedSearchParams.date} />
        <Announcements />
      </div>
    </div>
  );
};

export default TeacherPage;
