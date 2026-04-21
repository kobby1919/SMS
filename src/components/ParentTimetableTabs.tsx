"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BigCalendar from "@/src/components/BigCalendar";
import type { CalendarLesson } from "@/src/components/BigCalendar";

export type ChildSchedule = {
  id:        string;
  name:      string;
  surname:   string;
  className: string;
  lessons:   CalendarLesson[];
};

type Props = { children: ChildSchedule[] };

const ParentTimetableTabs = ({ children }: Props) => {
  const [activeIndex, setActiveIndex] = useState(0);

  if (children.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
          <span className="text-2xl">👨‍👩‍👧</span>
        </div>
        <p className="text-gray-500 font-semibold">No children linked to your account.</p>
        <p className="text-gray-400 text-sm mt-1">Please contact the school administrator.</p>
      </div>
    );
  }

  const active = children[activeIndex];

  return (
    <div className="flex flex-col gap-4">

      {/* ── Tab bar — only show if more than one child ── */}
      {children.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {children.map((child, i) => (
            <button
              key={child.id}
              onClick={() => setActiveIndex(i)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border
                ${activeIndex === i
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                }`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black
                ${activeIndex === i ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"}`}>
                {child.name[0]}
              </span>
              {child.name} {child.surname}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                ${activeIndex === i ? "bg-white/20 text-white" : "bg-gray-100 text-gray-400"}`}>
                {child.className}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Active child schedule ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="bg-white p-5 rounded-2xl shadow-sm"
        >
          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-nunito font-extrabold text-gray-800">
                {active.name} {active.surname}&apos;s Schedule
              </h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {active.className} — weekly timetable
              </p>
            </div>
            {/* Ward badge */}
            <div className="bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-xl border border-indigo-100">
              Ward {activeIndex + 1} of {children.length}
            </div>
          </div>

          {/* Timetable */}
          {active.lessons.length > 0 ? (
            <BigCalendar lessons={active.lessons} viewAs="parent" />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="text-3xl mb-3">📭</span>
              <p className="text-gray-400 font-semibold text-sm">
                No timetable found for {active.className}.
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default ParentTimetableTabs;