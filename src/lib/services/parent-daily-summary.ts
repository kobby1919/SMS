import prisma from "@/src/lib/prisma";
import { getSubjectCAProgress } from "@/src/lib/services/ca-activity";

function dayWindow(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function rebuildParentDailySummary(input: {
  schoolId: string;
  parentId: string;
  date: Date;
}) {
  const { start, end } = dayWindow(input.date);
  const events = await prisma.parentActivityEvent.findMany({
    where: {
      schoolId: input.schoolId,
      parentId: input.parentId,
      occurredAt: { gte: start, lt: end },
    },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
  });

  if (events.length === 0) return null;

  const counts = {
    attendance: events.filter((event) => event.type === "ATTENDANCE").length,
    academics: events.filter((event) => event.type === "ASSESSMENT").length,
    homework: events.filter((event) => event.type === "ASSIGNMENT").length,
    notices: events.filter((event) => event.type === "ANNOUNCEMENT").length,
    finance: events.filter((event) => event.type === "BILL" || event.type === "PAYMENT").length,
  };
  const academicLines = events
    .filter((event) => event.type === "ASSESSMENT")
    .slice(0, 4)
    .map((event) => event.body);
  const summaryBits = [
    `${events.length} school update${events.length === 1 ? "" : "s"}`,
    counts.academics ? `${counts.academics} academic` : null,
    counts.homework ? `${counts.homework} homework` : null,
    counts.notices ? `${counts.notices} notice` : null,
    counts.finance ? `${counts.finance} finance` : null,
  ].filter(Boolean);

  return prisma.parentNotification.upsert({
    where: {
      schoolId_parentId_sourceKey: {
        schoolId: input.schoolId,
        parentId: input.parentId,
        sourceKey: `daily-summary:${input.parentId}:${dateKey(start)}`,
      },
    },
    create: {
      schoolId: input.schoolId,
      parentId: input.parentId,
      type: "DAILY_SUMMARY",
      priority: counts.attendance > 0 ? "HIGH" : "NORMAL",
      title: "Today's School Update",
      body: academicLines.length > 0
        ? academicLines.join("\n")
        : summaryBits.join(" - "),
      payload: { counts, eventIds: events.map((event) => event.id) },
      sourceModel: "ParentDailySummary",
      sourceId: dateKey(start),
      sourceKey: `daily-summary:${input.parentId}:${dateKey(start)}`,
      occurredAt: new Date(),
    },
    update: {
      title: "Today's School Update",
      body: academicLines.length > 0
        ? academicLines.join("\n")
        : summaryBits.join(" - "),
      payload: { counts, eventIds: events.map((event) => event.id) },
      occurredAt: new Date(),
      readAt: null,
    },
  });
}

export async function recordCAActivityScoreEvents(input: {
  schoolId: string;
  activityId: number;
  scoreIds: number[];
}) {
  if (input.scoreIds.length === 0) return [];

  const activity = await prisma.cAActivity.findFirst({
    where: { id: input.activityId, schoolId: input.schoolId },
    include: {
      bucket: {
        select: {
          id: true,
          name: true,
          allocationMarks: true,
          term: true,
          academicYear: true,
        },
      },
      subject: { select: { id: true, name: true } },
      class: { select: { id: true } },
      teacher: { select: { id: true, name: true, surname: true } },
      scores: {
        where: { id: { in: input.scoreIds } },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              surname: true,
              parentId: true,
            },
          },
        },
      },
    },
  });

  if (!activity) throw new Error("CA activity not found.");

  const events = [];
  for (const score of activity.scores) {
    const progress = await getSubjectCAProgress({
      schoolId: input.schoolId,
      studentId: score.student.id,
      classId: activity.class.id,
      subjectId: activity.subject.id,
      term: activity.bucket.term,
      academicYear: activity.bucket.academicYear,
    });
    const teacherName = `${activity.teacher.name} ${activity.teacher.surname}`;
    const rawScore = Number(score.rawScore);
    const rawMaxScore = Number(activity.rawMaxScore);
    const normalized = Number(score.normalizedContribution);
    const eventBody = `${activity.subject.name}: ${activity.title} added by ${teacherName}. Score ${rawScore}/${rawMaxScore}. ${activity.bucket.name} CA mark: ${normalized}/${Number(activity.bucket.allocationMarks)}. Current ${activity.subject.name} CA: ${progress.earnedMarks}/${progress.classworkWeight}.`;

    events.push({
      schoolId: input.schoolId,
      parentId: score.student.parentId,
      studentId: score.student.id,
      teacherId: activity.teacher.id,
      type: "ASSESSMENT" as const,
      title: `${activity.subject.name} CA update`,
      body: eventBody,
      href: `/list/report-cards/${score.student.id}?term=${activity.bucket.term}&year=${activity.bucket.academicYear}&classId=${activity.class.id}`,
      payload: {
        studentName: `${score.student.name} ${score.student.surname}`,
        subjectName: activity.subject.name,
        teacherName,
        activityTitle: activity.title,
        rawScore,
        rawMaxScore,
        bucketName: activity.bucket.name,
        bucketMark: normalized,
        bucketAllocation: Number(activity.bucket.allocationMarks),
        currentCA: progress.earnedMarks,
        caWeight: progress.classworkWeight,
      },
      sourceModel: "CAActivityScore",
      sourceId: String(score.id),
      sourceKey: `ca-activity-score:${score.id}:${score.updatedAt.getTime()}`,
      occurredAt: new Date(),
    });
  }

  if (events.length > 0) {
    await prisma.parentActivityEvent.createMany({
      data: events,
      skipDuplicates: true,
    });
  }

  const uniqueParentIds = [...new Set(events.map((event) => event.parentId))];
  await Promise.all(
    uniqueParentIds.map((parentId) =>
      rebuildParentDailySummary({
        schoolId: input.schoolId,
        parentId,
        date: new Date(),
      }),
    ),
  );

  return events;
}
