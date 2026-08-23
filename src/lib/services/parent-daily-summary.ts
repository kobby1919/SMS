import prisma from "@/src/lib/prisma";
import { getSubjectCAProgress } from "@/src/lib/services/ca-activity";
import { getSchoolBranding } from "@/src/lib/services/school-branding";
import { DISCOUNT_TYPE_LABELS, formatGHS, PAYMENT_METHOD_LABELS } from "@/src/lib/constants/finance";
import { formatMark } from "@/src/lib/formatters/marks";

function dayWindow(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function weekWindow(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - daysFromMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateRangeKey(start: Date, end: Date) {
  const lastIncludedDay = new Date(end);
  lastIncludedDay.setDate(lastIncludedDay.getDate() - 1);
  return `${dateKey(start)}:${dateKey(lastIncludedDay)}`;
}

function formatSummaryDate(date: Date) {
  return date.toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function uniqueEventsByBody<T extends { type: string; body: string; sourceModel: string; sourceId: string }>(events: T[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = event.sourceModel === "CAActivityScore"
      ? `${event.sourceModel}:${event.sourceId}`
      : `${event.type}:${event.body}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toInt(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

type SummaryEvent = {
  type: string;
  title: string;
  body: string;
  payload?: unknown;
  sourceModel: string;
  sourceId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function textFromPayload(payload: unknown, key: string) {
  if (!isRecord(payload)) return null;
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function attendanceStatusFromPayload(payload: unknown) {
  const status = textFromPayload(payload, "status");
  return status === "PRESENT" || status === "ABSENT" || status === "LATE" || status === "EXCUSED"
    ? status
    : null;
}

const ATTENDANCE_STATUS_LABELS = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
} as const;

function buildAttendanceSummaryLines(events: SummaryEvent[], period: "daily" | "weekly") {
  const attendanceEvents = events.filter((event) => event.type === "ATTENDANCE");
  if (attendanceEvents.length === 0) return [];

  if (period === "daily") {
    const grouped = new Map<string, SummaryEvent[]>();
    for (const event of attendanceEvents) {
      const studentName = textFromPayload(event.payload, "studentName") ?? "Your child";
      grouped.set(studentName, [...(grouped.get(studentName) ?? []), event]);
    }

    return Array.from(grouped.entries()).slice(0, 6).map(([studentName, studentEvents]) => {
      const counts = { present: 0, absent: 0, late: 0, excused: 0 };
      for (const event of studentEvents) {
        const status = attendanceStatusFromPayload(event.payload);
        if (status === "PRESENT") counts.present += 1;
        if (status === "ABSENT") counts.absent += 1;
        if (status === "LATE") counts.late += 1;
        if (status === "EXCUSED") counts.excused += 1;
      }

      const overall = counts.absent > 0
        ? "Absent needs attention"
        : counts.late > 0
          ? "Late recorded"
          : counts.excused > 0
            ? "Excused attendance"
            : "Present";
      const lessonLabel = studentEvents.length === 1 ? "lesson" : "lessons";
      const details = studentEvents.slice(0, 4).map((event) => {
        const status = attendanceStatusFromPayload(event.payload);
        const statusLabel = status ? ATTENDANCE_STATUS_LABELS[status] : "Marked";
        const subjectName = textFromPayload(event.payload, "subjectName") ?? "Lesson";
        const teacherName = textFromPayload(event.payload, "teacherName");
        const arrivalTime = textFromPayload(event.payload, "arrivalTime");
        const note = textFromPayload(event.payload, "note");
        return [
          `- ${subjectName}: ${statusLabel}${arrivalTime ? ` at ${arrivalTime}` : ""}`,
          teacherName ? `  Teacher: ${teacherName}` : null,
          note ? `  Note: ${note}` : status === "ABSENT" || status === "LATE" ? "  Note: No reason provided yet." : null,
        ].filter(Boolean).join("\n");
      });

      return [
        `${studentName}: ${overall}.`,
        `Marked lessons: ${studentEvents.length} ${lessonLabel}. Present: ${counts.present}. Late: ${counts.late}. Absent: ${counts.absent}. Excused: ${counts.excused}.`,
        ...details,
      ].join("\n");
    });
  }

  const grouped = new Map<string, { present: number; absent: number; late: number; excused: number; total: number }>();
  for (const event of attendanceEvents) {
    const studentName = textFromPayload(event.payload, "studentName") ?? "Your child";
    const status = attendanceStatusFromPayload(event.payload);
    if (!status) continue;
    const row = grouped.get(studentName) ?? { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
    if (status === "PRESENT") row.present += 1;
    if (status === "ABSENT") row.absent += 1;
    if (status === "LATE") row.late += 1;
    if (status === "EXCUSED") row.excused += 1;
    row.total += 1;
    grouped.set(studentName, row);
  }

  if (grouped.size === 0) return attendanceEvents.slice(0, 6).map((event) => event.body);

  return Array.from(grouped.entries()).slice(0, 6).map(([studentName, row]) => {
    const rate = row.total > 0 ? Math.round((row.present / row.total) * 100) : 0;
    return [
      `${studentName}: ${row.present}/${row.total} present this week.`,
      `Late: ${row.late}. Absent: ${row.absent}. Excused: ${row.excused}.`,
      `Attendance rate: ${rate}%.`,
    ].join("\n");
  });
}

async function buildFinanceSummaryLines(schoolId: string, events: SummaryEvent[]) {
  const financeEvents = events.filter((event) => event.type === "BILL" || event.type === "PAYMENT");
  if (financeEvents.length === 0) return [];

  const billIds = financeEvents
    .filter((event) => event.sourceModel === "StudentBill")
    .map((event) => toInt(event.sourceId))
    .filter((id): id is number => id !== null);
  const paymentIds = financeEvents
    .filter((event) => event.sourceModel === "Payment" || event.sourceModel === "PaymentReversal")
    .map((event) => toInt(event.sourceId))
    .filter((id): id is number => id !== null);
  const discountIds = financeEvents
    .filter((event) => event.sourceModel === "Discount")
    .map((event) => toInt(event.sourceId))
    .filter((id): id is number => id !== null);
  const queryIds = financeEvents
    .filter((event) => event.sourceModel === "FinanceQuery")
    .map((event) => toInt(event.sourceId))
    .filter((id): id is number => id !== null);

  const [bills, payments, discounts, queries] = await Promise.all([
    billIds.length
      ? prisma.studentBill.findMany({
          where: { schoolId, id: { in: billIds } },
          include: {
            student: { select: { name: true, surname: true } },
            feeStructure: { select: { title: true, term: true, academicYear: true } },
          },
        })
      : [],
    paymentIds.length
      ? prisma.payment.findMany({
          where: { schoolId, id: { in: paymentIds } },
          include: {
            reversal: { select: { reason: true } },
            studentBill: {
              select: {
                balance: true,
                feeStructure: { select: { title: true } },
                student: { select: { name: true, surname: true } },
              },
            },
          },
        })
      : [],
    discountIds.length
      ? prisma.discount.findMany({
          where: { schoolId, id: { in: discountIds } },
          include: {
            studentBill: {
              select: {
                balance: true,
                student: { select: { name: true, surname: true } },
                feeStructure: { select: { title: true } },
              },
            },
          },
        })
      : [],
    queryIds.length
      ? prisma.financeQuery.findMany({
          where: { schoolId, id: { in: queryIds } },
          include: {
            student: { select: { name: true, surname: true } },
            studentBill: { select: { balance: true, feeStructure: { select: { title: true } } } },
          },
        })
      : [],
  ]);

  const billById = new Map(bills.map((bill) => [bill.id, bill]));
  const paymentById = new Map(payments.map((payment) => [payment.id, payment]));
  const discountById = new Map(discounts.map((discount) => [discount.id, discount]));
  const queryById = new Map(queries.map((query) => [query.id, query]));

  return financeEvents.slice(0, 8).map((event) => {
    const id = toInt(event.sourceId);
    if (event.sourceModel === "StudentBill" && id) {
      const bill = billById.get(id);
      if (bill) {
        const dueText = bill.dueDate
          ? ` Due ${bill.dueDate.toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" })}.`
          : "";
        return `${bill.feeStructure.title} for ${bill.student.name} ${bill.student.surname}. Total ${formatGHS(bill.totalAmount)}, paid ${formatGHS(bill.amountPaid)}, balance ${formatGHS(bill.balance)}.${dueText}`;
      }
    }

    if ((event.sourceModel === "Payment" || event.sourceModel === "PaymentReversal") && id) {
      const payment = paymentById.get(id);
      if (payment) {
        if (payment.status === "REVERSED") {
          return `Payment ${payment.receiptNumber} for ${payment.studentBill.student.name} ${payment.studentBill.student.surname} was reversed. Amount ${formatGHS(payment.amount)}. Reason: ${payment.reversal?.reason ?? "Not stated"}. Current balance ${formatGHS(payment.studentBill.balance)}.`;
        }
        const receiptText = payment.status === "CONFIRMED" ? ` Receipt ${payment.receiptNumber}.` : "";
        return `${payment.status.toLowerCase()} payment for ${payment.studentBill.student.name} ${payment.studentBill.student.surname}. Amount ${formatGHS(payment.amount)} by ${PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod}.${receiptText} Current balance ${formatGHS(payment.studentBill.balance)}.`;
      }
    }

    if (event.sourceModel === "Discount" && id) {
      const discount = discountById.get(id);
      if (discount) {
        const discountValue = discount.amount
          ? formatGHS(discount.amount)
          : `${Number(discount.percentage ?? 0)}%`;
        return `${discount.status === "REMOVED" ? "Removed" : "Applied"} ${DISCOUNT_TYPE_LABELS[discount.type] ?? discount.type} for ${discount.studentBill.student.name} ${discount.studentBill.student.surname}. Value ${discountValue}. Balance ${formatGHS(discount.studentBill.balance)}. ${discount.status === "REMOVED" ? discount.removeReason ?? "" : discount.description}`;
      }
    }

    if (event.sourceModel === "FinanceQuery" && id) {
      const query = queryById.get(id);
      if (query) {
        return `Finance query for ${query.student.name} ${query.student.surname} is ${query.status.toLowerCase().replace("_", " ")}. Bill: ${query.studentBill.feeStructure.title}. Balance ${formatGHS(query.studentBill.balance)}.`;
      }
    }

    return event.body;
  });
}

const HOMEWORK_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  SUBMITTED: "Submitted",
  LATE: "Submitted late",
  MISSING: "Missing",
  EXCUSED: "Excused",
};

function buildHomeworkSummaryLines(events: SummaryEvent[]) {
  const homeworkEvents = events.filter((event) => event.type === "ASSIGNMENT");
  if (homeworkEvents.length === 0) return [];

  return homeworkEvents.slice(0, 6).map((event) => {
    const subjectName = textFromPayload(event.payload, "subjectName");
    const assignmentTitle = textFromPayload(event.payload, "assignmentTitle");
    const status = textFromPayload(event.payload, "status");
    const note = textFromPayload(event.payload, "note");
    const statusLabel = status ? HOMEWORK_STATUS_LABELS[status] ?? status : null;

    if (!subjectName && !assignmentTitle && !statusLabel) {
      return event.body;
    }

    return [
      `${subjectName ?? "Homework"}${assignmentTitle ? `: ${assignmentTitle}` : ""}`,
      statusLabel ? `Status: ${statusLabel}` : "Status: Assigned",
      note ? `Note: ${note}` : null,
    ].filter(Boolean).join("\n");
  });
}

async function buildAcademicSummaryLines(
  _schoolId: string,
  events: SummaryEvent[],
  periodLabel: "today" | "this week",
) {
  const academicEvents = events.filter((event) => event.type === "ASSESSMENT").slice(0, 4);
  const lines = academicEvents.map((event) => event.body);

  const givenLines = lines.filter((line) => line.includes("Score: Pending"));
  const publishedLines = lines.filter((line) => !line.includes("Score: Pending"));
  return [
    ...buildSection(`Activities given ${periodLabel}`, givenLines),
    ...buildSection(`Scores published ${periodLabel}`, publishedLines),
  ];
}

export async function recordCAActivityGivenEvents(input: {
  schoolId: string;
  activityId: number;
}) {
  const activity = await prisma.cAActivity.findFirst({
    where: { id: input.activityId, schoolId: input.schoolId },
    include: {
      bucket: {
        select: {
          id: true,
          name: true,
          term: true,
          academicYear: true,
        },
      },
      subject: { select: { id: true, name: true } },
      class: {
        select: {
          id: true,
          students: {
            where: { schoolId: input.schoolId },
            select: {
              id: true,
              name: true,
              surname: true,
              parentId: true,
            },
          },
        },
      },
      teacher: { select: { id: true, name: true, surname: true } },
    },
  });

  if (!activity) throw new Error("CA activity not found.");

  const teacherName = `${activity.teacher.name} ${activity.teacher.surname}`;
  const activityDate = activity.activityDate.toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const body = [
    `${activity.subject.name}: ${activity.title}`,
    `Teacher: ${teacherName}`,
    `Activity given: ${activityDate}`,
    "Score: Pending",
    "Note: This activity has been recorded for the class, but marks have not been published yet.",
  ].join("\n");

  const events = activity.class.students.map((student) => ({
    schoolId: input.schoolId,
    parentId: student.parentId,
    studentId: student.id,
    teacherId: activity.teacher.id,
    type: "ASSESSMENT" as const,
    title: `${activity.subject.name} activity given`,
    body,
    href: "/parent/updates",
    payload: {
      studentName: `${student.name} ${student.surname}`,
      subjectName: activity.subject.name,
      teacherName,
      activityTitle: activity.title,
      activityDate: activity.activityDate.toISOString(),
      status: "SCORE_PENDING",
      bucketName: activity.bucket.name,
      term: activity.bucket.term,
      academicYear: activity.bucket.academicYear,
    },
    sourceModel: "CAActivity",
    sourceId: String(activity.id),
    sourceKey: `ca-activity-given:${activity.id}:${student.id}`,
    occurredAt: activity.activityDate,
  }));

  await Promise.all(
    events.map((event) =>
      prisma.parentActivityEvent.upsert({
        where: {
          schoolId_parentId_sourceKey: {
            schoolId: event.schoolId,
            parentId: event.parentId,
            sourceKey: event.sourceKey,
          },
        },
        create: event,
        update: {
          title: event.title,
          body: event.body,
          href: event.href,
          payload: event.payload,
          sourceId: event.sourceId,
          occurredAt: event.occurredAt,
          teacherId: event.teacherId,
          studentId: event.studentId,
        },
      }),
    ),
  );

  const uniqueParentIds = [...new Set(events.map((event) => event.parentId))];
  await Promise.all(
    uniqueParentIds.map((parentId) =>
      rebuildParentDailySummary({
        schoolId: input.schoolId,
        parentId,
        date: activity.activityDate,
      }),
    ),
  );

  return events;
}

function buildSection(title: string, lines: string[]) {
  if (lines.length === 0) return [];
  return [
    `${title}:`,
    ...lines.flatMap((line) => {
      const parts = line.split("\n").map((part) => part.trim()).filter(Boolean);
      return parts.map((part, index) => index === 0 ? `- ${part}` : `  ${part}`);
    }),
  ];
}

async function rebuildParentSummary(input: {
  schoolId: string;
  parentId: string;
  date: Date;
  period: "daily" | "weekly";
}) {
  const { start, end } = input.period === "weekly" ? weekWindow(input.date) : dayWindow(input.date);
  const summaryOccurredAt = new Date(end);
  summaryOccurredAt.setMilliseconds(summaryOccurredAt.getMilliseconds() - 1);
  const events = await prisma.parentActivityEvent.findMany({
    where: {
      schoolId: input.schoolId,
      parentId: input.parentId,
      occurredAt: { gte: start, lt: end },
    },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
  });

  const uniqueEvents = uniqueEventsByBody(events);

  if (uniqueEvents.length === 0) {
    const sourceKey = input.period === "weekly"
      ? `weekly-summary:${input.parentId}:${dateRangeKey(start, end)}`
      : `daily-summary:${input.parentId}:${dateKey(start)}`;
    await prisma.parentNotification.deleteMany({
      where: {
        schoolId: input.schoolId,
        parentId: input.parentId,
        type: "DAILY_SUMMARY",
        sourceKey,
      },
    });
    return null;
  }

  const counts = {
    attendance: uniqueEvents.filter((event) => event.type === "ATTENDANCE").length,
    academics: uniqueEvents.filter((event) => event.type === "ASSESSMENT").length,
    homework: uniqueEvents.filter((event) => event.type === "ASSIGNMENT").length,
    notices: uniqueEvents.filter((event) => event.type === "ANNOUNCEMENT").length,
    finance: uniqueEvents.filter((event) => event.type === "BILL" || event.type === "PAYMENT").length,
  };
  const periodLabel = input.period === "weekly" ? "this week" : "today";
  const academicLines = await buildAcademicSummaryLines(input.schoolId, uniqueEvents, periodLabel);
  const financeLines = await buildFinanceSummaryLines(input.schoolId, uniqueEvents);
  const homeworkLines = buildHomeworkSummaryLines(uniqueEvents);
  const noticeLines = uniqueEvents
    .filter((event) => event.type === "ANNOUNCEMENT")
    .slice(0, 3)
    .map((event) => event.body);
  const attendanceLines = buildAttendanceSummaryLines(uniqueEvents, input.period);
  const summaryBits = [
    `${uniqueEvents.length} school update${uniqueEvents.length === 1 ? "" : "s"}`,
    counts.attendance ? `${counts.attendance} attendance` : null,
    counts.academics ? `${counts.academics} academic` : null,
    counts.homework ? `${counts.homework} homework` : null,
    counts.notices ? `${counts.notices} notice` : null,
    counts.finance ? `${counts.finance} finance` : null,
  ].filter(Boolean);
  const branding = await getSchoolBranding(input.schoolId);
  const isWeekly = input.period === "weekly";
  const sourceKey = isWeekly
    ? `weekly-summary:${input.parentId}:${dateRangeKey(start, end)}`
    : `daily-summary:${input.parentId}:${dateKey(start)}`;
  const sourceModel = isWeekly ? "ParentWeeklySummary" : "ParentDailySummary";
  const sourceId = isWeekly ? dateRangeKey(start, end) : dateKey(start);
  const title = `${branding.displayName} ${isWeekly ? "Weekly" : "Daily"} School Update`;
  const dateHeading = isWeekly
    ? `Week: ${formatSummaryDate(start)} - ${formatSummaryDate(new Date(end.getTime() - 1))}`
    : `Date: ${formatSummaryDate(start)}`;
  const bodyLines = [
    dateHeading,
    ...buildSection("Attendance", attendanceLines),
    ...(academicLines.length > 0 ? ["Academics:", ...academicLines] : []),
    ...buildSection("Homework", homeworkLines),
    ...buildSection("Fees", financeLines),
    ...buildSection("Notices", noticeLines),
    ...buildSection("Teacher Notes", ["No teacher concern raised for this period."]),
  ];
  const body = bodyLines.length > 0
    ? bodyLines.join("\n")
    : summaryBits.join(" - ");

  return prisma.parentNotification.upsert({
    where: {
      schoolId_parentId_sourceKey: {
        schoolId: input.schoolId,
        parentId: input.parentId,
        sourceKey,
      },
    },
    create: {
      schoolId: input.schoolId,
      parentId: input.parentId,
      type: "DAILY_SUMMARY",
      priority: counts.attendance > 0 ? "HIGH" : "NORMAL",
      title,
      body,
      payload: { counts, eventIds: uniqueEvents.map((event) => event.id) },
      sourceModel,
      sourceId,
      sourceKey,
      occurredAt: summaryOccurredAt,
    },
    update: {
      title,
      body,
      payload: { counts, eventIds: uniqueEvents.map((event) => event.id) },
      occurredAt: summaryOccurredAt,
      readAt: null,
    },
  });
}

export async function rebuildParentDailySummary(input: {
  schoolId: string;
  parentId: string;
  date: Date;
}) {
  return rebuildParentSummary({ ...input, period: "daily" });
}

export async function rebuildParentWeeklySummary(input: {
  schoolId: string;
  parentId: string;
  date: Date;
}) {
  return rebuildParentSummary({ ...input, period: "weekly" });
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
    const eventBody = [
      `${activity.subject.name}: ${activity.title}`,
      `Teacher: ${teacherName}`,
      `Score: ${rawScore}/${rawMaxScore}`,
      `${activity.bucket.name} CA mark: ${formatMark(normalized)}/${formatMark(Number(activity.bucket.allocationMarks))}`,
      `Current ${activity.subject.name} CA: ${formatMark(progress.earnedMarks)}/${formatMark(progress.classworkWeight)}`,
      "Note: Exam score is not recorded yet, so this is CA progress, not a final report grade.",
    ].join("\n");
    const href = `/list/report-cards/${score.student.id}?term=${activity.bucket.term}&year=${activity.bucket.academicYear}&classId=${activity.class.id}&caScoreId=${score.id}`;

    events.push({
      schoolId: input.schoolId,
      parentId: score.student.parentId,
      studentId: score.student.id,
      teacherId: activity.teacher.id,
      type: "ASSESSMENT" as const,
      title: `${activity.subject.name} CA update`,
      body: eventBody,
      href,
      payload: {
        studentName: `${score.student.name} ${score.student.surname}`,
        subjectName: activity.subject.name,
        teacherName,
        activityTitle: activity.title,
        rawScore,
        rawMaxScore,
        bucketName: activity.bucket.name,
        bucketMark: Number(formatMark(normalized)),
        bucketAllocation: Number(activity.bucket.allocationMarks),
        currentCA: Number(formatMark(progress.earnedMarks)),
        caWeight: progress.classworkWeight,
      },
      sourceModel: "CAActivityScore",
      sourceId: String(score.id),
      sourceKey: `ca-activity-score:${score.id}`,
      occurredAt: new Date(),
    });
  }

  await Promise.all(
    events.map((event) =>
      prisma.parentActivityEvent.upsert({
        where: {
          schoolId_parentId_sourceKey: {
            schoolId: event.schoolId,
            parentId: event.parentId,
            sourceKey: event.sourceKey,
          },
        },
        create: event,
        update: {
          title: event.title,
          body: event.body,
          href: event.href,
          payload: event.payload,
          sourceId: event.sourceId,
          occurredAt: event.occurredAt,
          teacherId: event.teacherId,
          studentId: event.studentId,
        },
      }),
    ),
  );

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
