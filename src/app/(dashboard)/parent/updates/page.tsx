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

export const dynamic = "force-dynamic";

type UpdatesPageProps = {
  searchParams: { date?: string };
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
}) {
  return event.sourceModel === "CAActivityScore" || event.sourceModel === "ContinuousAssessment"
    ? `${event.sourceModel}:${event.sourceId}`
    : `${event.type}:${event.body}`;
}

function dedupeEvents<T extends {
  type: ParentNotificationType;
  body: string;
  sourceModel: string;
  sourceId: string;
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

const ParentUpdatesPage = async ({ searchParams }: UpdatesPageProps) => {
  const { userId, schoolId } = await requirePageSession(["parent"]);

  // Keeps source records and daily summaries fresh even when this page is opened directly.
  await getParentDashboardData(userId, schoolId);

  const { start, end } = dayWindow(searchParams.date);
  const previousDay = new Date(start);
  previousDay.setDate(previousDay.getDate() - 1);
  const nextDay = new Date(start);
  nextDay.setDate(nextDay.getDate() + 1);

  const [events, summary, parent, notificationPreference, branding] = await Promise.all([
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
    prisma.parentNotification.findFirst({
      where: {
        schoolId,
        parentId: userId,
        type: "DAILY_SUMMARY",
        occurredAt: { gte: start, lt: end },
      },
      orderBy: { occurredAt: "desc" },
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
  const summaryCounts = summary?.payload && typeof summary.payload === "object" && "counts" in summary.payload
    ? summary.payload.counts as Record<string, number>
    : null;
  const academicEventsByDay = visibleEvents
    .filter((event) => event.type === "ASSESSMENT")
    .reduce<Record<string, typeof visibleEvents>>((acc, event) => {
      const key = event.occurredAt.toISOString().slice(0, 10);
      acc[key] = [...(acc[key] ?? []), event];
      return acc;
    }, {});

  const grouped = visibleEvents.reduce<Record<ParentNotificationType, typeof visibleEvents>>((acc, event) => {
    acc[event.type] = [...(acc[event.type] ?? []), event];
    return acc;
  }, {} as Record<ParentNotificationType, typeof visibleEvents>);

  const orderedTypes: ParentNotificationType[] = [
    "ATTENDANCE",
    "ASSESSMENT",
    "ASSIGNMENT",
    "BILL",
    "PAYMENT",
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
            <p className="text-[10px] font-black uppercase tracking-widest">records today</p>
          </div>
        </div>
      </div>

      <ParentNotificationPreferenceForm
        contactEmail={parent?.email}
        contactPhone={parent?.phone}
        preference={notificationPreference}
      />

      <section className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-sky-400/10 p-2 text-sky-200">
            <BellRing size={18} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-black">Summary parents receive</p>
            {summaryCounts ? (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  ["Attendance", summaryCounts.attendance ?? 0],
                  ["Academics", summaryCounts.academics ?? 0],
                  ["Homework", summaryCounts.homework ?? 0],
                  ["Fees", summaryCounts.finance ?? 0],
                  ["Notices", summaryCounts.notices ?? 0],
                ].map(([label, count]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                    <p className="text-lg font-black">{count}</p>
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm font-medium leading-relaxed text-slate-300">
                No daily summary has been generated for this date yet.
              </p>
            )}
            {summary?.body && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="whitespace-pre-line text-sm font-medium leading-relaxed text-slate-300">{summary.body}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {visibleEvents.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center shadow-sm">
          <CalendarDays className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm font-black text-gray-500">No activity was recorded for this day.</p>
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
                    {type === "ASSESSMENT"
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
                                    <p className="mt-1 text-sm font-medium leading-relaxed text-gray-500">{event.body}</p>
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
                            <p className="mt-1 text-sm font-medium leading-relaxed text-gray-500">{event.body}</p>
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
