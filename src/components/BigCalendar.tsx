"use client";

import { calendarEvents } from "../lib/data";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16];

const subjectColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Math:      { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-l-blue-400",    dot: "bg-blue-400" },
  English:   { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-l-amber-400",   dot: "bg-amber-400" },
  Biology:   { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-l-emerald-400", dot: "bg-emerald-400" },
  Physics:   { bg: "bg-violet-50",  text: "text-violet-700",  border: "border-l-violet-400",  dot: "bg-violet-400" },
  Chemistry: { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-l-rose-400",    dot: "bg-rose-400" },
  History:   { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-l-orange-400",  dot: "bg-orange-400" },
};

const defaultColor = { bg: "bg-sky-50", text: "text-sky-700", border: "border-l-sky-400", dot: "bg-sky-400" };
const getColor = (title: string) => subjectColors[title] ?? defaultColor;

const getDayIndex = (dayName: string) => days.indexOf(dayName);

const getEventsForDay = (dayName: string) => {
  const dayIndex = getDayIndex(dayName);
  return calendarEvents.filter((e) => new Date(e.start).getDay() === dayIndex + 1);
};

const getEvent = (dayName: string, hour: number) => {
  const dayIndex = getDayIndex(dayName);
  return calendarEvents.find(
    (e) => new Date(e.start).getDay() === dayIndex + 1 && new Date(e.start).getHours() === hour
  );
};

const formatTime = (date: Date) =>
  `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;

const BigCalendar = () => {
  const [selectedDay, setSelectedDay] = useState<string>("Monday");
  const [viewMode, setViewMode] = useState<"week" | "day">("day");
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const check = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);
      if (desktop) setViewMode("week");
      else setViewMode("day");
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div className="w-full">

      {/* ── Day / Week switcher ── */}
      {/* Scrollable row — never wraps, never overflows the screen */}
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
              onClick={() => { setSelectedDay(d); setViewMode("day"); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap
                ${viewMode === "day" && selectedDay === d
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-400 hover:text-indigo-500"
                }`}
            >
              {/* Full name on desktop, 3-letter on mobile */}
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{d.slice(0, 3)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Subject legend — wraps naturally ── */}
      <div className="flex flex-wrap gap-2 mb-5">
        {Object.entries(subjectColors).map(([subject, c]) => (
          <div key={subject} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${c.bg} ${c.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
            {subject}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ══ WEEK VIEW (desktop only) ══ */}
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
              {/* Header */}
              <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: "56px repeat(5, 1fr)" }}>
                <div />
                {days.map((day) => (
                  <div key={day} className="p-3 text-center border-l border-gray-100">
                    <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{day.slice(0, 3)}</p>
                    <p className="text-[10px] text-gray-300 mt-0.5">{getEventsForDay(day).length} cls</p>
                  </div>
                ))}
              </div>

              {/* Rows */}
              {hours.map((hour, hi) => (
                <div
                  key={hour}
                  className="grid border-b border-gray-50 last:border-b-0"
                  style={{ gridTemplateColumns: "56px repeat(5, 1fr)" }}
                >
                  <div className="flex items-start justify-end pr-2 pt-2.5">
                    <span className="text-[10px] font-bold text-gray-300">{hour}:00</span>
                  </div>
                  {days.map((day) => {
                    const event = getEvent(day, hour);
                    const c = event ? getColor(event.title) : null;
                    return (
                      <div key={day} className={`border-l border-gray-50 min-h-[68px] p-1 ${hi % 2 !== 0 ? "bg-gray-50/40" : ""}`}>
                        {event && c && (
                          <motion.div
                            whileHover={{ scale: 1.02 }}
                            className={`h-full min-h-[56px] rounded-xl border-l-4 px-2 py-2 flex flex-col justify-center gap-1 cursor-default ${c.bg} ${c.border}`}
                          >
                            <span className={`font-bold text-xs leading-snug ${c.text}`}>{event.title}</span>
                            <span className={`text-[10px] font-medium opacity-60 ${c.text}`}>
                              {formatTime(new Date(event.start))} – {formatTime(new Date(event.end))}
                            </span>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ══ DAY VIEW ══ */}
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

              {/* Card header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-gray-800 text-sm">{selectedDay}</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {getEventsForDay(selectedDay).length} classes today
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { const i = days.indexOf(selectedDay); if (i > 0) setSelectedDay(days[i - 1]); }}
                    disabled={days.indexOf(selectedDay) === 0}
                    className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 transition-all text-lg leading-none"
                  >‹</button>
                  <button
                    onClick={() => { const i = days.indexOf(selectedDay); if (i < days.length - 1) setSelectedDay(days[i + 1]); }}
                    disabled={days.indexOf(selectedDay) === days.length - 1}
                    className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 transition-all text-lg leading-none"
                  >›</button>
                </div>
              </div>

              {/* Slots */}
              <div className="divide-y divide-gray-50">
                {hours.map((hour) => {
                  const event = getEvent(selectedDay, hour);
                  const c = event ? getColor(event.title) : null;
                  return (
                    <div key={hour} className="flex items-stretch min-h-[60px]">

                      {/* Hour label */}
                      <div className="w-14 shrink-0 flex items-center justify-end pr-3">
                        <span className="text-[10px] font-bold text-gray-300">{hour}:00</span>
                      </div>

                      <div className="w-px bg-gray-100 shrink-0" />

                      {/* Event or empty */}
                      <div className="flex-1 px-3 py-2 flex items-center min-w-0">
                        {event && c ? (
                          <div className={`w-full rounded-xl border-l-4 px-3 py-2.5 ${c.bg} ${c.border}`}>
                            {/* Stack vertically on very small screens */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                                <span className={`font-bold text-sm leading-tight ${c.text}`}>
                                  {event.title}
                                </span>
                              </div>
                              <span className={`text-[11px] font-semibold ml-4 sm:ml-0 shrink-0 ${c.text} opacity-70`}>
                                {formatTime(new Date(event.start))} – {formatTime(new Date(event.end))}
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
