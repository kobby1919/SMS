import Pagination from "@/src/components/pagination";
import TableSearch from "@/src/components/TableSearch";
import {
  classesData,
  parentsData,
  role,
  studentsData,
  subjectsData,
} from "@/src/lib/data";
import Image from "next/image";
import Link from "next/link";
import {
  Eye,
  Trash2,
  Filter,
  ArrowUpDown,
  Plus,
  BookOpen,
  Users,
} from "lucide-react";

type Class = {
  id: number;
  name: string;
  capacity: number;
  grade: number;
  supervisor: string;
};

const subjectColors: Record<string, string> = {
  Math: "bg-blue-100 text-blue-700",
  English: "bg-amber-100 text-amber-700",
  Biology: "bg-emerald-100 text-emerald-700",
  Physics: "bg-violet-100 text-violet-700",
  Chemistry: "bg-rose-100 text-rose-700",
  History: "bg-orange-100 text-orange-700",
  Science: "bg-teal-100 text-teal-700",
};

const getSubjectColor = (subject: string) =>
  subjectColors[subject] ?? "bg-gray-100 text-gray-600";

const ClassListPage = () => {
  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">
      {/* ── Page header ── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left — title + count */}
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tight">
              Classes
            </h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">
              {classesData.length} classes avalable
            </p>
          </div>

          {/* Right — search + actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <TableSearch />
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors">
                <Filter size={14} />
                <span className="hidden sm:inline">Filter</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors">
                <ArrowUpDown size={14} />
                <span className="hidden sm:inline">Sort</span>
              </button>
              {role === "admin" && (
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total Classes",
            value: classesData.length,
            icon: <Users size={16} />,
            color: "bg-indigo-50 text-indigo-600",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3"
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}
            >
              {stat.icon}
            </div>
            <div>
              <p className="text-xl font-black text-gray-800 leading-none">
                {stat.value}
              </p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                {stat.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1">
        {/* Table — scrollable on mobile */}
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">
                  Class Name
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">
                  Capacity
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">
                  Grade
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">
                  Supervisor
                </th>
                <th className="text-right px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 w-[100px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {classesData.map((item: Class) => (
                <tr
                  key={item.id}
                  className="hover:bg-indigo-50/30 transition-colors duration-150 group"
                >
                  {/* Classes info */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-gray-800 truncate">
                          {item.name}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Capacity */}
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-sm text-gray-500  max-w-[180px] block break-words">
                      {item.capacity}
                    </span>
                  </td>

                  {/* Grade */}
                  <td className="px-3 py-3.5 hidden md:table-cell">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600">
                      Grade {item.grade}
                    </span>
                  </td>

                  {/* SUPERVISOR */}
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-sm text-gray-500 block break-words">
                      {item.supervisor}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4 w-[100px]">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/list/students/${item.id}`}>
                        <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors">
                          <Eye size={14} />
                        </button>
                      </Link>
                      {role === "admin" && (
                        <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="border-t border-gray-100">
          <Pagination />
        </div>
      </div>
    </div>
  );
};

export default ClassListPage;
