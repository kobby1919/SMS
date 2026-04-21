"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const hours = [7, 8, 9, 10, 11, 12, 13, 14];

// --- Dynamic color palette ---
// Instead of hardcoding subjects names, we assign colors by index.
//This works for any subject list from the DB.

const COLOR_PALETTE = [
  {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-l-blue-400",
    dot: "bg-blue-400",
  },
  {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-l-amber-400",
    dot: "bg-amber-400",
  },
  {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-l-emerald-400",
    dot: "bg-emerald-400",
  },
  {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-l-violet-400",
    dot: "bg-violet-400",
  },
  {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-l-rose-400",
    dot: "bg-rose-400",
  },
  {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-l-orange-400",
    dot: "bg-orange-400",
  },
  {
    bg: "bg-teal-50",
    text: "text-teal-700",
    border: "border-l-teal-400",
    dot: "bg-teal-400",
  },
  {
    bg: "bg-pink-50",
    text: "text-pink-700",
    border: "border-l-pink-400",
    dot: "bg-pink-400",
  },
  {
    bg: "bg-cyan-50",
    text: "text-cyan-700",
    border: "border-l-cyan-400",
    dot: "bg-cyan-400",
  },
  {
    bg: "bg-lime-50",
    text: "text-lime-700",
    border: "border-l-lime-400",
    dot: "bg-lime-400",
  },
  {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-l-indigo-400",
    dot: "bg-indigo-400",
  },
  {
    bg: "bg-fuchsia-50",
    text: "text-fuchsia-700",
    border: "border-l-fuchsia-400",
    dot: "bg-fuchsia-400",
  },
];

// Build a color map dynamically from the unique subjects in the lessons list
const buildColorMap = (lessons: CalendarLesson[]) => {
  const unique = Array.from(new Set(lessons.map((l) => l.title)));
  return Object.fromEntries(
    unique.map((subject, i) => [
      subject,
      COLOR_PALETTE[i % COLOR_PALETTE.length],
    ]),
  );
};

// What the parent server component passes in
export type CalendarLesson = {
  title: string; // subject name
  day: string; // "MONDAY" | "TUESDAY" etc (from DB enum)
  startTime: Date;
  endTime: Date;
  className?: string; // e.g. "4A"
  teacher?: string; // teacher name (for student/parent view)
};

type Props = {
  lessons: CalendarLesson[];
  viewAs?: "student" | "teacher" | "parent" | "admin";
};

// Map DB Day enum → display day name
const dayEnumToLabel: Record<string, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
};

const getLessonsForDay = (lessons: CalendarLesson[], dayName: string) =>
  lessons.filter((l) => dayEnumToLabel[l.day] === dayName);

const getLessonAtHour = (
  lessons: CalendarLesson[],
  dayName: string,
  hour: number,
) =>
  lessons.find(
    (l) =>
      dayEnumToLabel[l.day] === dayName &&
      new Date(l.startTime).getHours() === hour,
  );

const formatTime = (date: Date) =>
  `${new Date(date).getHours()}:${String(new Date(date).getMinutes()).padStart(2, "0")}`;

const getDuration = (start: Date, end: Date): string => {
  const mins = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

// COMPONENT
const BigCalendar = ({ lessons, viewAs = "student" }: Props) => {
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [viewMode, setViewMode] = useState<"week" | "day">("day");
  const [isDesktop, setIsDesktop] = useState(false);

  const colorMap = buildColorMap(lessons);

  // Unique subjects for the legend ( only subjects actually in this timetable )
  const uniqueSubjects = Array.from(new Set(lessons.map((l) => l.title)));

  useEffect(() => {
    const check = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);
      setViewMode(desktop ? "week" : "day");
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const renderLessonCard = (lesson: CalendarLesson, compact = false) => {
    const c = colorMap[lesson.title] ?? COLOR_PALETTE[0];

    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        className={`h-full rounded-xl border-l-4 px-2 py-2 flex flex-col justify-center gap-0.5 cursor-default ${c.bg} ${c.border}`}
      >
        {/* Subject Name */}
        <span
          className={`font-bold leading-snug ${compact ? "text-[11px]" : "text-xs"} ${c.text}`}
        >
          {lesson.title}
        </span>

        {/* Class name - teacher view */}
        {lesson.className && (
          <span
            className={`font-semibold ${compact ? "text-[9px]" : "text-[10px]"} ${c.text} opacity-75`}
          >
            📚 {lesson.className}
          </span>
        )}

        {/* Teacher name — student/parent view */}
        {lesson.teacher && (
          <span
            className={`font-semibold ${compact ? "text-[9px]" : "text-[10px]"} ${c.text} opacity-75`}
          >
            👤 {lesson.teacher}
          </span>
        )}

        {/* Time + duration */}
        <span
          className={`font-medium opacity-60 ${compact ? "text-[9px]" : "text-[10px]"} ${c.text}`}
        >
          {formatTime(lesson.startTime)} – {formatTime(lesson.endTime)} ·{" "}
          {getDuration(lesson.startTime, lesson.endTime)}
        </span>
      </motion.div>
    );
  };

  return (
    <div className="w-full">
      {/* Day/Week switcher */}
      <div className="w-full overflow-x-auto pb-1 mb-5">
        <div className="flex gap-1.5 bg-gray-100 p-1 rounded-xl w-max">
          {isDesktop && (
            <button
              onClick={() => setViewMode("week")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap
                ${viewMode === "week" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-indigo-500"}`}
            >
              Week
            </button>
          )}
          {days.map((d) => (
            <button
              key={d}
              onClick={() => {
                setSelectedDay(d);
                setViewMode("day");
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap
                ${viewMode === "day" && selectedDay === d ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-indigo-500"}`}
            >
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{d.slice(0, 3)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* --- Legend --- only subjects in THIS timetable*/}
      {uniqueSubjects.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {uniqueSubjects.map((subject) => {
            const c = colorMap[subject] ?? COLOR_PALETTE[0];
            return (
              <div
                key={subject}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${c.bg} ${c.text}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`}
                />
                {subject}
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* ── WEEK VIEW ── */}
        {viewMode === "week" && (
          <motion.div
            key="week"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="w-full overflow-x-auto"
          >
            <div className="min-w-[640px] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Header row */}
              <div
                className="grid border-b border-gray-100"
                style={{ gridTemplateColumns: "64px repeat(5, 1fr)" }}
              >
                <div className="p-3 border-r border-gray-100" />
                {days.map((day) => (
                  <div
                    key={day}
                    className="p-3 text-center border-l border-gray-100"
                  >
                    <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                      {day.slice(0, 3)}
                    </p>
                    <p className="text-[10px] text-gray-300 mt-0.5">
                      {getLessonsForDay(lessons, day).length} period
                      {getLessonsForDay(lessons, day).length !== 1 ? "s" : ""}
                    </p>
                  </div>
                ))}
              </div>
              {/* Hour rows */}
              {hours.map((hour, hi) => (
                <div
                  key={hour}
                  className="grid border-b border-gray-50 last:border-b-0"
                  style={{ gridTemplateColumns: "64px repeat(5, 1fr)" }}
                >
                  <div className="flex items-start justify-end pr-3 pt-2.5 border-r border-gray-50">
                    <span className="text-[10px] font-bold text-gray-300">
                      {hour}:00
                    </span>
                  </div>
                  {days.map((day) => {
                    const lesson = getLessonAtHour(lessons, day, hour);
                    return (
                      <div
                        key={day}
                        className={`border-l border-gray-50 min-h-[72px] p-1 ${hi % 2 !== 0 ? "bg-gray-50/40" : ""}`}
                      >
                        {lesson && renderLessonCard(lesson, true)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── DAY VIEW ── */}
        {viewMode === "day" && (
          <motion.div
            key={`day-${selectedDay}`}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.22 }}
            className="w-full"
          >
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Day header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-gray-800 text-sm">
                    {selectedDay}
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {getLessonsForDay(lessons, selectedDay).length} period
                    {getLessonsForDay(lessons, selectedDay).length !== 1
                      ? "s"
                      : ""}
                    {viewAs === "teacher" && " across classes"}
                  </p>
                </div>
                {/* Prev / Next buttons */}
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      const i = days.indexOf(selectedDay);
                      if (i > 0) setSelectedDay(days[i - 1]);
                    }}
                    disabled={days.indexOf(selectedDay) === 0}
                    className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 transition-all text-lg leading-none"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => {
                      const i = days.indexOf(selectedDay);
                      if (i < days.length - 1) setSelectedDay(days[i + 1]);
                    }}
                    disabled={days.indexOf(selectedDay) === days.length - 1}
                    className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 transition-all text-lg leading-none"
                  >
                    ›
                  </button>
                </div>
              </div>

              {/* Hour slots */}
              <div className="divide-y divide-gray-50">
                {hours.map((hour) => {
                  const lesson = getLessonAtHour(lessons, selectedDay, hour);
                  const c = lesson
                    ? (colorMap[lesson.title] ?? COLOR_PALETTE[0])
                    : null;
                  return (
                    <div key={hour} className="flex items-stretch min-h-[64px]">
                      <div className="w-14 shrink-0 flex items-center justify-end pr-3">
                        <span className="text-[10px] font-bold text-gray-300">
                          {hour}:00
                        </span>
                      </div>
                      <div className="w-px bg-gray-100 shrink-0" />
                      <div className="flex-1 px-3 py-2 flex items-center min-w-0">
                        {lesson && c ? (
                          <div
                            className={`w-full rounded-xl border-l-4 px-3 py-2.5 ${c.bg} ${c.border}`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`}
                                />
                                <div className="min-w-0">
                                  <span
                                    className={`font-bold text-sm ${c.text}`}
                                  >
                                    {lesson.title}
                                  </span>
                                  {lesson.className && (
                                    <span
                                      className={`text-[11px] ml-2 ${c.text} opacity-70`}
                                    >
                                      · 📚 {lesson.className}
                                    </span>
                                  )}
                                  {lesson.teacher && (
                                    <span
                                      className={`text-[11px] ml-2 ${c.text} opacity-70`}
                                    >
                                      · 👤 {lesson.teacher}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span
                                className={`text-[11px] font-semibold shrink-0 ml-4 sm:ml-0 ${c.text} opacity-70`}
                              >
                                {formatTime(lesson.startTime)} –{" "}
                                {formatTime(lesson.endTime)} ·{" "}
                                {getDuration(lesson.startTime, lesson.endTime)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-8 rounded-lg bg-gray-50" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BigCalendar;
