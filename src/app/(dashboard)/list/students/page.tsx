// src/app/(dashboard)/list/students/page.tsx

import Pagination from "@/src/components/pagination";
import { requirePageSession } from "@/src/lib/authz";
import TableSearch from "@/src/components/TableSearch";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Eye, Plus, BookOpen, Users } from "lucide-react";
import FormModal from "@/src/components/FormModal";
import prisma from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import { ITEM_PER_PAGE } from "@/src/lib/settings";

const StudentListPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { userId, role, schoolId } = await requirePageSession();

  const { page, ...queryParams } = await searchParams;
  const p = page ? parseInt(page) : 1;

  const query: Prisma.StudentWhereInput = { schoolId };

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "teacherId":
            query.class = { lessons: { some: { teacherId: value } } };
            break;
          case "classId":
            query.classId = parseInt(value);
            break;
          case "search":
            const search = value.trim();
            query.OR = [
              { name: { contains: search, mode: "insensitive" } },
              { surname: { contains: search, mode: "insensitive" } },
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

  if (role === "teacher") {
    const teacherQuery: Prisma.StudentWhereInput = {
      schoolId,
      class: { lessons: { some: { teacherId: userId } } },
    };

    if (queryParams.classId) {
      teacherQuery.classId = parseInt(queryParams.classId);
    }

    if (queryParams.search) {
      const search = queryParams.search.trim();
      teacherQuery.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { surname: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { class: { name: { contains: search, mode: "insensitive" } } },
        { class: { lessons: { some: { subject: { name: { contains: search, mode: "insensitive" } } } } } },
      ];
    }

    const students = await prisma.student.findMany({
      where: teacherQuery,
      select: {
        id: true,
        name: true,
        surname: true,
        username: true,
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
            lessons: {
              where: { teacherId: userId },
              select: {
                subject: { select: { id: true, name: true } },
              },
              orderBy: [{ subject: { name: "asc" } }],
            },
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
    };

    const groupedByClass = students.reduce((map, student) => {
        const current = map.get(student.classId) ?? {
          id: student.class.id,
          name: student.class.name,
          grade: student.class.grade.level,
          students: [],
          subjects: new Map<number, string>(),
        };

        student.class.lessons.forEach((lesson) => {
          current.subjects.set(lesson.subject.id, lesson.subject.name);
        });
        current.students.push(student);
        map.set(student.classId, current);
        return map;
      }, new Map<number, TeacherClassGroup>());

    const classGroups = Array.from(groupedByClass.values()).map((group) => ({
      ...group,
      subjectNames: Array.from(group.subjects.values()).sort((a, b) => a.localeCompare(b)),
    }));

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
                      <h2 className="text-base font-black text-gray-800">{group.name}</h2>
                      <p className="text-xs font-semibold text-gray-400">
                        Grade {group.grade} · {group.students.length} student{group.students.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
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
                          {student.email ?? student.username}
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

  const [students, count, totalClasses, boys, girls] = await Promise.all([
    prisma.student.findMany({
      where: query,
      include: {
        class: {
          include: { grade: { select: { level: true } } },
        },
      },
      orderBy: { name: "asc" },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
    }),
    prisma.student.count({ where: query }),
    prisma.class.count({ where: { schoolId } }),
    prisma.student.count({ where: { ...query, sex: "MALE" } }),
    prisma.student.count({ where: { ...query, sex: "FEMALE" } }),
  ]);

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">

      {/* ── Page header ── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tight">Students</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">{count} members registered</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <TableSearch />
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors">
                <Image src="/filter.png" alt="" width={16} height={16} />
                <span className="hidden sm:inline">Filter</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors">
                <Image src="/sort.png" alt="" width={16} height={16} />
                <span className="hidden sm:inline">Sort</span>
              </button>
              {role === "admin" && <FormModal table="student" type="create" />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats — real DB values ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Students",  value: count,         icon: <Users size={16} />,    color: "bg-indigo-50 text-indigo-600"   },
          { label: "Active Classes",  value: totalClasses,  icon: <BookOpen size={16} />, color: "bg-amber-50 text-amber-600"    },
          { label: "Boys",  value: boys,  icon: <Users size={16} />, color: "bg-emerald-50 text-emerald-600" },
          { label: "Girls", value: girls, icon: <Plus size={16} />,  color: "bg-violet-50 text-violet-600"  },
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

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[360px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">Student</th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">Class</th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">Grade</th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden lg:table-cell">Phone</th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden xl:table-cell">Address</th>
                {role === "admin" && (
                  <th className="text-right px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 w-[120px]">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {students.map((item) => (
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
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-gray-800 truncate">{item.name} {item.surname}</p>
                        <p className="text-xs text-gray-400 truncate">{item.email ?? item.username}</p>
                      </div>
                    </div>
                  </td>

                  {/* Class name */}
                  <td className="px-3 py-3.5 hidden md:table-cell">
                    <span className="text-sm font-semibold text-gray-700">{item.class.name}</span>
                  </td>

                  {/* Grade level — fixed: was "Grade Class 3A", now "Class 3" */}
                  <td className="px-3 py-3.5 hidden md:table-cell">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600">
                      {item.class.grade.level}
                    </span>
                  </td>

                  {/* Phone */}
                  <td className="px-3 py-3.5 hidden lg:table-cell">
                    <span className="text-sm text-gray-600 font-medium">{item.phone ?? "—"}</span>
                  </td>

                  {/* Address */}
                  <td className="px-3 py-3.5 hidden xl:table-cell">
                    <span className="text-sm text-gray-500 truncate max-w-[160px] block">{item.address}</span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4 w-[120px]">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/list/students/${item.id}`}>
                        <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors">
                          <Eye size={14} />
                        </button>
                      </Link>
                      {role === "admin" && <FormModal table="student" type="update" data={item} />}
                      {role === "admin" && <FormModal table="student" type="delete" id={item.id} />}
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
