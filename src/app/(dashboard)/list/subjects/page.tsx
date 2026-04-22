// src/app/(dashboard)/list/subjects/page.tsx

import Pagination from "@/src/components/pagination";
import TableSearch from "@/src/components/TableSearch";
import Image from "next/image";
import { Users } from "lucide-react";
import FormModal from "@/src/components/FormModal";
import { Prisma } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { ITEM_PER_PAGE } from "@/src/lib/settings";
import { auth } from "@clerk/nextjs/server";  // ← replaces hardcoded role import

// Dynamic color by index — no hardcoded subject names
const SUBJECT_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-orange-100 text-orange-700",
  "bg-teal-100 text-teal-700",
  "bg-pink-100 text-pink-700",
  "bg-cyan-100 text-cyan-700",
  "bg-lime-100 text-lime-700",
];

const SubjectListPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;

  const { page, ...queryParams } = await searchParams;
  const p = page ? parseInt(page) : 1;

  const query: Prisma.SubjectWhereInput = {};

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "search":
            query.name = { contains: value, mode: "insensitive" };
            break;
        }
      }
    }
  }

  const [subjects, count, totalLessons] = await Promise.all([
    prisma.subject.findMany({
      where: query,
      include: {
        teachers: { select: { id: true, name: true, surname: true } },
        _count:   { select: { lessons: true } },
      },
      orderBy: { name: "asc" },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
    }),
    prisma.subject.count({ where: query }),
    prisma.lesson.count(),
  ]);

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">

      {/* ── Page header ── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tight">Subjects</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">{count} subjects in curriculum</p>
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
              {role === "admin" && <FormModal table="subject" type="create" />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Subjects", value: count,                                                         color: "bg-indigo-50 text-indigo-600"  },
          { label: "Total Lessons",  value: totalLessons,        color: "bg-emerald-50 text-emerald-600" },
          { label: "Total Teachers", value: new Set(subjects.flatMap((s) => s.teachers.map((t) => t.id))).size, color: "bg-violet-50 text-violet-600"  },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
              <Users size={16} />
            </div>
            <div>
              <p className="text-xl font-black text-gray-800 leading-none">{s.value}</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">Subject</th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">Teachers</th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden lg:table-cell">Lessons</th>
                {role === "admin" && (
                  <th className="text-right px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 w-[100px]">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {subjects.map((item, idx) => {
                const color = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
                return (
                  <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors duration-150 group">

                    {/* Subject name with color dot */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color.split(" ")[0].replace("bg-", "bg-").replace("100", "400")}`} />
                        <p className="font-bold text-sm text-gray-800">{item.name}</p>
                      </div>
                    </td>

                    {/* Teachers — fixed: shows actual names not just first */}
                    <td className="px-4 py-4 hidden md:table-cell">
                      {item.teachers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.teachers.slice(0, 3).map((t) => (
                            <span key={t.id} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              {t.name} {t.surname}
                            </span>
                          ))}
                          {item.teachers.length > 3 && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                              +{item.teachers.length - 3} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300 italic">No teachers assigned</span>
                      )}
                    </td>

                    {/* Lesson count */}
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600">
                        {item._count.lessons} lessons
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 w-[100px]">
                      <div className="flex items-center justify-end gap-2">
                        {role === "admin" && <FormModal table="subject" type="update" data={item} />}
                        {role === "admin" && <FormModal table="subject" type="delete" id={item.id} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
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

export default SubjectListPage;
