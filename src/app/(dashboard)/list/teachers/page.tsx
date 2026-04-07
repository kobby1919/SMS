import Pagination from "@/src/components/pagination";
import TableSearch from "@/src/components/TableSearch";
import { role, teachersData } from "@/src/lib/data";
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

type Teacher = {
  id: number;
  teacherId: string;
  name: string;
  email?: string;
  photo: string;
  phone: string;
  subjects: string[];
  classes: string[];
  address: string;
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

const TeacherListPage = () => {
  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">
      {/* ── Page header ── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left — title + count */}
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tight">
              Teachers
            </h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">
              {teachersData.length} members registered
            </p>
          </div>

          {/* Right — search + actions */}
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
              {role === "admin" && (
                // <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
                //   <Image src="/plus.png" alt="" width={16} height={16} />
                //   <span className="hidden sm:inline">Add</span>
                // </button> 
                <FormModal table="teacher" type="create" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total Teachers",
            value: teachersData.length,
            icon: <Users size={16} />,
            color: "bg-indigo-50 text-indigo-600",
          },
          {
            label: "Subjects Taught",
            value: 6,
            icon: <BookOpen size={16} />,
            color: "bg-amber-50 text-amber-600",
          },
          {
            label: "Active Classes",
            value: 12,
            icon: <Users size={16} />,
            color: "bg-emerald-50 text-emerald-600",
          },
          {
            label: "New This Month",
            value: 2,
            icon: <Plus size={16} />,
            color: "bg-violet-50 text-violet-600",
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
          <table className="w-full min-w-[360px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">
                  Teacher
                </th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">
                  ID
                </th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">
                  Subjects
                </th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden lg:table-cell">
                  Classes
                </th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden xl:table-cell">
                  Phone
                </th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden xl:table-cell">
                  Address
                </th>
                <th className="text-right px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 sticky right-0 bg-gray-50/60 backdrop-blur-sm">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {teachersData.map((item: Teacher) => (
                <tr
                  key={item.id}
                  className="hover:bg-indigo-50/30 transition-colors duration-150 group"
                >
                  {/* Teacher info */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <Image
                          src={item.photo}
                          alt={item.name}
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-xl object-cover ring-2 ring-gray-100"
                        />
                        {/* Online dot */}
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-gray-800 truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {item.email}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Teacher ID */}
                  <td className="px-3 py-3.5 hidden md:table-cell">
                    <span className="text-xs font-mono font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                      {item.teacherId}
                    </span>
                  </td>

                  {/* Subjects */}
                  <td className="px-3 py-3.5 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {item.subjects.slice(0, 2).map((s) => (
                        <span
                          key={s}
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${getSubjectColor(s)}`}
                        >
                          {s}
                        </span>
                      ))}
                      {item.subjects.length > 2 && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          +{item.subjects.length - 2}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Classes */}
                  <td className="px-3 py-3.5 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {item.classes.slice(0, 3).map((c) => (
                        <span
                          key={c}
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600"
                        >
                          {c}
                        </span>
                      ))}
                      {item.classes.length > 3 && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          +{item.classes.length - 3}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Phone */}
                  <td className="px-3 py-3.5 hidden xl:table-cell">
                    <span className="text-sm text-gray-600 font-medium">
                      {item.phone}
                    </span>
                  </td>

                  {/* Address */}
                  <td className="px-3 py-3.5 hidden xl:table-cell">
                    <span className="text-sm text-gray-500 truncate max-w-[160px] block">
                      {item.address}
                    </span>
                  </td>

                  {/* Actions — sticky right */}
                  <td className="px-5 py-4 w-[100px]">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/list/teachers/${item.id}`}>
                        <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors">
                          <Eye size={14} />
                        </button>
                      </Link>
                      {role === "admin" && (
                        // <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors">
                        //   <Trash2 size={14} />
                        // </button>
                        <FormModal table="teacher" type="delete" id={item.id} />
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

export default TeacherListPage;
