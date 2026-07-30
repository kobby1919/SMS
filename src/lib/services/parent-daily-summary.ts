import prisma from "@/src/lib/prisma";
import { getSubjectCAProgress } from "@/src/lib/services/ca-activity";
import { getSchoolBranding } from "@/src/lib/services/school-branding";
import { DISCOUNT_TYPE_LABELS, formatGHS, PAYMENT_METHOD_LABELS } from "@/src/lib/constants/finance";

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
  sourceModel: string;
  sourceId: string;
};

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
        return `Fees: ${bill.feeStructure.title} for ${bill.student.name} ${bill.student.surname}. Total ${formatGHS(bill.totalAmount)}, paid ${formatGHS(bill.amountPaid)}, balance ${formatGHS(bill.balance)}.${dueText}`;
      }
    }

    if ((event.sourceModel === "Payment" || event.sourceModel === "PaymentReversal") && id) {
      const payment = paymentById.get(id);
      if (payment) {
        if (payment.status === "REVERSED") {
          return `Fees: Payment ${payment.receiptNumber} for ${payment.studentBill.student.name} ${payment.studentBill.student.surname} was reversed. Amount ${formatGHS(payment.amount)}. Reason: ${payment.reversal?.reason ?? "Not stated"}. Current balance ${formatGHS(payment.studentBill.balance)}.`;
        }
        const receiptText = payment.status === "CONFIRMED" ? ` Receipt ${payment.receiptNumber}.` : "";
        return `Fees: ${payment.status.toLowerCase()} payment for ${payment.studentBill.student.name} ${payment.studentBill.student.surname}. Amount ${formatGHS(payment.amount)} by ${PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod}.${receiptText} Current balance ${formatGHS(payment.studentBill.balance)}.`;
      }
    }

    if (event.sourceModel === "Discount" && id) {
      const discount = discountById.get(id);
      if (discount) {
        const discountValue = discount.amount
          ? formatGHS(discount.amount)
          : `${Number(discount.percentage ?? 0)}%`;
        return `Fees: ${discount.status === "REMOVED" ? "Removed" : "Applied"} ${DISCOUNT_TYPE_LABELS[discount.type] ?? discount.type} for ${discount.studentBill.student.name} ${discount.studentBill.student.surname}. Value ${discountValue}. Balance ${formatGHS(discount.studentBill.balance)}. ${discount.status === "REMOVED" ? discount.removeReason ?? "" : discount.description}`;
      }
    }

    if (event.sourceModel === "FinanceQuery" && id) {
      const query = queryById.get(id);
      if (query) {
        return `Fees: Finance query for ${query.student.name} ${query.student.surname} is ${query.status.toLowerCase().replace("_", " ")}. Bill: ${query.studentBill.feeStructure.title}. Balance ${formatGHS(query.studentBill.balance)}.`;
      }
    }

    return `Fees: ${event.body}`;
  });
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

export async function rebuildParentDailySummary(input: {
  schoolId: string;
  parentId: string;
  date: Date;
}) {
  const { start, end } = dayWindow(input.date);
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
    await prisma.parentNotification.deleteMany({
      where: {
        schoolId: input.schoolId,
        parentId: input.parentId,
        type: "DAILY_SUMMARY",
        sourceKey: `daily-summary:${input.parentId}:${dateKey(start)}`,
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
  const academicLines = uniqueEvents
    .filter((event) => event.type === "ASSESSMENT")
    .slice(0, 4)
    .map((event) => event.body);
  const financeLines = await buildFinanceSummaryLines(input.schoolId, uniqueEvents);
  const homeworkLines = uniqueEvents
    .filter((event) => event.type === "ASSIGNMENT")
    .slice(0, 3)
    .map((event) => event.body);
  const noticeLines = uniqueEvents
    .filter((event) => event.type === "ANNOUNCEMENT")
    .slice(0, 3)
    .map((event) => event.body);
  const attendanceLines = uniqueEvents
    .filter((event) => event.type === "ATTENDANCE")
    .slice(0, 3)
    .map((event) => event.body);
  const summaryBits = [
    `${uniqueEvents.length} school update${uniqueEvents.length === 1 ? "" : "s"}`,
    counts.academics ? `${counts.academics} academic` : null,
    counts.homework ? `${counts.homework} homework` : null,
    counts.notices ? `${counts.notices} notice` : null,
    counts.finance ? `${counts.finance} finance` : null,
  ].filter(Boolean);
  const branding = await getSchoolBranding(input.schoolId);
  const title = `${branding.displayName} Daily School Update`;
  const bodyLines = [
    ...buildSection("Finance", financeLines),
    ...buildSection("Academics", academicLines),
    ...buildSection("Attendance", attendanceLines),
    ...buildSection("Homework", homeworkLines),
    ...buildSection("Notices", noticeLines),
  ];
  const body = bodyLines.length > 0
    ? bodyLines.join("\n")
    : summaryBits.join(" - ");

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
      title,
      body,
      payload: { counts, eventIds: uniqueEvents.map((event) => event.id) },
      sourceModel: "ParentDailySummary",
      sourceId: dateKey(start),
      sourceKey: `daily-summary:${input.parentId}:${dateKey(start)}`,
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
      `${activity.bucket.name} CA mark: ${normalized}/${Number(activity.bucket.allocationMarks)}`,
      `Current ${activity.subject.name} CA: ${progress.earnedMarks}/${progress.classworkWeight}`,
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
        bucketMark: normalized,
        bucketAllocation: Number(activity.bucket.allocationMarks),
        currentCA: progress.earnedMarks,
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
