// src/app/(dashboard)/list/teachers/page.tsx

import Pagination from "@/src/components/pagination";
import { requirePageSession } from "@/src/lib/authz";
import { clerkClient } from "@clerk/nextjs/server";
import TableSearch from "@/src/components/TableSearch";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Eye,
  GraduationCap,
  ShieldCheck,
  Users,
} from "lucide-react";
import FormModal from "@/src/components/FormModal";
import prisma from "@/src/lib/prisma";
import { Subject, Prisma } from "@/src/generated/prisma";
import { ITEM_PER_PAGE } from "@/src/lib/settings";
import { listLiveTimetableLessons } from "@/src/lib/services/timetable";
import TeacherInviteActions from "@/src/components/TeacherInviteActions";
import TeacherInviteModal from "@/src/components/TeacherInviteModal";
import {
  getTeacherReadiness,
  teacherReadinessToneClass,
} from "@/src/lib/services/teacher-readiness";

// Dynamic subject color by name initial
const SUBJECT_COLORS = [
  "bg-blue-100 text-blue-700",   "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700", "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",   "bg-orange-100 text-orange-700",
  "bg-teal-100 text-teal-700",   "bg-pink-100 text-pink-700",
];
const getSubjectColor = (_: string, idx: number) =>
  SUBJECT_COLORS[idx % SUBJECT_COLORS.length];

type TeacherSetupStatus = "ready" | "needs-setup";
type TeacherLifecycleTab = "all" | "ready" | "needs-setup" | "active" | "incomplete" | "suspended" | "left-school" | "pending-invites";
type TeacherInviteRow = Awaited<
  ReturnType<typeof prisma.teacherInvite.findMany>
>[number];

const statusTabs: Array<{
  key: TeacherLifecycleTab;
  label: string;
}> = [
  { key: "all", label: "All teachers" },
  { key: "ready", label: "Ready" },
  { key: "needs-setup", label: "Needs setup" },
  { key: "active", label: "Active" },
  { key: "incomplete", label: "Incomplete setup" },
  { key: "suspended", label: "Suspended" },
  { key: "left-school", label: "Left school" },
  { key: "pending-invites", label: "Pending invites" },
];

const TeacherListPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { role, schoolId } = await requirePageSession();

  const { page, ...queryParams } = await searchParams;
  const p = page ? parseInt(page) : 1;
  const selectedStatus: TeacherLifecycleTab =
    queryParams.status === "ready" ||
    queryParams.status === "needs-setup" ||
    queryParams.status === "active" ||
    queryParams.status === "incomplete" ||
    queryParams.status === "suspended" ||
    queryParams.status === "left-school" ||
    queryParams.status === "pending-invites"
      ? queryParams.status
      : "all";
  const searchTerm = queryParams.search?.trim();

  const query: Prisma.TeacherWhereInput = { schoolId };
  const inviteQuery: Prisma.TeacherInviteWhereInput = {
    schoolId,
    status: "PENDING",
    acceptedAt: null,
    revokedAt: null,
  };
  let classFilterTeacherIds: string[] | null = null;

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "classId":
            classFilterTeacherIds = Array.from(
              new Set(
                (await listLiveTimetableLessons(schoolId, { classId: parseInt(value) }))
                  .map((lesson) => lesson.teacherId),
              ),
            );
            break;
          case "search":
            if (!value.trim()) break;
            query.OR = [
              { name: { contains: value, mode: "insensitive" } },
              { surname: { contains: value, mode: "insensitive" } },
              { email: { contains: value, mode: "insensitive" } },
              { phone: { contains: value, mode: "insensitive" } },
            ];
            inviteQuery.OR = [
              { name: { contains: value, mode: "insensitive" } },
              { surname: { contains: value, mode: "insensitive" } },
              { email: { contains: value, mode: "insensitive" } },
              { phone: { contains: value, mode: "insensitive" } },
              { staffId: { contains: value, mode: "insensitive" } },
            ];
            break;
        }
      }
    }
  }
  if (classFilterTeacherIds) {
    query.id = { in: classFilterTeacherIds };
  }

  const now = new Date();
  const [allTeachers, pendingInviteRows, pendingInviteListCount, pendingInviteCount] = await Promise.all([
    prisma.teacher.findMany({
      where: query,
      include: {
        subjects: true,
        classes: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.teacherInvite.findMany({
      where: inviteQuery,
      orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }],
      skip: ITEM_PER_PAGE * (p - 1),
      take: ITEM_PER_PAGE,
    }),
    prisma.teacherInvite.count({
      where: inviteQuery,
    }),
    prisma.teacherInvite.count({
      where: {
        schoolId,
        status: "PENDING",
        acceptedAt: null,
        revokedAt: null,
      },
    }),
  ]);
  const liveLessons = await listLiveTimetableLessons(schoolId);
  const liveLessonsByTeacherId = new Map<string, typeof liveLessons>();
  for (const lesson of liveLessons) {
    const rows = liveLessonsByTeacherId.get(lesson.teacherId) ?? [];
    rows.push(lesson);
    liveLessonsByTeacherId.set(lesson.teacherId, rows);
  }

  const enrichedTeachers = allTeachers.map((teacher) => {
    const teacherLessons = liveLessonsByTeacherId.get(teacher.id) ?? [];
    const taughtClasses = Array.from(
      new Map(teacherLessons.map((l) => [l.class.id, l.class])).values(),
    );
    const classBadges = buildClassBadges(taughtClasses, teacher.classes);
    const readiness = getTeacherReadiness({
      status: teacher.status,
      name: teacher.name,
      surname: teacher.surname,
      email: teacher.email,
      phone: teacher.phone,
      address: teacher.address,
      subjectCount: teacher.subjects.length,
      publishedLessonCount: teacherLessons.length,
      taughtClassCount: taughtClasses.length,
      supervisedClassCount: teacher.classes.length,
    });
    const setupStatus: TeacherSetupStatus = readiness.isReady ? "ready" : "needs-setup";
    const missingSetup = [...readiness.blockers, ...readiness.setupWarnings];

    return { teacher, taughtClasses, classBadges, setupStatus, missingSetup, readiness };
  });

  const readyTeachers = enrichedTeachers.filter((item) => item.readiness.isReady);
  const teachersNeedingSetup = enrichedTeachers.filter((item) => item.readiness.status === "NEEDS_SETUP" || item.readiness.status === "INVITED");
  const activeTeachers = enrichedTeachers.filter((item) => item.teacher.status === "ACTIVE");
  const incompleteTeachers = enrichedTeachers.filter((item) => item.teacher.status === "INCOMPLETE_SETUP");
  const suspendedTeachers = enrichedTeachers.filter((item) => item.teacher.status === "SUSPENDED");
  const leftSchoolTeachers = enrichedTeachers.filter((item) => item.teacher.status === "LEFT_SCHOOL");
  const filteredTeachers =
    selectedStatus === "ready"
      ? readyTeachers
      : selectedStatus === "needs-setup"
        ? teachersNeedingSetup
        : selectedStatus === "active"
          ? activeTeachers
          : selectedStatus === "incomplete"
            ? incompleteTeachers
            : selectedStatus === "suspended"
              ? suspendedTeachers
              : selectedStatus === "left-school"
                ? leftSchoolTeachers
                : selectedStatus === "pending-invites"
                  ? []
                  : enrichedTeachers;
  const tabCounts: Record<TeacherLifecycleTab, number> = {
    all: enrichedTeachers.length,
    ready: readyTeachers.length,
    "needs-setup": teachersNeedingSetup.length,
    active: activeTeachers.length,
    incomplete: incompleteTeachers.length,
    suspended: suspendedTeachers.length,
    "left-school": leftSchoolTeachers.length,
    "pending-invites": pendingInviteListCount,
  };
  const count =
    selectedStatus === "pending-invites"
      ? pendingInviteListCount
      : filteredTeachers.length;
  const teachers = filteredTeachers.slice(
    ITEM_PER_PAGE * (p - 1),
    ITEM_PER_PAGE * p,
  );
  const clerkTeacherImages = await syncVisibleTeacherPhotos(teachers);
  const pendingInvites = pendingInviteRows;
  const activeTabHref = (status: string) => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (queryParams.search) params.set("search", queryParams.search);
    if (queryParams.classId) params.set("classId", queryParams.classId);
    return `/list/teachers${params.toString() ? `?${params.toString()}` : ""}`;
  };

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">

      {/* ── Page header ── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tight">Teachers</h1>
            <p className="text-sm text-gray-500 mt-0.5 font-medium">
              Manage teacher access, setup readiness, and published timetable coverage.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <TableSearch />
            <div className="flex items-center gap-2">
              {role === "admin" && <TeacherInviteModal />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats — all from DB, no hardcoded values ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[
          { label: "Registered", value: allTeachers.length, icon: <Users size={16} />, color: "bg-indigo-50 text-indigo-600" },
          { label: "Active", value: activeTeachers.length, icon: <CheckCircle2 size={16} />, color: "bg-emerald-50 text-emerald-600" },
          { label: "Ready", value: readyTeachers.length, icon: <GraduationCap size={16} />, color: "bg-blue-50 text-blue-600" },
          { label: "Needs setup", value: teachersNeedingSetup.length, icon: <AlertCircle size={16} />, color: "bg-amber-50 text-amber-600" },
          { label: "Pending invites", value: pendingInviteCount, icon: <Clock3 size={16} />, color: "bg-violet-50 text-violet-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-xl font-black text-gray-800 leading-none">{stat.value}</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-2 shadow-sm">
        <div className="flex gap-2 overflow-x-auto">
          {statusTabs.map((tab) => {
            const active = selectedStatus === tab.key;
            return (
              <Link
                key={tab.key}
                href={activeTabHref(tab.key)}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-black transition ${
                  active
                    ? "bg-edujay-primary text-white shadow-sm"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                  {tabCounts[tab.key]}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {selectedStatus === "pending-invites" && (
        <PendingInvitesTable
          invites={pendingInvites}
          now={now}
          role={role}
          searchTerm={searchTerm}
        />
      )}

      {/* ── Table ── */}
      {selectedStatus !== "pending-invites" && (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1">
        <div className="divide-y divide-gray-100 md:hidden">
          {teachers.map(({ teacher: item, classBadges, setupStatus, missingSetup, readiness }) => {
            const lifecycle = teacherStatusMeta(item.status);
            const profileCompletion = readiness.profileCompletion;

            return (
              <div key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <Image
                      src={clerkTeacherImages.get(item.id) || item.img || "/noAvatar.png"}
                      alt={item.name}
                      width={44}
                      height={44}
                      className="h-11 w-11 shrink-0 rounded-xl object-cover ring-2 ring-gray-100"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-gray-800">
                        {item.name} {item.surname}
                      </p>
                      <p className="mt-0.5 truncate text-xs font-semibold text-gray-400">
                        {item.email}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${lifecycle.className}`}>
                          {lifecycle.label}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${teacherReadinessToneClass(readiness.tone)}`}>
                          {readiness.label}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">
                          {profileCompletion.completionPercent}% profile
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Link href={`/list/teachers/${item.id}`}>
                      <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors hover:bg-indigo-100">
                        <Eye size={15} />
                      </button>
                    </Link>
                    {role === "admin" && <FormModal table="teacher" type="update" data={item} />}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2">
                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Subjects</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.subjects.slice(0, 3).map((s: Subject, idx: number) => (
                        <span key={s.id} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getSubjectColor(s.name, idx)}`}>
                          {s.name}
                        </span>
                      ))}
                      {item.subjects.length > 3 && (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                          +{item.subjects.length - 3}
                        </span>
                      )}
                      {item.subjects.length === 0 && (
                        <span className="text-xs font-semibold italic text-gray-300">None assigned</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Class scope</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {classBadges.slice(0, 3).map((c) => (
                        <span key={`${c.kind}-${c.id}`} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.kind === "supervises" ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-600"}`}>
                          {c.name}{c.kind === "supervises" ? " · class teacher" : ""}
                        </span>
                      ))}
                      {classBadges.length > 3 && (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                          +{classBadges.length - 3}
                        </span>
                      )}
                      {classBadges.length === 0 && (
                        <span className="text-xs font-semibold italic text-gray-300">No class scope yet</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Phone</p>
                      <p className="mt-1 truncate text-sm font-bold text-gray-700">{item.phone ?? "Not provided"}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Setup</p>
                      <p className={`mt-1 line-clamp-2 text-xs font-bold ${setupStatus === "ready" ? "text-emerald-700" : "text-amber-700"}`}>
                        {setupStatus === "ready"
                          ? "Ready for school operations"
                          : missingSetup.slice(0, 2).join(" · ")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {teachers.length === 0 && (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-black text-gray-500">
                No teachers match this view.
              </p>
              <p className="mt-1 text-xs font-semibold text-gray-400">
                Try another tab or search term.
              </p>
            </div>
          )}
        </div>

        <div className="hidden w-full overflow-x-auto md:block">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">Teacher</th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">Subjects</th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden lg:table-cell">Classes</th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden xl:table-cell">Setup</th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden xl:table-cell">Phone</th>
                {role === "admin" && (
                  <th className="text-right px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 w-[96px]">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {teachers.map(({ teacher: item, classBadges, setupStatus, missingSetup, readiness }) => {
                const lifecycle = teacherStatusMeta(item.status);
                const profileCompletion = readiness.profileCompletion;

                return (
                  <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors duration-150 group">

                    {/* Teacher info */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <Image
                            src={clerkTeacherImages.get(item.id) || item.img || "/noAvatar.png"}
                            alt={item.name}
                            width={40} height={40}
                            className="w-10 h-10 rounded-xl object-cover ring-2 ring-gray-100"
                          />
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-gray-800 truncate">{item.name} {item.surname}</p>
                          <p className="text-xs text-gray-400 truncate">{item.email}</p>
                          <div className="mt-2 flex flex-wrap gap-1 md:hidden">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${lifecycle.className}`}>
                              {lifecycle.label}
                            </span>
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">
                              {profileCompletion.completionPercent}% profile
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${teacherReadinessToneClass(readiness.tone)}`}>
                              {readiness.label}
                            </span>
                          </div>
                          {missingSetup.length > 0 && (
                            <p className="mt-1 line-clamp-2 text-[11px] font-semibold text-amber-600 md:hidden">
                              {missingSetup.slice(0, 2).join(" · ")}{missingSetup.length > 2 ? ` · +${missingSetup.length - 2} more` : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Subjects — dynamic colors */}
                    <td className="px-3 py-3.5 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {item.subjects.slice(0, 2).map((s: Subject, idx: number) => (
                          <span key={s.id} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${getSubjectColor(s.name, idx)}`}>
                            {s.name}
                          </span>
                        ))}
                        {item.subjects.length > 2 && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            +{item.subjects.length - 2}
                          </span>
                        )}
                        {item.subjects.length === 0 && (
                          <span className="text-xs text-gray-300 italic">None assigned</span>
                        )}
                      </div>
                    </td>

                    {/* Classes — from lessons, not supervisor relation */}
                    <td className="px-3 py-3.5 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {classBadges.slice(0, 3).map((c) => (
                          <span key={`${c.kind}-${c.id}`} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.kind === "supervises" ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-600"}`}>
                            {c.name}{c.kind === "supervises" ? " · class teacher" : ""}
                          </span>
                        ))}
                        {classBadges.length > 3 && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            +{classBadges.length - 3}
                          </span>
                        )}
                        {classBadges.length === 0 && (
                          <span className="text-xs text-gray-300 italic">No class scope yet</span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-3.5 hidden xl:table-cell">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${lifecycle.className}`}>
                          {item.status === "ACTIVE" ? <ShieldCheck size={12} /> : <AlertCircle size={12} />}
                          {lifecycle.label}
                        </span>
                        <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${teacherReadinessToneClass(readiness.tone)}`}>
                          {readiness.isReady ? <ShieldCheck size={12} /> : <AlertCircle size={12} />}
                          {readiness.label}
                        </span>
                        <span className="text-xs font-semibold text-gray-400">
                          {setupStatus === "ready" ? "Ready for school operations" : `${profileCompletion.completionPercent}% profile · ${missingSetup.slice(0, 2).join(", ")}${missingSetup.length > 2 ? ` +${missingSetup.length - 2} more` : ""}`}
                        </span>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="px-3 py-3.5 hidden xl:table-cell">
                      <span className="text-sm text-gray-600 font-medium">{item.phone ?? "—"}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4 w-[96px]">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/list/teachers/${item.id}`}>
                          <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors">
                            <Eye size={14} />
                          </button>
                        </Link>
                        {role === "admin" && <FormModal table="teacher" type="update" data={item} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {teachers.length === 0 && (
                <tr>
                  <td
                    colSpan={role === "admin" ? 6 : 5}
                    className="px-5 py-12 text-center"
                  >
                    <p className="text-sm font-black text-gray-500">
                      No teachers match this view.
                    </p>
                    <p className="mt-1 text-xs font-semibold text-gray-400">
                      Try another tab or search term.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100">
          <Pagination page={p} count={count} />
        </div>
      </div>
      )}
      {selectedStatus === "pending-invites" && (
        <div className="border-t border-gray-100">
          <Pagination page={p} count={count} />
        </div>
      )}
    </div>
  );
};


async function syncVisibleTeacherPhotos(
  rows: Array<{ teacher: { id: string; schoolId: string; img: string | null } }>,
) {
  const imageByTeacherId = new Map<string, string>();
  if (rows.length === 0) return imageByTeacherId;

  const client = await clerkClient();
  await Promise.allSettled(
    rows.map(async ({ teacher }) => {
      const user = await client.users.getUser(teacher.id);
      const imageUrl = user.imageUrl;
      if (!imageUrl) return;

      imageByTeacherId.set(teacher.id, imageUrl);
      if (imageUrl !== teacher.img) {
        await prisma.teacher.updateMany({
          where: { id: teacher.id, schoolId: teacher.schoolId },
          data: { img: imageUrl },
        });
      }
    }),
  );

  return imageByTeacherId;
}

function PendingInvitesTable({
  invites,
  now,
  role,
  searchTerm,
}: {
  invites: TeacherInviteRow[];
  now: Date;
  role: string;
  searchTerm?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1">
      <div className="divide-y divide-gray-100 md:hidden">
        {invites.map((invite) => {
          const expired = invite.expiresAt.getTime() <= now.getTime();
          return (
            <div key={invite.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-gray-800">
                    {invite.name} {invite.surname}
                  </p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-gray-400">{invite.email}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${expired ? "bg-rose-50 text-rose-700" : "bg-violet-50 text-violet-700"}`}>
                  {expired ? "Expired" : "Pending"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-gray-50 p-2">
                  <p className="font-black uppercase tracking-wide text-gray-400">Type</p>
                  <p className="mt-0.5 font-bold text-gray-700">{teacherTypeLabel(invite.teacherType)}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-2">
                  <p className="font-black uppercase tracking-wide text-gray-400">Expires</p>
                  <p className="mt-0.5 font-bold text-gray-700">
                    {invite.expiresAt.toLocaleDateString("en-GH", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-2">
                  <p className="font-black uppercase tracking-wide text-gray-400">Created</p>
                  <p className="mt-0.5 font-bold text-gray-700">
                    {invite.createdAt.toLocaleDateString("en-GH", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-2">
                  <p className="font-black uppercase tracking-wide text-gray-400">Last sent</p>
                  <p className="mt-0.5 font-bold text-gray-700">
                    {invite.lastSentAt
                      ? invite.lastSentAt.toLocaleDateString("en-GH", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Not sent"}
                  </p>
                </div>
              </div>
              {role === "admin" && (
                <div className="mt-3 flex justify-end">
                  <TeacherInviteActions inviteId={invite.id} />
                </div>
              )}
            </div>
          );
        })}
        {invites.length === 0 && (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-black text-gray-500">
              {searchTerm ? "No pending invites match this search." : "No pending teacher invites yet."}
            </p>
            <p className="mt-1 text-xs font-semibold text-gray-400">
              Use Invite teacher to create secure teacher onboarding links.
            </p>
          </div>
        )}
      </div>

      <div className="hidden w-full overflow-x-auto md:block">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">Invitee</th>
              <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">Teacher type</th>
              <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">Expires</th>
              <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden xl:table-cell">Created</th>
              <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden xl:table-cell">Last sent</th>
              {role === "admin" && (
                <th className="text-right px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {invites.map((invite) => {
              const expired = invite.expiresAt.getTime() <= now.getTime();
              return (
                <tr key={invite.id} className="hover:bg-indigo-50/30 transition-colors duration-150">
                  <td className="px-4 py-4">
                    <p className="font-bold text-sm text-gray-800 truncate">
                      {invite.name} {invite.surname}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{invite.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1 lg:hidden">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${expired ? "bg-rose-50 text-rose-700" : "bg-violet-50 text-violet-700"}`}>
                        {expired ? "Expired" : "Pending"}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700">
                      {teacherTypeLabel(invite.teacherType)}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <span className={`text-sm font-semibold ${expired ? "text-rose-600" : "text-gray-600"}`}>
                      {invite.expiresAt.toLocaleDateString("en-GH", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </td>
                  <td className="px-3 py-4 hidden xl:table-cell">
                    <span className="text-sm font-semibold text-gray-500">
                      {invite.createdAt.toLocaleDateString("en-GH", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </td>
                  <td className="px-3 py-4 hidden xl:table-cell">
                    <span className="text-sm font-semibold text-gray-500">
                      {invite.lastSentAt
                        ? invite.lastSentAt.toLocaleDateString("en-GH", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Not sent yet"}
                    </span>
                  </td>
                  {role === "admin" && (
                    <td className="px-5 py-4 text-right">
                      <TeacherInviteActions inviteId={invite.id} />
                    </td>
                  )}
                </tr>
              );
            })}
            {invites.length === 0 && (
              <tr>
                <td
                  colSpan={role === "admin" ? 6 : 5}
                  className="px-5 py-12 text-center"
                >
                  <p className="text-sm font-black text-gray-500">
                    {searchTerm ? "No pending invites match this search." : "No pending teacher invites yet."}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-gray-400">
                    Use Invite teacher to create secure teacher onboarding links.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function buildClassBadges(
  taughtClasses: Array<{ id: number; name: string }>,
  supervisedClasses: Array<{ id: number; name: string }>,
) {
  const rows: Array<{ id: number; name: string; kind: "teaches" | "supervises" }> = [];
  for (const klass of taughtClasses) rows.push({ ...klass, kind: "teaches" });
  for (const klass of supervisedClasses) {
    const existing = rows.find((row) => row.id === klass.id);
    if (existing) {
      existing.kind = "supervises";
    } else {
      rows.push({ ...klass, kind: "supervises" });
    }
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

function teacherTypeLabel(type: TeacherInviteRow["teacherType"]) {
  switch (type) {
    case "CLASS_TEACHER":
      return "Class teacher";
    case "BOTH":
      return "Subject and class teacher";
    case "SUBJECT_TEACHER":
    default:
      return "Subject teacher";
  }
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
export default TeacherListPage;

