"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const events = [
  {
    id: 1,
    title: "Science Fair",
    time: "10:00 AM - 12:00 PM",
    description: "Annual science fair for all grade 5 and 6 students.",
    color: "bg-jaySkyLight border-l-4 border-jaySky",
    dot: "bg-jaySky",
  },
  {
    id: 2,
    title: "PTA Meeting",
    time: "2:00 PM - 4:00 PM",
    description: "Quarterly meeting with parents and teachers.",
    color: "bg-jayPurpleLight border-l-4 border-jayPurple",
    dot: "bg-jayPurple",
  },
  {
    id: 3,
    title: "Sports Day",
    time: "8:00 AM - 3:00 PM",
    description: "Inter-house sports competition for all students.",
    color: "bg-jayYellowLight border-l-4 border-jayYellow",
    dot: "bg-jayYellow",
  },
];

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const EventCalendar = () => {
  // Use null or static defaults initially to prevent mismatch
  const [mounted, setMounted] = useState(false);
  const [current, setCurrent] = useState({
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
  });
  const [selected, setSelected] = useState(new Date().getDate());

  // Force a re-render after mount to ensure client-side dates are used
  useEffect(() => {
    setMounted(true);
    const today = new Date();
    setCurrent({ month: today.getMonth(), year: today.getFullYear() });
    setSelected(today.getDate());
  }, []);

  // Avoid rendering date-specific UI until mounted to prevent hydration errors
  if (!mounted)
    return <div className="bg-white p-5 rounded-2xl shadow-sm h-[400px]" />;

  const today = new Date();
  const firstDay = new Date(current.year, current.month, 1).getDay();
  const daysInMonth = new Date(current.year, current.month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrent((c) =>
      c.month === 0
        ? { month: 11, year: c.year - 1 }
        : { month: c.month - 1, year: c.year },
    );
  };

  const nextMonth = () => {
    setCurrent((c) =>
      c.month === 11
        ? { month: 0, year: c.year + 1 }
        : { month: c.month + 1, year: c.year },
    );
  };

  const cells = [
    ...Array(firstDay).fill(null),
    ...Array(daysInMonth).keys(),
  ].map((v) => (v === null ? null : v + 1));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white p-5 rounded-2xl shadow-sm"
    >
      {/* CALENDAR HEADER */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-nunito font-extrabold text-base text-gray-800">
          {MONTHS[current.month]} {current.year}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-jayPurpleLight text-gray-500 hover:text-jayPurple transition-colors text-sm"
          >
            ‹
          </button>
          <button
            onClick={nextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-jayPurpleLight text-gray-500 hover:text-jayPurple transition-colors text-sm"
          >
            ›
          </button>
        </div>
      </div>

      {/* DAY HEADERS */}
      <div className="grid grid-cols-7 mb-2">
        {DAYS.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-bold text-gray-400 uppercase"
          >
            {d}
          </div>
        ))}
      </div>

      {/* DATE CELLS */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          const isToday =
            day === today.getDate() &&
            current.month === today.getMonth() &&
            current.year === today.getFullYear();
          const isSelected = day === selected;

          return (
            <div key={i} className="flex items-center justify-center">
              {day ? (
                <button
                  onClick={() => setSelected(day)}
                  className={`w-8 h-8 rounded-full text-xs font-medium transition-all
                    ${isSelected ? "bg-jayPurple text-white font-bold" : ""}
                    ${isToday && !isSelected ? "ring-2 ring-jayPurple text-jayPurple font-bold" : ""}
                    ${!isToday && !isSelected ? "text-gray-600 hover:bg-gray-100" : ""}
                  `}
                >
                  {day}
                </button>
              ) : (
                <div className="w-8 h-8" />
              )}
            </div>
          );
        })}
      </div>

      {/* EVENTS HEADER */}
      <div className="flex items-center justify-between mt-6 mb-3">
        <h1 className="font-nunito font-extrabold text-lg text-gray-800">
          Upcoming Events
        </h1>
        <span className="text-xs text-jayPurple font-semibold cursor-pointer hover:underline">
          View All
        </span>
      </div>

      {/* EVENTS LIST */}
      <div className="flex flex-col gap-3">
        {events.map((event, i) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`p-3 rounded-xl ${event.color}`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${event.dot}`} />
                <h2 className="font-semibold text-sm text-gray-700">
                  {event.title}
                </h2>
              </div>
              <span className="text-[10px] text-gray-400 font-medium">
                {event.time}
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed pl-4">
              {event.description}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default EventCalendar;
