"use client";

import { PieChart, Pie, ResponsiveContainer, Cell } from "recharts";
import { motion } from "framer-motion";

interface PerformanceProps {
  title?: string;
  subtitle?: string;
  currentSemesterValue: number; // e.g., 9.2
  previousSemesterValue: number; // e.g., 8.8
  trendLabel: string; // e.g., "+4%"
  rankingLabel: string; // e.g., "Top 15% of staff"
  chartColor?: string; // Optional: change color for student vs teacher
}

const Performance = ({
  title = "Performance",
  subtitle = "Academic year overview",
  currentSemesterValue,
  previousSemesterValue,
  trendLabel,
  rankingLabel,
  chartColor = "#6366f1", // Default Indigo
}: PerformanceProps) => {
  
  // Transform values to Recharts format (assuming scale of 10)
  const currentData = [
    { name: "Score", value: currentSemesterValue, fill: chartColor },
    { name: "Remaining", value: 10 - currentSemesterValue, fill: "#e0e7ff" },
  ];

  const previousData = [
    { name: "Score", value: previousSemesterValue, fill: chartColor },
    { name: "Remaining", value: 10 - previousSemesterValue, fill: "#e0e7ff" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-black text-gray-800">{title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full shrink-0">
          2025–2026
        </span>
      </div>

      <div className="flex flex-col xs:flex-row items-center justify-center gap-6 xs:gap-4">
        {/* Chart 1 — Current */}
        <div className="flex flex-col items-center w-full xs:flex-1">
          <div className="relative w-full h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  dataKey="value"
                  startAngle={180}
                  endAngle={0}
                  data={currentData}
                  cx="50%"
                  cy="100%"
                  innerRadius={50}
                  outerRadius={72}
                  paddingAngle={2}
                >
                  {currentData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} strokeWidth={0} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-center">
              <p className="text-2xl font-black text-gray-800 leading-none">
                {currentSemesterValue.toFixed(1)}
              </p>
              <p className="text-[10px] text-gray-400 font-medium">/ 10</p>
            </div>
          </div>
          <p className="text-xs font-bold text-gray-600 mt-1">Current Sem</p>
        </div>

        <div className="hidden xs:block w-px h-28 bg-gray-100 shrink-0" />
        <div className="xs:hidden w-full h-px bg-gray-100 shrink-0" />

        {/* Chart 2 — Previous */}
        <div className="flex flex-col items-center w-full xs:flex-1">
          <div className="relative w-full h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  dataKey="value"
                  startAngle={180}
                  endAngle={0}
                  data={previousData}
                  cx="50%"
                  cy="100%"
                  innerRadius={50}
                  outerRadius={72}
                  paddingAngle={2}
                >
                  {previousData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} strokeWidth={0} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-center">
              <p className="text-2xl font-black text-gray-800 leading-none">
                {previousSemesterValue.toFixed(1)}
              </p>
              <p className="text-[10px] text-gray-400 font-medium">/ 10</p>
            </div>
          </div>
          <p className="text-xs font-bold text-gray-600 mt-1">Previous Sem</p>
        </div>
      </div>

      {/* Bottom trend */}
      <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            ↑ {trendLabel}
          </span>
          <span className="text-xs text-gray-400 font-medium">improvement</span>
        </div>
        <span className="text-xs text-gray-400 font-medium italic">
          {rankingLabel}
        </span>
      </div>
    </motion.div>
  );
};

export default Performance;