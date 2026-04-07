"use client";

import Pagination from "@/src/components/pagination";
import TableSearch from "@/src/components/TableSearch";
import { classesData, role } from "@/src/lib/data";
import Image from "next/image";
import { Users } from "lucide-react";
import FormModal from "@/src/components/FormModal";

type Class = {
  id: number;
  name: string;
  capacity: number;
  grade: number;
  supervisor: string;
};

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
              {classesData.length} classes available
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
              
              {/* ✅ FIXED: FormModal is called directly, no outer <button> */}
              {role === "admin" && (
                <FormModal table="class" type="create" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-600">
            <Users size={16} />
          </div>
          <div>
            <p className="text-xl font-black text-gray-800 leading-none">
              {classesData.length}
            </p>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              Total Classes
            </p>
          </div>
        </div>
      </div>

      {/* ── Table card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-full border-collapse">
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
                {/* Fixed column setup for Actions */}
                <th className="text-right px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 sticky right-0 bg-gray-50/60 z-10">
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
                  <td className="px-5 py-4">
                    <p className="font-bold text-sm text-gray-800">{item.name}</p>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-sm text-gray-500">{item.capacity}</span>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600">
                      Grade {item.grade}
                    </span>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-sm text-gray-500">{item.supervisor}</span>
                  </td>
                  
                  {/* ✅ FIXED: Actions cell handles z-index and spacing */}
                  <td className="px-5 py-4 w-[100px]">
                    <div className="flex items-center justify-end gap-2">
                      {/* 1. UPDATE MODAL (Replaces the Link/Eye icon) */}
                      {role === "admin" && (
                        <FormModal table="class" type="update" data={item} />
                      )}

                      {/* 2. DELETE MODAL */}
                      {role === "admin" && (
                        <FormModal table="class" type="delete" id={item.id} />
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