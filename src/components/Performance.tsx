"use client";

import { PieChart, Pie, ResponsiveContainer, Cell } from "recharts";
import { motion } from "framer-motion";

const data = [
  { name: "Score", value: 92, fill: "#6366f1" },
  { name: "Remaining", value: 8, fill: "#e0e7ff" },
];

const semesterData = [
  { name: "1st Sem", value: 88, fill: "#6366f1" },
  { name: "Remaining", value: 12, fill: "#e0e7ff" },
];

const Performance = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-black text-gray-800">Performance</h2>
          <p className="text-xs text-gray-400 mt-0.5">Academic year overview</p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full shrink-0">
          2025–2026
        </span>
      </div>

      {/* Charts Container - Fixed Responsiveness */}
      <div className="flex flex-col xs:flex-row items-center justify-center gap-6 xs:gap-4">
        {/* Chart 1 — Current semester */}
        <div className="flex flex-col items-center w-full xs:flex-1">
          <div className="relative w-full h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  dataKey="value"
                  startAngle={180}
                  endAngle={0}
                  data={data}
                  cx="50%"
                  cy="100%"
                  innerRadius={50}
                  outerRadius={72}
                  paddingAngle={2}
                >
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} strokeWidth={0} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-center">
              <p className="text-2xl font-black text-gray-800 leading-none">
                9.2
              </p>
              <p className="text-[10px] text-gray-400 font-medium">/ 10</p>
            </div>
          </div>
          <p className="text-xs font-bold text-gray-600 mt-1">2nd Semester</p>
          <div className="flex items-center gap-1 mt-1">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-[11px] text-gray-400 font-medium">
              92% score
            </span>
          </div>
        </div>

        {/* Vertical Divider - Hidden on stack */}
        <div className="hidden xs:block w-px h-28 bg-gray-100 shrink-0" />
        {/* Horizontal Divider - Visible on stack */}
        <div className="xs:hidden w-full h-px bg-gray-100 shrink-0" />

        {/* Chart 2 — Previous semester */}
        <div className="flex flex-col items-center w-full xs:flex-1">
          <div className="relative w-full h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  dataKey="value"
                  startAngle={180}
                  endAngle={0}
                  data={semesterData}
                  cx="50%"
                  cy="100%"
                  innerRadius={50}
                  outerRadius={72}
                  paddingAngle={2}
                >
                  {semesterData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} strokeWidth={0} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-center">
              <p className="text-2xl font-black text-gray-800 leading-none">
                8.8
              </p>
              <p className="text-[10px] text-gray-400 font-medium">/ 10</p>
            </div>
          </div>
          <p className="text-xs font-bold text-gray-600 mt-1">1st Semester</p>
          <div className="flex items-center gap-1 mt-1">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-[11px] text-gray-400 font-medium">
              88% score
            </span>
          </div>
        </div>
      </div>

      {/* Bottom trend */}
      <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            ↑ +4%
          </span>
          <span className="text-xs text-gray-400 font-medium">
            vs last semester
          </span>
        </div>
        <span className="text-xs text-gray-400 font-medium italic">
          Top 15% of staff
        </span>
      </div>
    </motion.div>
  );
};

export default Performance;
