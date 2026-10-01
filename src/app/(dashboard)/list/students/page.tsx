// src/app/(dashboard)/list/students/page.tsx

import Pagination from "@/src/components/pagination";
import { requirePageSession } from "@/src/lib/authz";
import TableSearch from "@/src/components/TableSearch";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, ChevronRight, Eye, Plus, BookOpen, Users } from "lucide-react";
import FormModal from "@/src/components/FormModal";
import prisma from "@/src/lib/prisma";
import { Prisma, StudentStatus } from "@/src/generated/prisma";
import { ITEM_PER_PAGE } from "@/src/lib/settings";
import { getTeacherScope } from "@/src/lib/services/teacher-scope";
import { listLiveTimetableLessons } from "@/src/lib/services/timetable";

const STUDENT_STATUS_LABELS = {
  INCOMPLETE_SETUP: "Needs setup",
  ACTIVE: "Active",
  TRANSFERRED: "Transferred",
  GRADUATED: "Graduated",
  WITHDRAWN: "Withdrawn",
} as const;

const STUDENT_STATUS_BADGES = {
  INCOMPLETE_SETUP: "bg-amber-50 text-amber-700 border-amber-100",
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-100",
  TRANSFERRED: "bg-sky-50 text-sky-700 border-sky-100",
  GRADUATED: "bg-violet-50 text-violet-700 border-violet-100",
  WITHDRAWN: "bg-rose-50 text-rose-700 border-rose-100",
} as const;

const STUDENT_STATUS_DOTS = {
  INCOMPLETE_SETUP: "bg-amber-400",
  ACTIVE: "bg-emerald-400",
  TRANSFERRED: "bg-sky-400",
  GRADUATED: "bg-violet-400",
  WITHDRAWN: "bg-rose-400",
} as const;

function parsePositiveInt(value?: string) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isStudentStatus(value?: string): value is StudentStatus {
  return Boolean(value && Object.values(StudentStatus).includes(value as StudentStatus));
}

const StudentListPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { userId, role, schoolId } = await requirePageSession();

  const { page, ...queryParams } = await searchParams;
  const p = page ? parseInt(page) : 1;

  const query: Prisma.StudentWhereInput = { schoolId };
  let teacherFilterClassIds: number[] | null = null;

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "teacherId":
            teacherFilterClassIds = Array.from(
              new Set((await listLiveTimetableLessons(schoolId, { teacherId: value })).map((lesson) => lesson.classId)),
            );
            break;
          case "classId":
            {
              const classId = parsePositiveInt(value);
              if (classId) query.classId = classId;
            }
            break;
          case "status":
            if (isStudentStatus(value)) query.status = value;
            break;
          case "search":
            const search = value.trim();
            query.OR = [
              { name: { contains: search, mode: "insensitive" } },
              { surname: { contains: search, mode: "insensitive" } },
              { admissionNumber: { contains: search, mode: "insensitive" } },
              { username: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { class: { name: { contains: search, mode: "insensitive" } } },
            ];
            break;
        }
      }
    }
  }
  if (teacherFilterClassIds) {
    query.classId = { in: teacherFilterClassIds };
  }

  if (role === "teacher") {
    const teacherScope = await getTeacherScope({ schoolId, teacherId: userId });
    const scopedClassIds = teacherScope.accessibleClassIds;
    const requestedClassId = queryParams.classId ? parseInt(queryParams.classId) : null;
    const teacherQuery: Prisma.StudentWhereInput = {
      schoolId,
      status: StudentStatus.ACTIVE,
      classId: {
        in: requestedClassId && scopedClassIds.includes(requestedClassId)
          ? [requestedClassId]
          : requestedClassId
            ? []
          : scopedClassIds,
      },
    };

    const search = queryParams.search?.trim();
    if (search) {
      const lowerSearch = search.toLowerCase();
      const matchingSubjectClassIds = teacherScope.taughtClasses
        .filter((cls) => cls.subjects.some((subject) => subject.name.toLowerCase().includes(lowerSearch)))
        .map((cls) => cls.id);
      teacherQuery.AND = [
        {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { surname: { contains: search, mode: "insensitive" } },
            { admissionNumber: { contains: search, mode: "insensitive" } },
            { username: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { class: { name: { contains: search, mode: "insensitive" } } },
            ...(matchingSubjectClassIds.length > 0 ? [{ classId: { in: matchingSubjectClassIds } }] : []),
          ],
        },
      ];
    }

    const students = await prisma.student.findMany({
      where: teacherQuery,
      select: {
        id: true,
        name: true,
        surname: true,
        username: true,
        admissionNumber: true,
        email: true,
        phone: true,
        img: true,
        sex: true,
        classId: true,
        class: {
          select: {
            id: true,
            name: true,
            grade: { select: { level: true } },
          },
        },
      },
      orderBy: [
        { class: { name: "asc" } },
        { surname: "asc" },
        { name: "asc" },
      ],
    });

    type TeacherStudent = (typeof students)[number];
    type TeacherClassGroup = {
      id: number;
      name: string;
      grade: string;
      students: TeacherStudent[];
      subjects: Map<number, string>;
      isSupervised: boolean;
    };

    const groupedByClass = students.reduce((map, student) => {
        const current = map.get(student.classId) ?? {
          id: student.class.id,
          name: student.class.name,
          grade: student.class.grade.level,
          students: [],
          subjects: new Map<number, string>(),
          isSupervised: teacherScope.supervisedClassIds.includes(student.classId),
        };

        teacherScope.taughtClasses
          .filter((cls) => cls.id === student.classId)
          .flatMap((cls) => cls.subjects)
          .forEach((subject) => current.subjects.set(subject.id, subject.name));
        current.students.push(student);
        map.set(student.classId, current);
        return map;
      }, new Map<number, TeacherClassGroup>());

    const classGroups = Array.from(groupedByClass.values()).map((group) => ({
      ...group,
      subjectNames: Array.from(group.subjects.values()).sort((a, b) => a.localeCompare(b)),
    })).sort((a, b) => Number(b.isSupervised) - Number(a.isSupervised) || a.name.localeCompare(b.name));

    const boys = students.filter((student) => student.sex === "MALE").length;
    const girls = students.filter((student) => student.sex === "FEMALE").length;

    return (
      <div className="flex-1 m-4 mt-0 flex flex-col gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-black text-gray-800 tracking-tight">My Students</h1>
              <p className="text-sm text-gray-400 mt-0.5 font-medium">
                {students.length} student{students.length === 1 ? "" : "s"} across {classGroups.length} taught class{classGroups.length === 1 ? "" : "es"}
              </p>
            </div>
            <div className="w-full sm:w-auto">
              <TableSearch />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "My Students", value: students.length, icon: <Users size={16} />, color: "bg-indigo-50 text-indigo-600" },
            { label: "Classes", value: classGroups.length, icon: <BookOpen size={16} />, color: "bg-amber-50 text-amber-600" },
            { label: "Boys", value: boys, icon: <Users size={16} />, color: "bg-emerald-50 text-emerald-600" },
            { label: "Girls", value: girls, icon: <Plus size={16} />, color: "bg-violet-50 text-violet-600" },
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

        {classGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
            <BookOpen size={30} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-black text-gray-500">No students found for your timetable.</p>
            <p className="mt-1 text-xs font-semibold text-gray-400">
              Ask an admin to assign you to lessons in the timetable builder.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {classGroups.map((group) => (
              <section key={group.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-5 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-black text-gray-800">{group.name}</h2>
                        {group.isSupervised ? (
                          <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black uppercase text-white">
                            My Class
                          </span>
                        ) : (
                          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase text-indigo-600">
                            I Teach
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-gray-400">
                        Grade {group.grade} · {group.students.length} student{group.students.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.isSupervised && group.subjectNames.length === 0 ? (
                        <span className="rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-black text-slate-600">
                          Full class follow-up
                        </span>
                      ) : null}
                      {group.subjectNames.map((subject) => (
                        <span key={subject} className="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-600">
                          {subject}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid divide-y divide-gray-50">
                  {group.students.map((student) => (
                    <Link
                      key={student.id}
                      href={`/list/students/${student.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-indigo-50/40"
                    >
                      <Image
                        src={student.img || "/noAvatar.png"}
                        alt={student.name}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-xl object-cover ring-2 ring-gray-100"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-gray-800">{student.name} {student.surname}</p>
                        <p className="truncate text-xs font-semibold text-gray-400">
                          Admission: {student.admissionNumber ?? student.username}
                          {student.phone ? ` · ${student.phone}` : ""}
                        </p>
                      </div>
                      <span className="hidden rounded-xl bg-gray-50 px-3 py-1.5 text-xs font-black text-gray-500 sm:inline-flex">
                        Profile
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-gray-300" />
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    );
  }

  const baseSchoolWhere: Prisma.StudentWhereInput = { schoolId };
  const [students, count, totalStudents, totalClasses, boys, girls, activeStudents, incompleteStudents, archivedStudents, missingAdmissionStudents, classOptions] = await Promise.all([
    prisma.student.findMany({
      where: query,
      include: {
        class: {
          include: { grade: { select: { level: true } } },
        },
        parent: {
          select: { name: true, surname: true, phone: true, email: true },
        },
      },
      orderBy: { name: "asc" },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
    }),
    prisma.student.count({ where: query }),
    prisma.student.count({ where: baseSchoolWhere }),
    prisma.class.count({ where: { schoolId } }),
    prisma.student.count({ where: { ...baseSchoolWhere, sex: "MALE" } }),
    prisma.student.count({ where: { ...baseSchoolWhere, sex: "FEMALE" } }),
    prisma.student.count({ where: { ...baseSchoolWhere, status: StudentStatus.ACTIVE } }),
    prisma.student.count({ where: { ...baseSchoolWhere, status: StudentStatus.INCOMPLETE_SETUP } }),
    prisma.student.count({
      where: {
        ...baseSchoolWhere,
        status: { in: [StudentStatus.TRANSFERRED, StudentStatus.GRADUATED, StudentStatus.WITHDRAWN] },
      },
    }),
    prisma.student.count({ where: { ...baseSchoolWhere, admissionNumber: null } }),
    prisma.class.findMany({
      where: { schoolId },
      select: { id: true, name: true, grade: { select: { level: true, order: true } } },
      orderBy: [{ grade: { order: "asc" } }, { name: "asc" }],
    }),
  ]);

  const selectedStatus = isStudentStatus(queryParams.status) ? queryParams.status : "";
  const selectedClassId = parsePositiveInt(queryParams.classId);
  const activeFilterCount = [
    queryParams.search?.trim() ? "search" : null,
    selectedClassId ? "class" : null,
    selectedStatus ? "status" : null,
  ].filter(Boolean).length;

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">

      {/* ── Page header ── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tight">Students</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">
              {count} shown from {totalStudents} student record{totalStudents === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 w-full lg:w-auto">
            <TableSearch />
            <form className="grid grid-cols-2 gap-2 sm:flex sm:items-center" action="/list/students">
              {queryParams.search ? <input type="hidden" name="search" value={queryParams.search} /> : null}
              <select
                name="classId"
                defaultValue={selectedClassId ?? ""}
                className="min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-600 outline-none focus:border-indigo-400"
                aria-label="Filter by class"
              >
                <option value="">All classes</option>
                {classOptions.map((klass) => (
                  <option key={klass.id} value={klass.id}>
                    {klass.name} · {klass.grade.level}
                  </option>
                ))}
              </select>
              <select
                name="status"
                defaultValue={selectedStatus}
                className="min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-600 outline-none focus:border-indigo-400"
                aria-label="Filter by student status"
              >
                <option value="">All statuses</option>
                {Object.entries(STUDENT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Apply
              </button>
              {activeFilterCount > 0 ? (
                <Link
                  href="/list/students"
                  className="rounded-xl bg-gray-100 px-4 py-2.5 text-center text-sm font-black text-gray-600 transition hover:bg-gray-200"
                >
                  Clear
                </Link>
              ) : null}
            </form>
            <div className="flex items-center gap-2">
              {role === "admin" && <FormModal table="student" type="create" />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats — real DB values ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active Students", value: activeStudents, icon: <Users size={16} />, color: "bg-emerald-50 text-emerald-600" },
          { label: "Needs Setup", value: incompleteStudents, icon: <AlertCircle size={16} />, color: "bg-amber-50 text-amber-600" },
          { label: "Left / Completed", value: archivedStudents, icon: <BookOpen size={16} />, color: "bg-violet-50 text-violet-600" },
          { label: "Missing Admission", value: missingAdmissionStudents, icon: <Plus size={16} />, color: "bg-rose-50 text-rose-600" },
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

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-white p-4 text-xs font-semibold text-gray-500 shadow-sm sm:grid-cols-3">
        <p><span className="font-black text-gray-800">{totalClasses}</span> active class records</p>
        <p><span className="font-black text-gray-800">{boys}</span> boys · <span className="font-black text-gray-800">{girls}</span> girls</p>
        <p>
          {activeFilterCount > 0
            ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} applied`
            : "Showing all student records"}
        </p>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1">
        <div className="grid divide-y divide-gray-50 md:hidden">
          {students.length === 0 ? (
            <div className="p-8 text-center">
              <Users size={28} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-black text-gray-500">No students match this view.</p>
              <p className="mt-1 text-xs font-semibold text-gray-400">Clear filters or add a student record.</p>
            </div>
          ) : students.map((item) => (
            <article
              key={item.id}
              className="p-4 transition hover:bg-indigo-50/40"
            >
              <div className="flex items-start gap-3">
                <Image
                  src={item.img || "/noAvatar.png"}
                  alt={item.name}
                  width={44}
                  height={44}
                  className="h-11 w-11 rounded-xl object-cover ring-2 ring-gray-100"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-gray-800">{item.name} {item.surname}</p>
                      <p className="truncate text-xs font-semibold text-gray-400">Admission: {item.admissionNumber ?? item.username}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black ${STUDENT_STATUS_BADGES[item.status]}`}>
                      {STUDENT_STATUS_LABELS[item.status]}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-1 text-xs font-semibold text-gray-500">
                    <p>{item.class.name} · {item.class.grade.level}</p>
                    <p>
                      Parent: {item.parent ? `${item.parent.name} ${item.parent.surname}` : "No parent saved"}
                    </p>
                    <p>{item.parent?.phone || item.parent?.email || item.phone || "No contact saved"}</p>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Link
                      href={`/list/students/${item.id}`}
                      className="inline-flex flex-1 items-center justify-center rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-600 transition hover:bg-indigo-100"
                    >
                      View profile
                    </Link>
                    {role === "admin" ? <FormModal table="student" type="update" data={item} /> : null}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="hidden w-full overflow-x-auto md:block">
          <table className="w-full min-w-[360px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">Student</th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">Class</th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden lg:table-cell">Status</th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden xl:table-cell">Parent</th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden lg:table-cell">Contact</th>
                {role === "admin" && (
                  <th className="text-right px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 w-[120px]">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={role === "admin" ? 6 : 5} className="px-5 py-10 text-center">
                    <Users size={28} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-sm font-black text-gray-500">No students match this view.</p>
                    <p className="mt-1 text-xs font-semibold text-gray-400">Clear filters or add a student record.</p>
                  </td>
                </tr>
              ) : students.map((item) => (
                <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors duration-150 group">

                  {/* Student info */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <Image
                          src={item.img || "/noAvatar.png"}
                          alt={item.name}
                          width={38} height={38}
                          className="w-9 h-9 rounded-xl object-cover ring-2 ring-gray-100"
                        />
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${STUDENT_STATUS_DOTS[item.status]}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-gray-800 truncate">{item.name} {item.surname}</p>
                        <p className="text-xs text-gray-400 truncate">Admission: {item.admissionNumber ?? item.username}</p>
                      </div>
                    </div>
                  </td>

                  {/* Class name */}
                  <td className="px-3 py-3.5 hidden md:table-cell">
                    <div>
                      <span className="text-sm font-semibold text-gray-700">{item.class.name}</span>
                      <p className="text-[11px] font-bold text-indigo-500">{item.class.grade.level}</p>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3.5 hidden lg:table-cell">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${STUDENT_STATUS_BADGES[item.status]}`}>
                      {STUDENT_STATUS_LABELS[item.status]}
                    </span>
                  </td>

                  {/* Parent */}
                  <td className="px-3 py-3.5 hidden xl:table-cell">
                    <span className="block max-w-[180px] truncate text-sm font-semibold text-gray-700">
                      {item.parent ? `${item.parent.name} ${item.parent.surname}` : "No parent saved"}
                    </span>
                  </td>

                  {/* Contact */}
                  <td className="px-3 py-3.5 hidden lg:table-cell">
                    <span className="block max-w-[170px] truncate text-sm font-medium text-gray-600">
                      {item.parent?.phone || item.parent?.email || item.phone || "No contact saved"}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4 w-[120px]">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/list/students/${item.id}`}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                        aria-label={`View ${item.name} ${item.surname}`}
                      >
                        <Eye size={14} />
                      </Link>
                      {role === "admin" && <FormModal table="student" type="update" data={item} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100">
          <Pagination page={p} count={count} />
        </div>
      </div>
    </div>
  );
};

export default StudentListPage;
