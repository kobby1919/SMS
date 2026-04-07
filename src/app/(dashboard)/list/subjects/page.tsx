import Pagination from "@/src/components/pagination";
import TableSearch from "@/src/components/TableSearch";
import { parentsData, role, studentsData, subjectsData } from "@/src/lib/data";
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
import FormModal from "@/src/components/FormModal";

type Subject = {
  id: number;
  name: string;
  teachers: string[];
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

const SubjectListPage = () => {
  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">
      {/* ── Page header ── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left — title + count */}
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tight">
              Subjects
            </h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">
              {parentsData.length} being Taught
            </p>
          </div>

          {/* Right — search + actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <TableSearch />
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors">
                {/* <Filter size={14} /> */}
                <Image src="/filter.png" alt="" width={16} height={16} />
                <span className="hidden sm:inline">Filter</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors">
                {/* <ArrowUpDown size={14} /> */}
                <Image src="/sort.png" alt="" width={16} height={16} />
                <span className="hidden sm:inline">Sort</span>
              </button>
              {role === "admin" && (
                // <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
                //   {/* <Plus size={14} /> */}
                //   <Image src="/plus.png" alt="" width={16} height={16} />
                //   <span className="hidden sm:inline">Add</span>
                // </button>
                <FormModal table="subject" type="create" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total Subjects",
            value: parentsData.length,
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
                  Subject Name
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">
                  Teachers
                </th>
                <th className="text-right px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 w-[100px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {subjectsData.map((item: Subject) => (
                <tr
                  key={item.id}
                  className="hover:bg-indigo-50/30 transition-colors duration-150 group"
                >
                  {/* Parent info */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-gray-800 truncate">
                          {item.name}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Assigned teachers to SUBJECTS */}
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-sm text-gray-500  max-w-[180px] block break-words">
                      {item.teachers.join(", ")}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4 w-[100px]">
                    <div className="flex items-center justify-end gap-2">
                      {/* 1. UPDATE MODAL (Replaces the Link/Eye icon) */}
                      {role === "admin" && (
                        <FormModal table="subject" type="update" data={item} />
                      )}

                      {/* 2. DELETE MODAL */}
                      {role === "admin" && (
                        <FormModal table="subject" type="delete" id={item.id} />
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

export default SubjectListPage;
