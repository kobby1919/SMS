"use client";

import Pagination from "@/src/components/pagination";
import TableSearch from "@/src/components/TableSearch";
import { examsData, role } from "@/src/lib/data";
import Link from "next/link";
import {
  Eye,
  Trash2,
  Filter,
  ArrowUpDown,
  Plus,
  Calendar, // Changed icon for Exams
} from "lucide-react";
import FormModal from "@/src/components/FormModal";

type Exam = {
  id: number;
  subject: string;
  class: string;
  teacher: string;
  date: string;
};

const ExamListPage = () => {
  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">
      {/* ── Page header ── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tight">
              Exams
            </h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">
              {examsData.length} exams available
            </p>
          </div>

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
                // <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
                //   <Plus size={14} />
                //   <span>Add</span>
                // </button>
                <FormModal table="exam" type="create" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total Exams",
            value: examsData.length,
            icon: <Calendar size={16} />,
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
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">
                  Subject Name
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">
                  Class
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">
                  Teacher
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">
                  Date
                </th>
                <th className="text-right px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 w-[100px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {examsData.map((item: Exam) => (
                <tr
                  key={item.id}
                  className="hover:bg-indigo-50/30 transition-colors duration-150 group"
                >
                  <td className="px-5 py-4">
                    <p className="font-bold text-sm text-gray-800 truncate">
                      {item.subject}
                    </p>
                  </td>

                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-sm text-gray-500">{item.class}</span>
                  </td>

                  <td className="px-3 py-3.5 hidden md:table-cell">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600">
                      {item.teacher}
                    </span>
                  </td>

                  {/* FIXED: Rendering item.date instead of item.class */}
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-sm text-gray-500">{item.date}</span>
                  </td>

                  {/* Sticky actions */}
                  <td className="px-5 py-4 w-[100px]">
                    <div className="flex items-center justify-end gap-2">
                      {/* 1. UPDATE MODAL (Replaces the Link/Eye icon) */}
                      {role === "admin" && (
                        <FormModal table="exam" type="update" data={item} />
                      )}

                      {/* 2. DELETE MODAL */}
                      {role === "admin" && (
                        <FormModal table="exam" type="delete" id={item.id} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-100">
          <Pagination />
        </div>
      </div>
    </div>
  );
};

export default ExamListPage;
