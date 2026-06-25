"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

const DAYS   = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const EventCalendar = () => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [current, setCurrent] = useState({ month: 0, year: 0 });
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const today = new Date();
      setCurrent({ month: today.getMonth(), year: today.getFullYear() });
      setSelected(today.getDate());
      setMounted(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!mounted) return <div className="bg-white p-5 rounded-2xl shadow-sm h-[320px]" />;

  const today    = new Date();
  const firstDay = new Date(current.year, current.month, 1).getDay();
  const daysInMonth = new Date(current.year, current.month + 1, 0).getDate();

  const prevMonth = () =>
    setCurrent((c) => c.month === 0  ? { month: 11, year: c.year - 1 } : { month: c.month - 1, year: c.year });
  const nextMonth = () =>
    setCurrent((c) => c.month === 11 ? { month: 0,  year: c.year + 1 } : { month: c.month + 1, year: c.year });

  const handleSelectDay = (day: number) => {
    setSelected(day);
    // Build ISO date string e.g. "2026-04-20" and push to URL
    const dateStr = `${current.year}-${String(current.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    router.push(`?date=${dateStr}`);
  };

  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white p-5 rounded-2xl shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-nunito font-extrabold text-base text-gray-800">
          {MONTHS[current.month]} {current.year}
        </h2>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-jayPurpleLight text-gray-500 hover:text-jayPurple transition-colors text-sm">‹</button>
          <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-jayPurpleLight text-gray-500 hover:text-jayPurple transition-colors text-sm">›</button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase">{d}</div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          const isToday    = day === today.getDate() && current.month === today.getMonth() && current.year === today.getFullYear();
          const isSelected = day === selected;
          return (
            <div key={i} className="flex items-center justify-center">
              {day ? (
                <button
                  onClick={() => handleSelectDay(day)}
                  className={`w-8 h-8 rounded-full text-xs font-medium transition-all
                    ${isSelected ? "bg-jayPurple text-white font-bold" : ""}
                    ${isToday && !isSelected ? "ring-2 ring-jayPurple text-jayPurple font-bold" : ""}
                    ${!isToday && !isSelected ? "text-gray-600 hover:bg-gray-100" : ""}
                  `}
                >
                  {day}
                </button>
              ) : <div className="w-8 h-8" />}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default EventCalendar;
