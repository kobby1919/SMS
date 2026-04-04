"use client";

import { calendarEvents } from "../lib/data";
import { useState, useEffect, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16];

const subjectColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Math:      { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200",   dot: "bg-blue-400" },
  English:   { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  dot: "bg-amber-400" },
  Biology:   { bg: "bg-emerald-50",text: "text-emerald-700",border: "border-emerald-200",dot: "bg-emerald-400" },
  Physics:   { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", dot: "bg-violet-400" },
  Chemistry: { bg: "bg-rose-50",   text: "text-rose-700",   border: "border-rose-200",   dot: "bg-rose-400" },
  History:   { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-400" },
};

const getEvent = (dayName: string, hour: number) =>
  calendarEvents.find((event) => {
    const d = new Date(event.start);
    const eventDayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()];
    return eventDayName === dayName && d.getHours() === hour;
  });

const formatTime = (date: Date) => `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;

const BigCalendar = () => {
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [isMobile, setIsMobile] = useState(false);

  // Sync mobile/desktop view on mount and resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      // On mobile, we force a day if "all" is selected
      if (mobile && selectedDay === "all") {
        setSelectedDay("Monday");
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [selectedDay]);

  const allTabs = ["all", ...days];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6">
      
      {/* ── UNIFIED SELECTOR (Works for both Mobile & Desktop) ── */}
      <div className={`flex gap-2 mb-8 items-center bg-gray-100 p-1.5 rounded-2xl w-fit max-w-full overflow-x-auto no-scrollbar`}>
        {allTabs.map((d) => {
          // Hide "Whole Week" button on mobile to save space
          if (isMobile && d === "all") return null;

          const isActive = selectedDay === d;
          return (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={`relative px-6 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all duration-300 z-10 whitespace-nowrap
                ${isActive ? "text-white" : "text-gray-500 hover:text-indigo-600"}`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabHighlight"
                  className="absolute inset-0 bg-indigo-600 shadow-md rounded-xl -z-10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              {d === "all" ? "Whole Week" : d.slice(0, 3)}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {selectedDay === "all" ? (
          /* ── DESKTOP GRID VIEW ── */
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="hidden lg:block bg-white border border-gray-100 rounded-3xl p-6 shadow-sm"
          >
            <div className="grid grid-cols-[80px_repeat(5,1fr)] gap-2">
              <div /> {/* Corner spacer */}
              {days.map(day => (
                <div key={day} className="text-center pb-4 text-xs font-black uppercase tracking-widest text-gray-400">
                  {day}
                </div>
              ))}
              
              {hours.map(hour => (
                <Fragment key={`row-${hour}`}>
                  <div className="pr-4 text-right text-xs font-bold text-gray-300 py-6">
                    {hour}:00
                  </div>
                  {days.map(day => {
                    const event = getEvent(day, hour);
                    const c = event ? subjectColors[event.title] : null;
                    return (
                      <div key={`${day}-${hour}`} className="relative border-t border-gray-50 min-h-[100px] p-1">
                        {event && (
                          <motion.div
                            whileHover={{ scale: 1.03, zIndex: 10 }}
                            className={`h-full w-full rounded-xl border-2 p-3 flex flex-col justify-center cursor-pointer shadow-sm ${c?.bg} ${c?.text} ${c?.border}`}
                          >
                            <span className="font-black text-sm leading-tight mb-1">{event.title}</span>
                            <span className="text-[11px] font-bold opacity-70">{formatTime(event.start)} - {formatTime(event.end)}</span>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </motion.div>
        ) : (
          /* ── SINGLE DAY LIST VIEW (Mobile & Desktop Tab) ── */
          /* ── MOBILE/SINGLE DAY LIST VIEW ── */
<motion.div
  key={`list-${selectedDay}`}
  initial={{ opacity: 0, x: 20 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -20 }}
  className="flex flex-col gap-4 max-w-4xl mx-auto"
>
  <h2 className="text-xl font-black text-gray-800 lg:hidden px-2 mb-2">{selectedDay}</h2>
  
  {hours.map((hour) => {
    const event = getEvent(selectedDay, hour);
    const c = event ? subjectColors[event.title] : null;
    
    return (
      <div key={`list-row-${hour}`} className="flex gap-3 sm:gap-6 group">
        {/* Time Label - Shrunk slightly for mobile */}
        <div className="w-10 sm:w-14 pt-3 text-right text-[10px] sm:text-sm font-bold text-gray-300">
          {hour}:00
        </div>

        <div className="flex-1 min-w-0"> {/* min-w-0 is crucial for text-truncate/wrap inside flex */}
          {event ? (
            <motion.div 
              layout
              className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-2 shadow-sm h-auto ${c?.bg} ${c?.text} ${c?.border}`}
            >
              {/* Stacked on mobile, side-by-side on tablet+ */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4">
                
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${c?.dot}`} />
                  <span className="font-black text-lg sm:text-2xl leading-tight break-words">
                    {event.title}
                  </span>
                </div>

                <div className="flex items-center">
                  <span className="text-[11px] sm:text-base font-bold bg-white/60 px-3 py-1 rounded-full whitespace-nowrap shadow-sm border border-black/5">
                    {formatTime(event.start)} — {formatTime(event.end)}
                  </span>
                </div>

              </div>
            </motion.div>
          ) : (
            /* Empty slot height reduced for mobile to keep scroll length manageable */
            <div className="h-12 sm:h-16 border-b border-gray-100 border-dashed" />
          )}
        </div>
      </div>
    );
  })}
</motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BigCalendar;