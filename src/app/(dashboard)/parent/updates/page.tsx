import Link from "next/link";
import {
  ArrowLeft,
  Award,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Megaphone,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import prisma from "@/src/lib/prisma";
import { requirePageSession } from "@/src/lib/authz";
import { getParentDashboardData } from "@/src/lib/services/parent-dashboard";
import { getParentNotificationPreference } from "@/src/lib/services/parent-notification-preferences";
import type { ParentNotificationType } from "@/src/generated/prisma";
import ParentNotificationPreferenceForm from "@/src/components/ParentNotificationPreferenceForm";
import { getSchoolBranding } from "@/src/lib/services/school-branding";
import { formatGHS, PAYMENT_METHOD_LABELS } from "@/src/lib/constants/finance";

export const dynamic = "force-dynamic";

type UpdatesPageProps = {
  searchParams: Promise<{ date?: string }>;
};

const typeMeta: Record<ParentNotificationType, { label: string; icon: React.ReactNode; tone: string }> = {
  DAILY_SUMMARY: {
    label: "Daily Summary",
    icon: <BellRing size={16} />,
    tone: "bg-sky-50 text-sky-700 border-sky-100",
  },
  ATTENDANCE: {
    label: "Attendance",
    icon: <CheckCircle2 size={16} />,
    tone: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  ASSESSMENT: {
    label: "Academics",
    icon: <Award size={16} />,
    tone: "bg-blue-50 text-blue-700 border-blue-100",
  },
  ASSIGNMENT: {
    label: "Homework",
    icon: <ClipboardList size={16} />,
    tone: "bg-violet-50 text-violet-700 border-violet-100",
  },
  ANNOUNCEMENT: {
    label: "Notices",
    icon: <Megaphone size={16} />,
    tone: "bg-slate-50 text-slate-700 border-slate-100",
  },
  BILL: {
    label: "Fees",
    icon: <WalletCards size={16} />,
    tone: "bg-amber-50 text-amber-700 border-amber-100",
  },
  PAYMENT: {
    label: "Payments",
    icon: <ReceiptText size={16} />,
    tone: "bg-green-50 text-green-700 border-green-100",
  },
};

function dayWindow(dateText?: string) {
  const parsed = dateText ? new Date(dateText) : new Date();
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const start = new Date(safeDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function dateHref(date: Date) {
  return `/parent/updates?date=${date.toISOString().slice(0, 10)}`;
}

function eventDedupeKey(event: {
  type: ParentNotificationType;
  body: string;
  sourceModel: string;
  sourceId: string;
  sourceKey?: string;
}) {
  return event.sourceKey || `${event.sourceModel}:${event.sourceId}` || `${event.type}:${event.body}`;
}

function dedupeEvents<T extends {
  type: ParentNotificationType;
  body: string;
  sourceModel: string;
  sourceId: string;
  sourceKey?: string;
}>(events: T[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = eventDedupeKey(event);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatDateTime(date: Date) {
  return date.toLocaleString("en-GH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("en-GH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function toInt(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function buildAttendanceEventBodies(
  schoolId: string,
  events: Array<{
    id: string;
    type: ParentNotificationType;
    body: string;
    sourceModel: string;
    sourceId: string;
  }>,
) {
  const attendanceIds = events
    .filter((event) => event.type === "ATTENDANCE" && event.sourceModel === "Attendance")
    .map((event) => toInt(event.sourceId))
    .filter((id): id is number => id !== null);

  if (attendanceIds.length === 0) return new Map<string, string>();

  const records = await prisma.attendance.findMany({
    where: { schoolId, id: { in: attendanceIds } },
    include: {
      student: { select: { name: true, surname: true } },
      lesson: {
        include: {
          subject: { select: { name: true } },
          teacher: { select: { name: true, surname: true } },
        },
      },
    },
  });

  const recordById = new Map(records.map((record) => [record.id, record]));
  const bodies = new Map<string, string>();

  for (const event of events) {
    const id = toInt(event.sourceId);
    if (!id) continue;

    const record = recordById.get(id);
    if (!record) continue;

    const statusLabel = record.status.charAt(0) + record.status.slice(1).toLowerCase();
    const teacherName = `${record.lesson.teacher.name} ${record.lesson.teacher.surname}`;
    const note = record.note ?? (record.status === "ABSENT" ? "No reason provided yet." : null);

    bodies.set(event.id, [
      `Student: ${record.student.name} ${record.student.surname}`,
      `Status: ${statusLabel}`,
      `Subject: ${record.lesson.subject.name}`,
      `Teacher: ${teacherName}`,
      record.arrivalTime ? `Arrival time: ${record.arrivalTime}` : null,
      note ? `Note: ${note}` : null,
    ].filter(Boolean).join("\n"));
  }

  return bodies;
}

function buildAttendanceUpdateGroups(
  events: Array<{
    id: string;
    type: ParentNotificationType;
    body: string;
    href: string | null;
    occurredAt: Date;
    sourceModel: string;
    sourceId: string;
    studentId: string | null;
    student: { name: string; surname: string } | null;
  }>,
  bodies: Map<string, string>,
) {
  const attendanceEvents = dedupeEvents(events.filter((event) => event.type === "ATTENDANCE"));
  const grouped = new Map<string, typeof attendanceEvents>();

  for (const event of attendanceEvents) {
    const key = event.studentId ?? event.id;
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }

  return Array.from(grouped.entries()).map(([key, groupEvents]) => {
    const firstEvent = groupEvents[0];
    const studentName = firstEvent.student
      ? `${firstEvent.student.name} ${firstEvent.student.surname}`
      : "Your child";
    const bodyLines = groupEvents
      .map((event) => bodies.get(event.id) ?? "")
      .filter(Boolean);
    const joinedBody = bodyLines.join("\n\n");
    const lowerBody = joinedBody.toLowerCase();
    const absentCount = (lowerBody.match(/status: absent/g) ?? []).length;
    const lateCount = (lowerBody.match(/status: late/g) ?? []).length;
    const excusedCount = (lowerBody.match(/status: excused/g) ?? []).length;
    const presentCount = (lowerBody.match(/status: present/g) ?? []).length;
    const headline = absentCount > 0
      ? "Attendance needs attention"
      : lateCount > 0
        ? "Late attendance recorded"
        : excusedCount > 0
          ? "Excused attendance recorded"
          : "Attendance marked";
    const lessonLabel = groupEvents.length === 1 ? "lesson" : "lessons";

    return {
      key,
      title: `${studentName}: ${headline}`,
      body: [
        `Marked lessons: ${groupEvents.length} ${lessonLabel}`,
        `Present: ${presentCount}. Late: ${lateCount}. Absent: ${absentCount}. Excused: ${excusedCount}.`,
        ...bodyLines.slice(0, 4).map((line) => line
          .split("\n")
          .filter((part) => !part.startsWith("Student:"))
          .join("\n")),
      ].filter(Boolean).join("\n"),
      href: firstEvent.href,
      occurredAt: firstEvent.occurredAt,
      studentName,
    };
  });
}

async function buildFinanceEventBodies(
  schoolId: string,
  events: Array<{
    id: string;
    type: ParentNotificationType;
    body: string;
    sourceModel: string;
    sourceId: string;
  }>,
) {
  const financeEvents = events.filter((event) => event.type === "BILL" || event.type === "PAYMENT");
  const billIds = financeEvents
    .filter((event) => event.sourceModel === "StudentBill")
    .map((event) => toInt(event.sourceId))
    .filter((id): id is number => id !== null);
  const paymentIds = financeEvents
    .filter((event) => event.sourceModel === "Payment" || event.sourceModel === "PaymentReversal")
    .map((event) => toInt(event.sourceId))
    .filter((id): id is number => id !== null);

  const [bills, payments] = await Promise.all([
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
                id: true,
                totalAmount: true,
                amountPaid: true,
                balance: true,
                status: true,
                feeStructure: { select: { title: true } },
                student: { select: { name: true, surname: true } },
              },
            },
          },
        })
      : [],
  ]);

  const billById = new Map(bills.map((bill) => [bill.id, bill]));
  const paymentById = new Map(payments.map((payment) => [payment.id, payment]));
  const bodies = new Map<string, string>();

  for (const event of financeEvents) {
    const id = toInt(event.sourceId);
    if (event.sourceModel === "StudentBill" && id) {
      const bill = billById.get(id);
      if (bill) {
        bodies.set(event.id, [
          `Bill: ${bill.feeStructure.title}`,
          `Student: ${bill.student.name} ${bill.student.surname}`,
          `Total billed: ${formatGHS(bill.totalAmount)}`,
          `Paid so far: ${formatGHS(bill.amountPaid)}`,
          `Current balance: ${formatGHS(bill.balance)}`,
          `Status: ${bill.status}`,
          bill.dueDate
            ? `Due date: ${bill.dueDate.toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" })}`
            : "Due date: Not set",
        ].join("\n"));
      }
    }

    if ((event.sourceModel === "Payment" || event.sourceModel === "PaymentReversal") && id) {
      const payment = paymentById.get(id);
      if (payment) {
        const statusLine = payment.status === "REVERSED"
          ? `Status: Reversed${payment.reversal?.reason ? ` (${payment.reversal.reason})` : ""}`
          : `Status: ${payment.status}`;
        bodies.set(event.id, [
          `Bill: ${payment.studentBill.feeStructure.title}`,
          `Student: ${payment.studentBill.student.name} ${payment.studentBill.student.surname}`,
          `Receipt: ${payment.receiptNumber}`,
          `Amount paid: ${formatGHS(payment.amount)}`,
          `Method: ${PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod}`,
          `Total billed: ${formatGHS(payment.studentBill.totalAmount)}`,
          `Paid so far: ${formatGHS(payment.studentBill.amountPaid)}`,
          `Current balance: ${formatGHS(payment.studentBill.balance)}`,
          statusLine,
        ].join("\n"));
      }
    }
  }

  return bodies;
}

const ParentUpdatesPage = async ({ searchParams }: UpdatesPageProps) => {
  const { userId, schoolId } = await requirePageSession(["parent"]);
  const params = await searchParams;

  // Keeps source records and daily summaries fresh even when this page is opened directly.
  await getParentDashboardData(userId, schoolId);

  const { start, end } = dayWindow(params.date);
  const previousDay = new Date(start);
  previousDay.setDate(previousDay.getDate() - 1);
  const nextDay = new Date(start);
  nextDay.setDate(nextDay.getDate() + 1);
  const selectedIsToday = isSameDay(start, new Date());

  const [events, parent, notificationPreference, branding] = await Promise.all([
    prisma.parentActivityEvent.findMany({
      where: {
        schoolId,
        parentId: userId,
        occurredAt: { gte: start, lt: end },
      },
      include: {
        student: { select: { name: true, surname: true } },
        teacher: { select: { name: true, surname: true, phone: true, email: true } },
      },
      orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.parent.findFirst({
      where: { id: userId, schoolId },
      select: {
        email: true,
        phone: true,
      },
    }),
    getParentNotificationPreference({ parentId: userId }),
    getSchoolBranding(schoolId),
  ]);

  const visibleEvents = dedupeEvents(events);
  const [attendanceEventBodies, financeEventBodies] = await Promise.all([
    buildAttendanceEventBodies(schoolId, visibleEvents),
    buildFinanceEventBodies(schoolId, visibleEvents),
  ]);
  const enrichedEventBodies = new Map([...attendanceEventBodies, ...financeEventBodies]);
  const attendanceUpdateGroups = buildAttendanceUpdateGroups(visibleEvents, attendanceEventBodies);
  const academicEventsByDay = visibleEvents
    .filter((event) => event.type === "ASSESSMENT")
    .reduce<Record<string, typeof visibleEvents>>((acc, event) => {
      const key = event.occurredAt.toISOString().slice(0, 10);
      acc[key] = [...(acc[key] ?? []), event];
      return acc;
    }, {});

  const grouped = visibleEvents.reduce<Record<ParentNotificationType, typeof visibleEvents>>((acc, event) => {
    const groupType = event.type === "PAYMENT" ? "BILL" : event.type;
    acc[groupType] = [...(acc[groupType] ?? []), event];
    return acc;
  }, {} as Record<ParentNotificationType, typeof visibleEvents>);

  const orderedTypes: ParentNotificationType[] = [
    "ATTENDANCE",
    "ASSESSMENT",
    "ASSIGNMENT",
    "BILL",
    "ANNOUNCEMENT",
  ];

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/parent" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500 hover:text-slate-900">
            <ArrowLeft size={14} />
            Parent dashboard
          </Link>
          <h1 className="mt-3 text-2xl font-black text-gray-900">{branding.displayName} Daily Updates</h1>
          <p className="mt-1 text-sm font-semibold text-gray-400">{formatDate(start)}</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex items-center gap-2">
            <Link href={dateHref(previousDay)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-600">
              Previous day
            </Link>
            <Link href="/parent/updates" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-600">
              Today
            </Link>
            <Link href={dateHref(nextDay)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-600">
              Next day
            </Link>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sky-700">
            <p className="text-2xl font-black">{visibleEvents.length}</p>
            <p className="text-[10px] font-black uppercase tracking-widest">
              {selectedIsToday ? "records today" : "records this day"}
            </p>
          </div>
        </div>
      </div>

      <ParentNotificationPreferenceForm
        contactEmail={parent?.email}
        contactPhone={parent?.phone}
        preference={notificationPreference}
      />

      {visibleEvents.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center shadow-sm">
          <CalendarDays className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm font-black text-gray-500">
            No activity was recorded for {selectedIsToday ? "today" : formatDayLabel(start)}.
          </p>
          <p className="mt-1 text-xs font-semibold text-gray-400">
            Attendance, CA scores, homework, fees, payments, and notices will appear here after the school records them.
          </p>
        </section>
      ) : (
        <div className="space-y-4">
          {orderedTypes
            .filter((type) => grouped[type]?.length)
            .map((type) => {
              const meta = typeMeta[type];
              return (
                <section key={type} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                  <div className="border-b border-gray-100 px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-xl border p-2 ${meta.tone}`}>{meta.icon}</div>
                        <div>
                          <h2 className="text-sm font-black text-gray-900">{meta.label}</h2>
                          <p className="text-xs font-semibold text-gray-400">
                            {grouped[type].length} update{grouped[type].length === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {type === "ATTENDANCE"
                      ? attendanceUpdateGroups.map((group) => (
                          <div key={group.key} className="px-5 py-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="text-sm font-black text-gray-900">{group.title}</p>
                                <p className="mt-1 whitespace-pre-line text-sm font-medium leading-relaxed text-gray-500">{group.body}</p>
                                <p className="mt-2 text-xs font-black text-gray-400">{formatDateTime(group.occurredAt)}</p>
                                <p className="mt-2 text-xs font-bold text-gray-400">Child: {group.studentName}</p>
                              </div>
                              {group.href && (
                                <Link href={group.href} className="shrink-0 rounded-xl bg-gray-900 px-3 py-2 text-center text-xs font-black text-white">
                                  Open
                                </Link>
                              )}
                            </div>
                          </div>
                        ))
                      : type === "ASSESSMENT"
                      ? Object.entries(academicEventsByDay)
                        .sort(([a], [b]) => b.localeCompare(a))
                        .map(([day, dayEvents]) => (
                          <div key={day} className="divide-y divide-gray-50">
                            <div className="bg-blue-50/60 px-5 py-2 text-[11px] font-black uppercase tracking-widest text-blue-700">
                              {formatDayLabel(new Date(day))}
                            </div>
                            {dayEvents.map((event) => (
                              <div key={event.id} className="px-5 py-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0">
                                    <p className="text-sm font-black text-gray-900">{event.title}</p>
                                    <p className="mt-1 whitespace-pre-line text-sm font-medium leading-relaxed text-gray-500">{event.body}</p>
                                    <p className="mt-2 text-xs font-black text-blue-500">{formatDateTime(event.occurredAt)}</p>
                                    {event.student && (
                                      <p className="mt-2 text-xs font-bold text-gray-400">
                                        Child: {event.student.name} {event.student.surname}
                                      </p>
                                    )}
                                    {event.teacher && (
                                      <p className="mt-1 text-xs font-bold text-gray-400">
                                        Teacher: {event.teacher.name} {event.teacher.surname}
                                        {event.teacher.phone ? ` - ${event.teacher.phone}` : ""}
                                        {!event.teacher.phone && event.teacher.email ? ` - ${event.teacher.email}` : ""}
                                      </p>
                                    )}
                                  </div>
                                  {event.href && (
                                    <Link href={event.href} className="shrink-0 rounded-xl bg-gray-900 px-3 py-2 text-center text-xs font-black text-white">
                                      Open
                                    </Link>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))
                      : grouped[type].map((event) => (
                      <div key={event.id} className="px-5 py-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-gray-900">{event.title}</p>
                            <p className="mt-1 whitespace-pre-line text-sm font-medium leading-relaxed text-gray-500">
                              {enrichedEventBodies.get(event.id) ?? event.body}
                            </p>
                            <p className="mt-2 text-xs font-black text-gray-400">{formatDateTime(event.occurredAt)}</p>
                            {event.student && (
                              <p className="mt-2 text-xs font-bold text-gray-400">
                                Child: {event.student.name} {event.student.surname}
                              </p>
                            )}
                            {event.teacher && (
                              <p className="mt-1 text-xs font-bold text-gray-400">
                                Teacher: {event.teacher.name} {event.teacher.surname}
                                {event.teacher.phone ? ` - ${event.teacher.phone}` : ""}
                                {!event.teacher.phone && event.teacher.email ? ` - ${event.teacher.email}` : ""}
                              </p>
                            )}
                          </div>
                          {event.href && (
                            <Link href={event.href} className="shrink-0 rounded-xl bg-gray-900 px-3 py-2 text-center text-xs font-black text-white">
                              Open
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default ParentUpdatesPage;
