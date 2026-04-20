"use client";

import Image from "next/image";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { motion } from "framer-motion";

type DayData = { name: string; present: number; absent: number };

const AttendanceChart = ({ data }: { data: DayData[] }) => {
  const avgPresent = data.length
    ? Math.round(data.reduce((s, d) => s + d.present, 0) / data.length)
    : 0;
  const avgAbsent = data.length
    ? Math.round(data.reduce((s, d) => s + d.absent, 0) / data.length)
    : 0;
  const rate =
    avgPresent + avgAbsent > 0
      ? Math.round((avgPresent / (avgPresent + avgAbsent)) * 100)
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-2xl p-5 h-full shadow-sm flex flex-col"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-1">
        <h1 className="font-nunito font-extrabold text-[15px] text-gray-800">Attendance</h1>
        <div className="flex items-center gap-4 text-[11px] text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-sm bg-jaySky" />Present
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-sm bg-jayYellow" />Absent
          </span>
        </div>
        <Image src="/moreDark.png" alt="" width={18} height={18} />
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2 my-3">
        {[
          { label: "Avg Present", value: avgPresent },
          { label: "Avg Absent",  value: avgAbsent  },
          { label: "Rate",        value: `${rate}%` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#F7F8FA] rounded-xl p-2.5">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
            <p className="font-nunito font-extrabold text-lg text-gray-800 leading-tight">{value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradPresent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#C3EBFA" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#C3EBFA" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradAbsent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#FAE27C" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#FAE27C" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="name" axisLine={false} tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} />
            <YAxis axisLine={false} tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: "12px", borderColor: "#e5e7eb", fontSize: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
            />
            <Area type="monotone" dataKey="present" stroke="#C3EBFA" strokeWidth={2.5} fill="url(#gradPresent)"
              dot={{ r: 4, fill: "#fff", stroke: "#C3EBFA", strokeWidth: 2 }} activeDot={{ r: 5 }} />
            <Area type="monotone" dataKey="absent" stroke="#FAE27C" strokeWidth={2.5} fill="url(#gradAbsent)"
              dot={{ r: 4, fill: "#fff", stroke: "#FAE27C", strokeWidth: 2 }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default AttendanceChart;
