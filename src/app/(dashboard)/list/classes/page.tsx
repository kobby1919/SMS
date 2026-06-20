// src/app/(dashboard)/list/classes/page.tsx

import Pagination from "@/src/components/pagination";
import { requirePageSession } from "@/src/lib/authz";
import TableSearch from "@/src/components/TableSearch";
import Image from "next/image";
import { Users, GraduationCap, LayoutGrid } from "lucide-react";
import FormModal from "@/src/components/FormModal";
import { getClassesPage } from "@/src/lib/services/classes";

const ClassListPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { role, schoolId } = await requirePageSession();

  const { page, ...queryParams } = await searchParams;
  const parsedPage = page ? parseInt(page) : 1;
  const p = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const { classes, count } = await getClassesPage(schoolId, p, {
    search: queryParams.search,
    supervisorId: queryParams.supervisorId,
  });

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">

      {/* ── Page header ── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tight">Classes</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">{count} classes registered</p>
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
              {role === "admin" && <FormModal table="class" type="create" />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Classes",   value: count,                                                              icon: <LayoutGrid size={16} />,    color: "bg-indigo-50 text-indigo-600"  },
          { label: "Total Students",  value: classes.reduce((s, c) => s + c._count.students, 0),                icon: <Users size={16} />,          color: "bg-emerald-50 text-emerald-600" },
          { label: "Grade Levels",    value: new Set(classes.map((c) => c.grade.level)).size,                    icon: <GraduationCap size={16} />,  color: "bg-violet-50 text-violet-600"  },
          { label: "With Supervisor", value: classes.filter((c) => c.supervisorId).length,                       icon: <Users size={16} />,          color: "bg-amber-50 text-amber-600"   },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
              {s.icon}
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
          <table className="w-full min-w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">Class</th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden sm:table-cell">Grade</th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">Section</th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">Capacity</th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">Students</th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden lg:table-cell">Supervisor</th>
                {role === "admin" && (
                  <th className="text-right px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 w-[100px]">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {classes.map((item) => (
                <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors duration-150 group">

                  {/* Class name */}
                  <td className="px-5 py-4">
                    <p className="font-black text-sm text-gray-800">{item.name}</p>
                  </td>

                  {/* Grade level — from relation, NOT item.name[0] */}
                  <td className="px-4 py-4 hidden sm:table-cell">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600">
                      {item.grade.level}
                    </span>
                  </td>

                  {/* Section */}
                  <td className="px-4 py-4 hidden md:table-cell">
                    {item.section ? (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-violet-50 text-violet-600">
                        Section {item.section}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300 font-medium">—</span>
                    )}
                  </td>

                  {/* Capacity */}
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-sm text-gray-500">{item.capacity}</span>
                  </td>

                  {/* Student count */}
                  <td className="px-4 py-4 hidden md:table-cell">
                    <div className="flex items-center gap-1.5">
                      <div className={`h-1.5 rounded-full bg-gray-100 w-16 overflow-hidden`}>
                        <div
                          className="h-full rounded-full bg-indigo-400"
                          style={{ width: `${Math.min(100, (item._count.students / item.capacity) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-500">
                        {item._count.students}/{item.capacity}
                      </span>
                    </div>
                  </td>

                  {/* Supervisor — fixed undefined undefined */}
                  <td className="px-4 py-4 hidden lg:table-cell">
                    {item.supervisor ? (
                      <span className="text-sm text-gray-700 font-medium">
                        {item.supervisor.name} {item.supervisor.surname}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300 font-medium italic">Not assigned</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4 w-[100px]">
                    <div className="flex items-center justify-end gap-2">
                      {role === "admin" && <FormModal table="class" type="update" data={item} />}
                      {role === "admin" && <FormModal table="class" type="delete" id={item.id} />}
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

export default ClassListPage;
