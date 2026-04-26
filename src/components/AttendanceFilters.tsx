"use client";

// src/components/AttendanceFilters.tsx

import { useRouter, usePathname } from "next/navigation";
import { Filter } from "lucide-react";

type Props = {
  classes:        { id: number; name: string }[];
  currentDate:    string;
  currentClassId?: string;
  currentStatus?:  string;
};

const AttendanceFilters = ({ classes, currentDate, currentClassId, currentStatus }: Props) => {
  const router   = useRouter();
  const pathname = usePathname();

  const update = (key: string, value: string) => {
    const params = new URLSearchParams();
    if (currentDate)    params.set("date",    currentDate);
    if (currentClassId) params.set("classId", currentClassId);
    if (currentStatus)  params.set("status",  currentStatus);
    if (value)          params.set(key, value);
    else                params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1.5 text-gray-400">
          <Filter size={13} />
          <span className="text-xs font-bold uppercase tracking-wide">Filter</span>
        </div>

        {/* Date */}
        <input
          type="date"
          value={currentDate}
          max={new Date().toISOString().split("T")[0]}
          onChange={(e) => update("date", e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-300"
        />

        {/* Class */}
        <select
          value={currentClassId ?? ""}
          onChange={(e) => update("classId", e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
        >
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Status */}
        <select
          value={currentStatus ?? ""}
          onChange={(e) => update("status", e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
        >
          <option value="">All Statuses</option>
          <option value="PRESENT">Present</option>
          <option value="ABSENT">Absent</option>
          <option value="LATE">Late</option>
          <option value="EXCUSED">Excused</option>
        </select>

        {/* Clear */}
        {(currentClassId || currentStatus) && (
          <button
            onClick={() => router.push(pathname)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
};

export default AttendanceFilters;