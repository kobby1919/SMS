import prisma from "@/src/lib/prisma";
import type {
  ParentNotificationPriority,
  ParentNotificationType,
} from "@/src/generated/prisma";
import { rebuildParentDailySummary } from "@/src/lib/services/parent-daily-summary";

export type ParentNotificationFeedItem = {
  id: string;
  childId?: string;
  childName?: string;
  type: ParentNotificationType;
  title: string;
  description: string;
  occurredAt: Date;
  tone: "green" | "blue" | "amber" | "rose" | "violet" | "slate";
  payload?: unknown;
  href?: string;
  readAt?: Date | null;
};

type ChildRef = {
  id: string;
  name: string;
  surname: string;
  classId: number;
};

type SourceRecord = {
  sourceKey: string;
  sourceModel: string;
  sourceId: string;
  type: ParentNotificationType;
  priority?: ParentNotificationPriority;
  title: string;
  body: string;
  href?: string;
  occurredAt: Date;
  studentId?: string;
};

function notificationTone(type: ParentNotificationType, priority: ParentNotificationPriority) {
  if (priority === "HIGH") return "rose";
  if (type === "DAILY_SUMMARY") return "blue";
  if (type === "PAYMENT") return "green";
  if (type === "BILL") return "amber";
  if (type === "ANNOUNCEMENT") return "violet";
  if (type === "ASSIGNMENT") return "blue";
  if (type === "ASSESSMENT") return "green";
  return "slate";
}

function uniqueFeedNotifications<T extends {
  type: ParentNotificationType;
  body: string;
  sourceModel: string;
  sourceId: string;
}>(notifications: T[]) {
  const seen = new Set<string>();
  return notifications.filter((notification) => {
    const key =
      notification.sourceModel === "ContinuousAssessment" ||
      notification.sourceModel === "CAActivityScore"
        ? `${notification.sourceModel}:${notification.sourceId}`
        : `${notification.type}:${notification.body}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function syncParentNotificationsFromSources({
  schoolId,
  parentId,
  children,
  attendance,
  assignments,
  announcements,
  bills,
  payments,
}: {
  schoolId: string;
  parentId: string;
  children: ChildRef[];
  attendance: Array<{
    id: number;
    studentId: string;
    status: string;
    note: string | null;
    date: Date;
    lesson: { subject: { name: string } };
  }>;
  assessments: Array<{
    id: number;
    studentId: string;
    subjectId: number;
    classId: number;
    term: string;
    academicYear: string;
    totalScore: number;
    classworkScore: number;
    examScore: number;
    grade: string;
    remarks: string;
    updatedAt: Date;
    subject: { name: string };
  }>;
  assignments: Array<{
    id: number;
    title: string;
    dueDate: Date;
    lesson: {
      classId: number;
      subject: { name: string };
    };
  }>;
  announcements: Array<{
    id: number;
    title: string;
    description: string;
    date: Date;
    classId: number | null;
  }>;
  bills: Array<{
    id: number;
    studentId: string;
    status: string;
    balance: unknown;
    updatedAt: Date;
    feeStructure: { title: string };
  }>;
  payments: Array<{
    id: number;
    amount: unknown;
    receiptNumber: string;
    paymentDate: Date;
    studentBill: {
      studentId: string;
      feeStructure: { title: string };
    };
  }>;
}) {
  const childById = new Map(children.map((child) => [child.id, child]));
  const candidates: SourceRecord[] = [
    ...attendance.map((record) => {
      const child = childById.get(record.studentId);
      const status = record.status.toLowerCase();
      return {
        sourceKey: `attendance:${record.id}`,
        sourceModel: "Attendance",
        sourceId: String(record.id),
        type: "ATTENDANCE" as const,
        priority: record.status === "ABSENT" ? ("HIGH" as const) : ("NORMAL" as const),
        title: `${child?.name ?? "Your child"} was marked ${status}`,
        body: `${record.lesson.subject.name}${record.note ? ` - ${record.note}` : ""}`,
        href: "/list/attendance",
        occurredAt: record.date,
        studentId: record.studentId,
      };
    }),
    ...assignments.flatMap((assignment) =>
      children
        .filter((child) => child.classId === assignment.lesson.classId)
        .map((child) => ({
          sourceKey: `assignment:${assignment.id}:${child.id}`,
          sourceModel: "Assignment",
          sourceId: String(assignment.id),
          type: "ASSIGNMENT" as const,
          priority: assignment.dueDate < new Date() ? ("HIGH" as const) : ("NORMAL" as const),
          title: `${assignment.lesson.subject.name} assignment due`,
          body: `${assignment.title} is due ${assignment.dueDate.toLocaleDateString("en-GH", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}.`,
          href: "/list/assignments",
          occurredAt: assignment.dueDate,
          studentId: child.id,
        })),
    ),
    ...announcements.flatMap((announcement) =>
      children
        .filter((child) => announcement.classId === null || announcement.classId === child.classId)
        .map((child) => ({
          sourceKey: `announcement:${announcement.id}:${child.id}`,
          sourceModel: "Announcement",
          sourceId: String(announcement.id),
          type: "ANNOUNCEMENT" as const,
          priority: "NORMAL" as const,
          title: announcement.title,
          body: announcement.description,
          href: "/list/announcements",
          occurredAt: announcement.date,
          studentId: child.id,
        })),
    ),
    ...bills.map((bill) => ({
      sourceKey: `bill:${bill.id}:${bill.status}:${Number(bill.balance).toFixed(2)}`,
      sourceModel: "StudentBill",
      sourceId: String(bill.id),
      type: "BILL" as const,
      priority: Number(bill.balance) > 0 ? ("NORMAL" as const) : ("LOW" as const),
      title: `${bill.feeStructure.title} fee status`,
      body: `Balance: GHS ${Number(bill.balance).toFixed(2)}. Status: ${bill.status}.`,
      href: "/list/finance/bills",
      occurredAt: bill.updatedAt,
      studentId: bill.studentId,
    })),
    ...payments.map((payment) => ({
      sourceKey: `payment:${payment.id}`,
      sourceModel: "Payment",
      sourceId: String(payment.id),
      type: "PAYMENT" as const,
      priority: "LOW" as const,
      title: `Payment received: GHS ${Number(payment.amount).toFixed(2)}`,
      body: `${payment.studentBill.feeStructure.title} - receipt ${payment.receiptNumber}`,
      href: `/api/finance/receipt?paymentId=${payment.id}`,
      occurredAt: payment.paymentDate,
      studentId: payment.studentBill.studentId,
    })),
  ];

  if (candidates.length > 0) {
    await prisma.parentActivityEvent.createMany({
      data: candidates.map((candidate) => ({
        schoolId,
        parentId,
        studentId: candidate.studentId,
        type: candidate.type,
        title: candidate.title,
        body: candidate.body,
        href: candidate.href,
        payload: { priority: candidate.priority ?? "NORMAL" },
        sourceModel: candidate.sourceModel,
        sourceId: candidate.sourceId,
        sourceKey: candidate.sourceKey,
        occurredAt: candidate.occurredAt,
      })),
      skipDuplicates: true,
    });

    const dailySummaryDates = [
      ...new Map(
        candidates.map((candidate) => {
          const day = new Date(candidate.occurredAt);
          day.setHours(0, 0, 0, 0);
          return [day.toISOString().slice(0, 10), day] as const;
        }),
      ).values(),
    ];
    await Promise.all(
      dailySummaryDates.map((date) =>
        rebuildParentDailySummary({
          schoolId,
          parentId,
          date,
        }),
      ),
    );

    await prisma.parentNotification.createMany({
      data: candidates.map((candidate) => ({
        schoolId,
        parentId,
        studentId: candidate.studentId,
        type: candidate.type,
        priority: candidate.priority ?? "NORMAL",
        title: candidate.title,
        body: candidate.body,
        href: candidate.href,
        sourceModel: candidate.sourceModel,
        sourceId: candidate.sourceId,
        sourceKey: candidate.sourceKey,
        occurredAt: candidate.occurredAt,
      })),
      skipDuplicates: true,
    });
  }

  const notifications = await prisma.parentNotification.findMany({
    where: { schoolId, parentId },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: 30,
  });

  return uniqueFeedNotifications(notifications).map((notification): ParentNotificationFeedItem => {
    const child = notification.studentId ? childById.get(notification.studentId) : undefined;
    return {
      id: notification.id,
      childId: notification.studentId ?? undefined,
      childName: child ? `${child.name} ${child.surname}` : undefined,
      type: notification.type,
      title: notification.title,
      description: notification.body,
      occurredAt: notification.occurredAt,
      tone: notificationTone(notification.type, notification.priority),
      payload: notification.payload ?? undefined,
      href: notification.href ?? undefined,
      readAt: notification.readAt,
    };
  });
}
