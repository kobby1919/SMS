"use client";

// src/components/AttendanceBarChart.tsx

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type DayData = { name: string; present: number; absent: number };

const AttendanceBarChart = ({ data }: { data: DayData[] }) => {
  const [mountKey, setMountKey] = useState(0);

  // On every mount (including page refresh), bump the key to force
  // Framer Motion to treat bars as brand-new elements and re-run animations
  useEffect(() => {
    setMountKey((k) => k + 1);
  }, []);

  const max = Math.max(...data.map((d) => d.present + d.absent), 1);

  return (
    // motion.div with fade+slide matches the other dashboard cards exactly.
    // key={mountKey} forces a full remount on every page load so Framer Motion
    // re-runs initial→animate instead of skipping it on refresh.
    <motion.div
      key={mountKey}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-black text-gray-800 text-sm">Attendance This Week</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">Daily present vs absent</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-[11px] text-gray-400 font-medium">Present</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span className="text-[11px] text-gray-400 font-medium">Absent</span>
          </div>
        </div>
      </div>

      <div className="flex items-end gap-4 flex-1 pb-2">
        {data.map((d, i) => {
          const presentH = Math.max((d.present / max) * 140, 2);
          const absentH  = Math.max((d.absent  / max) * 140, 2);

          return (
            <div key={d.name} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="flex items-end gap-1 h-[140px]">
                <motion.div
                  key={`${mountKey}-${d.name}-p`}
                  className="w-5 bg-emerald-400 rounded-t-lg"
                  initial={{ height: 2 }}
                  animate={{ height: presentH }}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.08, ease: "easeOut" }}
                />
                <motion.div
                  key={`${mountKey}-${d.name}-a`}
                  className="w-5 bg-rose-400 rounded-t-lg"
                  initial={{ height: 2 }}
                  animate={{ height: absentH }}
                  transition={{ duration: 0.5, delay: 0.34 + i * 0.08, ease: "easeOut" }}
                />
              </div>
              <motion.span
                key={`${mountKey}-${d.name}-label`}
                className="text-[10px] font-bold text-gray-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.08 + 0.3 }}
              >
                {d.name}
              </motion.span>
              {(d.present > 0 || d.absent > 0) && (
                <motion.span
                  key={`${mountKey}-${d.name}-count`}
                  className="text-[9px] text-gray-300"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.08 + 0.4 }}
                >
                  {d.present}p/{d.absent}a
                </motion.span>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default AttendanceBarChart;
