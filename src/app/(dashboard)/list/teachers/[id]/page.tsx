// src/app/(dashboard)/list/teachers/[id]/page.tsx

import prisma from "@/src/lib/prisma";
import { notFound } from "next/navigation";
import { requirePageSession } from "@/src/lib/authz";
import FormModal from "@/src/components/FormModal";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Mail,
  Phone,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { listLiveTimetableLessons } from "@/src/lib/services/timetable";
import {
  getTeacherReadiness,
  teacherReadinessToneClass,
} from "@/src/lib/services/teacher-readiness";
import { effectiveObligationStatus } from "@/src/lib/queries/teacher-accountability-status";
import type {
  TeacherAccountabilityAuditAction,
  TeacherInviteAuditAction,
  TeacherObligationStatus,
} from "@/src/generated/prisma";

const dayOrder = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

const SingleTeacherPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const { userId, role, schoolId } = await requirePageSession();

  const teacher = await prisma.teacher.findFirst({
    where: { id, schoolId },
    include: {
      subjects: { select: { id: true, name: true } },
      classes: {
        select: {
          id: true,
          name: true,
          _count: { select: { students: true } },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!teacher) notFound();

  if (role !== "admin" && !(role === "teacher" && teacher.id === userId)) {
    notFound();
  }

  const liveLessons = await listLiveTimetableLessons(schoolId, { teacherId: teacher.id });
  const liveLessonIds = liveLessons.map((lesson) => lesson.id);
  const taughtClasses = Array.from(
    new Map(liveLessons.map((lesson) => [lesson.class.id, lesson.class])).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const [
    totalAttendance,
    presentAttendance,
    invite,
    accountabilityObligations,
    openEscalations,
    pendingCorrections,
    recentAccountabilityLogs,
  ] = await Promise.all([
    liveLessonIds.length
      ? prisma.attendance.count({ where: { schoolId, lessonId: { in: liveLessonIds } } })
      : 0,
    liveLessonIds.length
      ? prisma.attendance.count({ where: { schoolId, lessonId: { in: liveLessonIds }, present: true } })
      : 0,
    prisma.teacherInvite.findFirst({
      where: {
        schoolId,
        OR: [
          { acceptedTeacherId: teacher.id },
          ...(teacher.email ? [{ email: teacher.email.toLowerCase() }] : []),
        ],
      },
      include: {
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 8,
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.teacherObligation.findMany({
      where: { schoolId, teacherId: teacher.id },
      select: {
        status: true,
        expectedAt: true,
        completedAt: true,
        metadata: true,
      },
      orderBy: { expectedAt: "desc" },
      take: 1000,
    }),
    prisma.teacherEscalation.findMany({
      where: {
        schoolId,
        teacherId: teacher.id,
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
      },
      include: {
        obligation: {
          select: {
            title: true,
            expectedAt: true,
            metadata: true,
          },
        },
      },
      orderBy: { escalatedAt: "desc" },
      take: 5,
    }),
    prisma.teacherCorrectionRequest.findMany({
      where: {
        schoolId,
        teacherId: teacher.id,
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.teacherAccountabilityAuditLog.findMany({
      where: { schoolId, teacherId: teacher.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const readiness = getTeacherReadiness({
    status: teacher.status,
    name: teacher.name,
    surname: teacher.surname,
    email: teacher.email,
    phone: teacher.phone,
    address: teacher.address,
    subjectCount: teacher.subjects.length,
    publishedLessonCount: liveLessons.length,
    taughtClassCount: taughtClasses.length,
    supervisedClassCount: teacher.classes.length,
    hasPendingInvite: invite?.status === "PENDING" && !invite.acceptedAt && !invite.revokedAt,
  });
  const profileCompletion = readiness.profileCompletion;
  const lifecycle = teacherStatusMeta(teacher.status);
  const joinYear = new Date(teacher.createdAt).getFullYear();
  const attendancePct = totalAttendance > 0 ? Math.round((presentAttendance / totalAttendance) * 100) : 0;
  const groupedLessons = groupLessonsByDay(liveLessons);
  const accountabilitySummary = buildAccountabilitySummary(accountabilityObligations, new Date());
  const reliabilityScore = accountabilitySummary.total > 0
    ? Math.round(((accountabilitySummary.completed + accountabilitySummary.completedLate * 0.7 + accountabilitySummary.pending * 0.4) / accountabilitySummary.total) * 100)
    : null;
  const auditRows = buildTeacherAuditRows({
    inviteLogs: invite?.auditLogs ?? [],
    accountabilityLogs: recentAccountabilityLogs,
  });

  return (
    <div className="flex-1 p-4">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50 px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                <Image
                  src={teacher.img || "/noAvatar.png"}
                  alt={teacher.name}
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-2xl bg-white object-cover ring-1 ring-gray-200"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-black text-gray-900">
                      {teacher.name} {teacher.surname}
                    </h1>
                    <StatusBadge className={lifecycle.className}>{lifecycle.label}</StatusBadge>
                    <StatusBadge className={teacherReadinessToneClass(readiness.tone)}>{readiness.label}</StatusBadge>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-gray-500">
                    Teacher control center for access, setup, timetable duties, accountability, and history.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-gray-600">
                    <InfoPill icon={<Mail size={13} />} label={teacher.email ?? "No email"} />
                    <InfoPill icon={<Phone size={13} />} label={teacher.phone ?? "No phone"} />
                    <InfoPill icon={<Calendar size={13} />} label={`Joined ${joinYear}`} />
                  </div>
                </div>
              </div>
              {role === "admin" && (
                <div className="flex shrink-0 flex-wrap gap-2">
                  <FormModal table="teacher" type="update" data={teacher} />
                  <Link href="/list/subjects" className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100">
                    Manage subjects
                  </Link>
                  <Link href="/list/classes" className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-black text-violet-700 hover:bg-violet-100">
                    Manage classes
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard icon={<ShieldCheck size={17} />} label="Readiness" value={readiness.label} tone={teacherReadinessToneClass(readiness.tone)} />
            <MetricCard icon={<BookOpen size={17} />} label="Published lessons" value={liveLessons.length} tone="bg-amber-50 text-amber-700" />
            <MetricCard icon={<Users size={17} />} label="Teaching classes" value={taughtClasses.length} tone="bg-emerald-50 text-emerald-700" />
            <MetricCard icon={<Clock size={17} />} label="Attendance records" value={totalAttendance > 0 ? `${attendancePct}% present` : "No records"} tone="bg-sky-50 text-sky-700" />
            <MetricCard icon={<ShieldAlert size={17} />} label="Reliability" value={reliabilityScore === null ? "No duties yet" : `${reliabilityScore}%`} tone="bg-rose-50 text-rose-700" />
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.8fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <SectionCard title="1. Teacher Identity" description="The basic staff record Edujay uses everywhere this teacher appears.">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DataTile label="Full name" value={`${teacher.name} ${teacher.surname}`} />
                <DataTile label="Email" value={teacher.email ?? "Not provided"} />
                <DataTile label="Phone" value={teacher.phone ?? "Not provided"} />
                <DataTile label="Username" value={teacher.username} />
                <DataTile label="Staff ID" value={invite?.staffId ?? "Not recorded"} />
                <DataTile label="Employment type" value={invite?.employmentType ?? "Not recorded"} />
                <DataTile label="Teacher type" value={invite ? teacherTypeLabel(invite.teacherType) : classTeacherTypeLabel(teacher.classes.length, liveLessons.length)} />
                <DataTile label="Blood group" value={teacher.bloodType ?? "Not provided"} />
                <DataTile label="Address" value={teacher.address ?? "Not provided"} />
              </div>
            </SectionCard>

            <SectionCard title="4. Subject Capability" description="Subjects this teacher is allowed to teach. The published timetable decides where they actually teach.">
              <PillList
                emptyLabel="No subject capability assigned yet."
                items={teacher.subjects.map((subject) => ({ id: subject.id, label: subject.name }))}
                tone="bg-indigo-50 text-indigo-700"
              />
            </SectionCard>

            <SectionCard title="5. Class Scope" description="Classes this teacher is connected to through the current published timetable.">
              <PillList
                emptyLabel="No published teaching class yet. Publish the timetable after assigning lessons."
                items={taughtClasses.map((cls) => ({ id: cls.id, label: cls.name }))}
                tone="bg-emerald-50 text-emerald-700"
              />
            </SectionCard>

            <SectionCard title="6. Class Teacher Responsibility" description="Classes supervised by this teacher. Class teachers get wider follow-up and report submission responsibility.">
              {teacher.classes.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {teacher.classes.map((cls) => (
                    <Link
                      key={cls.id}
                      href={`/list/classes/${cls.id}/overview`}
                      className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-3 hover:bg-gray-100"
                    >
                      <div>
                        <p className="text-sm font-black text-gray-800">{cls.name}</p>
                        <p className="text-xs font-semibold text-gray-500">{cls._count.students} student{cls._count.students === 1 ? "" : "s"}</p>
                      </div>
                      <ArrowRight size={16} className="text-gray-400" />
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState message="This teacher is not assigned as a class teacher yet." />
              )}
            </SectionCard>

            <SectionCard title="7. Published Timetable Duties" description="Runtime duties come only from the published timetable, not draft lessons.">
              {groupedLessons.length > 0 ? (
                <div className="space-y-3">
                  {groupedLessons.map((group) => (
                    <div key={group.day} className="rounded-xl border border-gray-100 bg-white">
                      <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-gray-500">
                        {formatDay(group.day)}
                      </div>
                      <div className="divide-y divide-gray-100">
                        {group.lessons.map((lesson) => (
                          <div key={lesson.id} className="grid gap-2 px-3 py-3 text-sm sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
                            <p className="font-black text-gray-800">{formatLessonTime(lesson.startTime)} - {formatLessonTime(lesson.endTime)}</p>
                            <p className="font-bold text-gray-700">{lesson.class.name}</p>
                            <p className="font-semibold text-gray-500">{lesson.subject.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No published timetable duties yet. Draft timetable lessons will not appear here." />
              )}
            </SectionCard>
          </div>

          <aside className="flex min-w-0 flex-col gap-4">
            <SectionCard title="2. Access And Login Status" description="Shows whether this teacher account is connected and allowed to operate.">
              <div className="space-y-3">
                <ReadinessLine label="Lifecycle status" value={lifecycle.label} ok={teacher.status === "ACTIVE"} />
                <ReadinessLine label="Invite status" value={invite ? inviteStatusLabel(invite.status, invite.acceptedAt, invite.revokedAt) : "No invite record found"} ok={invite?.status === "ACCEPTED" || teacher.status === "ACTIVE"} />
                <ReadinessLine label="Account link" value={teacherAccountLinkLabel(teacher.id, invite?.acceptedBy ?? null)} ok={Boolean(invite?.acceptedBy) || teacher.id.startsWith("user_")} />
                <ReadinessLine label="Can operate" value={readiness.canOperate ? "Yes" : "No"} ok={readiness.canOperate} />
                {invite?.acceptedAt && <DataTile label="Invite accepted" value={formatDateTime(invite.acceptedAt)} />}
              </div>
            </SectionCard>

            <SectionCard title="3. Readiness Check" description="Admin should fix these before relying on this teacher operationally.">
              <div className="space-y-3">
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full ${profileCompletion.isComplete ? "bg-emerald-500" : "bg-amber-500"}`}
                    style={{ width: `${profileCompletion.completionPercent}%` }}
                  />
                </div>
                <p className="text-sm font-black text-gray-800">Profile: {profileCompletion.completionPercent}% complete</p>
                {[...readiness.blockers, ...readiness.setupWarnings].length > 0 ? (
                  <ul className="space-y-2 text-sm font-semibold text-gray-700">
                    {[...readiness.blockers, ...readiness.setupWarnings].map((item) => (
                      <li key={item} className="rounded-xl bg-amber-50 px-3 py-2 text-amber-800">{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">No readiness blockers.</p>
                )}
              </div>
            </SectionCard>

            <SectionCard title="8. Accountability Summary" description="Recent operating discipline for attendance, CA, homework, and correction requests.">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <DataTile label="Total duties" value={accountabilitySummary.total} />
                <DataTile label="Pending" value={accountabilitySummary.pending} />
                <DataTile label="Completed" value={accountabilitySummary.completed} />
                <DataTile label="Late" value={accountabilitySummary.completedLate} />
                <DataTile label="Missed" value={accountabilitySummary.missed} />
                <DataTile label="Escalated" value={accountabilitySummary.escalated} />
              </div>
              <div className="mt-3 space-y-2">
                {openEscalations.length > 0 ? openEscalations.map((escalation) => (
                  <div key={escalation.id} className="rounded-xl bg-rose-50 p-3 text-sm">
                    <p className="font-black text-rose-800">{escalation.obligation.title}</p>
                    <p className="mt-1 font-semibold text-rose-700">{escalation.reason}</p>
                    <p className="mt-1 text-xs font-bold text-rose-600">Due {formatDateTime(escalation.obligation.expectedAt)}</p>
                  </div>
                )) : (
                  <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">No open escalations.</p>
                )}
                {pendingCorrections.length > 0 && (
                  <div className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">
                    {pendingCorrections.length} pending correction request{pendingCorrections.length === 1 ? "" : "s"} need admin review.
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="9. Audit History" description="Important teacher events kept for accountability.">
              {auditRows.length > 0 ? (
                <div className="space-y-2">
                  {auditRows.map((row) => (
                    <div key={row.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <p className="text-sm font-black text-gray-800">{row.title}</p>
                      <p className="mt-1 text-xs font-semibold text-gray-500">{row.message}</p>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">{formatDateTime(row.createdAt)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No audit history recorded for this teacher yet." />
              )}
            </SectionCard>

            <SectionCard title="10. Admin Actions" description="Controlled actions. Destructive teacher deletion is intentionally not offered.">
              <div className="grid gap-2">
                <ActionLink href="/list/subjects" label="Update subject capability" icon={<Award size={15} />} />
                <ActionLink href="/list/classes" label="Update class teacher responsibility" icon={<UserCheck size={15} />} />
                <ActionLink href="/admin/timetable" label="Publish timetable duties" icon={<Calendar size={15} />} />
                <ActionLink href="/admin/accountability" label="Review accountability" icon={<ShieldAlert size={15} />} />
                <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
                  Suspend, reactivate, and mark-left-school controls belong to Section 15 Admin Controls. This page now shows the correct state and history first.
                </div>
              </div>
            </SectionCard>
          </aside>
        </div>
      </div>
    </div>
  );
};

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h2 className="text-base font-black text-gray-900">{title}</h2>
        <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function MetricCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-base font-black text-gray-900">{value}</p>
        <p className="text-xs font-bold text-gray-400">{label}</p>
      </div>
    </div>
  );
}

function DataTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-gray-50 p-3">
      <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-gray-800">{value}</p>
    </div>
  );
}

function StatusBadge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${className}`}>{children}</span>;
}

function InfoPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-gray-200">
      <span className="shrink-0 text-indigo-500">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  );
}

function PillList({
  items,
  emptyLabel,
  tone,
}: {
  items: { id: number | string; label: string }[];
  emptyLabel: string;
  tone: string;
}) {
  if (items.length === 0) return <EmptyState message={emptyLabel} />;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item.id} className={`rounded-xl px-3 py-1.5 text-xs font-black ${tone}`}>
          {item.label}
        </span>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="rounded-xl bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-500">{message}</p>;
}

function ReadinessLine({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 p-3">
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-gray-400">{label}</p>
        <p className="mt-1 text-sm font-bold text-gray-800">{value}</p>
      </div>
      {ok ? <CheckCircle2 size={18} className="shrink-0 text-emerald-600" /> : <AlertCircle size={18} className="shrink-0 text-amber-600" />}
    </div>
  );
}

function ActionLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-3 text-sm font-black text-gray-700 hover:bg-gray-100">
      <span className="inline-flex items-center gap-2">{icon}{label}</span>
      <ArrowRight size={15} className="text-gray-400" />
    </Link>
  );
}

function teacherStatusMeta(status: "INVITED" | "ACTIVE" | "INCOMPLETE_SETUP" | "SUSPENDED" | "LEFT_SCHOOL") {
  switch (status) {
    case "ACTIVE":
      return { label: "Active", className: "bg-emerald-50 text-emerald-700" };
    case "INCOMPLETE_SETUP":
      return { label: "Incomplete setup", className: "bg-amber-50 text-amber-700" };
    case "SUSPENDED":
      return { label: "Suspended", className: "bg-rose-50 text-rose-700" };
    case "LEFT_SCHOOL":
      return { label: "Left school", className: "bg-gray-100 text-gray-600" };
    case "INVITED":
    default:
      return { label: "Invited", className: "bg-violet-50 text-violet-700" };
  }
}

function teacherTypeLabel(type: "SUBJECT_TEACHER" | "CLASS_TEACHER" | "BOTH") {
  if (type === "CLASS_TEACHER") return "Class teacher";
  if (type === "BOTH") return "Subject and class teacher";
  return "Subject teacher";
}

function classTeacherTypeLabel(supervisedClassCount: number, lessonCount: number) {
  if (supervisedClassCount > 0 && lessonCount > 0) return "Subject and class teacher";
  if (supervisedClassCount > 0) return "Class teacher";
  if (lessonCount > 0) return "Subject teacher";
  return "Not assigned yet";
}


function teacherAccountLinkLabel(teacherId: string, acceptedBy: string | null) {
  if (acceptedBy) return "Linked through accepted invite";
  if (teacherId.startsWith("user_")) return "Linked to authenticated account";
  return "Legacy or seed account";
}
function inviteStatusLabel(status: string, acceptedAt: Date | null, revokedAt: Date | null) {
  if (acceptedAt) return "Accepted";
  if (revokedAt) return "Revoked";
  return status.replaceAll("_", " ").toLowerCase().replace(/^./, (char) => char.toUpperCase());
}

function buildAccountabilitySummary(rows: { status: TeacherObligationStatus; expectedAt: Date; completedAt: Date | null; metadata: unknown }[], now: Date) {
  const summary = {
    total: 0,
    pending: 0,
    completed: 0,
    completedLate: 0,
    missed: 0,
    escalated: 0,
  };

  for (const row of rows) {
    const status = effectiveObligationStatus(row, now);
    summary.total += 1;
    if (status === "PENDING") summary.pending += 1;
    if (status === "COMPLETED") summary.completed += 1;
    if (status === "COMPLETED_LATE") summary.completedLate += 1;
    if (status === "MISSED") summary.missed += 1;
    if (status === "ESCALATED") summary.escalated += 1;
  }

  return summary;
}

function groupLessonsByDay<T extends { day: string; startTime: Date }>(lessons: T[]) {
  const rows = dayOrder.flatMap((day) => {
    const lessonsForDay = lessons
      .filter((lesson) => lesson.day === day)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    return lessonsForDay.length > 0 ? [{ day, lessons: lessonsForDay }] : [];
  });
  return rows;
}

function formatDay(day: string) {
  return day.charAt(0) + day.slice(1).toLowerCase();
}


function formatLessonTime(value: Date) {
  return value.toLocaleTimeString("en-GH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
function formatDateTime(date: Date) {
  return date.toLocaleString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function inviteAuditTitle(action: TeacherInviteAuditAction) {
  return action.replaceAll("_", " ").toLowerCase().replace(/^./, (char) => char.toUpperCase());
}

function accountabilityAuditTitle(action: TeacherAccountabilityAuditAction) {
  return action.replaceAll("_", " ").toLowerCase().replace(/^./, (char) => char.toUpperCase());
}

function buildTeacherAuditRows({
  inviteLogs,
  accountabilityLogs,
}: {
  inviteLogs: { id: string; action: TeacherInviteAuditAction; createdAt: Date; metadata: unknown }[];
  accountabilityLogs: { id: string; action: TeacherAccountabilityAuditAction; createdAt: Date; message: string | null }[];
}) {
  const inviteRows = inviteLogs.map((log) => ({
    id: `invite-${log.id}`,
    title: inviteAuditTitle(log.action),
    message: "Teacher invite event recorded.",
    createdAt: log.createdAt,
  }));
  const accountabilityRows = accountabilityLogs.map((log) => ({
    id: `accountability-${log.id}`,
    title: accountabilityAuditTitle(log.action),
    message: log.message ?? "Accountability event recorded.",
    createdAt: log.createdAt,
  }));

  return [...inviteRows, ...accountabilityRows]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10);
}

export default SingleTeacherPage;