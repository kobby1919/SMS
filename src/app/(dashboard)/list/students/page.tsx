// src/app/(dashboard)/list/students/page.tsx

import Pagination from "@/src/components/pagination";
import TableSearch from "@/src/components/TableSearch";
import Image from "next/image";
import Link from "next/link";
import { Eye, Plus, BookOpen, Users } from "lucide-react";
import FormModal from "@/src/components/FormModal";
import prisma from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import { ITEM_PER_PAGE } from "@/src/lib/settings";
import { auth } from "@clerk/nextjs/server";

const StudentListPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;

  const { page, ...queryParams } = await searchParams;
  const p = page ? parseInt(page) : 1;

  const query: Prisma.StudentWhereInput = {};

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
            query.name = { contains: value, mode: "insensitive" };
            break;
        }
      }
    }
  }

  // Get start of current month for "new this month"
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [students, count, totalClasses, newThisMonth] = await Promise.all([
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
    prisma.class.count(),
    prisma.student.count({
      where: { createdAt: { gte: startOfMonth } },
    }),
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
          { label: "Boys",  value: await prisma.student.count({ where: { ...query, sex: "MALE" } }),   icon: <Users size={16} />, color: "bg-emerald-50 text-emerald-600" },
          { label: "Girls", value: await prisma.student.count({ where: { ...query, sex: "FEMALE" } }), icon: <Plus size={16} />,  color: "bg-violet-50 text-violet-600"  },
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
