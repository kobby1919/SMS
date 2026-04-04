"use client";

import { calendarEvents } from "../lib/data";
import { useState } from "react";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16];

const colors = [
  "bg-[#e2f8ff] text-[#0ea5e9]",
  "bg-[#fefce8] text-[#ca8a04]",
  "bg-[#fdf2fb] text-[#d946ef]",
  "bg-[#f2f1ff] text-[#7c3aed]",
  "bg-[#dcfce7] text-[#16a34a]",
  "bg-[#fff7ed] text-[#ea580c]",
];

const subjectList = ["Math", "English", "Biology", "Physics", "Chemistry", "History"];

const getColor = (title: string) => {
  const index = subjectList.indexOf(title);
  return index !== -1 ? colors[index] : colors[0];
};

const getEvent = (day: string, hour: number) => {
  return calendarEvents.find((event) => {
    const eventDay = new Date(event.start).toLocaleDateString("en-US", {
      weekday: "long",
    });
    const eventHour = new Date(event.start).getHours();
    return eventDay === day && eventHour === hour;
  });
};

const BigCalendar = () => {
  const [selectedDay, setSelectedDay] = useState<string>(() => {
  if (typeof window !== "undefined" && window.innerWidth < 768) {
    return "Monday";
  }
  return "all";
});

  return (
    <div className="w-full">
      {/* DAY TOGGLE BUTTONS */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setSelectedDay("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            selectedDay === "all"
              ? "bg-[#dbdafe] text-[#4338ca]"
              : "bg-[#f1f0ff] text-gray-500 hover:bg-[#dbdafe] hover:text-[#4338ca]"
          }`}
        >
          Week
        </button>
        {days.map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedDay === day
                ? "bg-[#dbdafe] text-[#4338ca]"
                : "bg-[#f1f0ff] text-gray-500 hover:bg-[#dbdafe] hover:text-[#4338ca]"
            }`}
          >
            {day.slice(0, 3)}
          </button>
        ))}
      </div>

      {/* TIMETABLE - day view on mobile, week view on larger screens */}
      {selectedDay === "all" ? (
        // WEEK VIEW - scrollable on mobile
        <div className="w-full overflow-x-auto rounded-xl">
          <table className="border-collapse" style={{ minWidth: "600px", width: "100%" }}>
            <thead>
              <tr>
                <th className="w-12 p-2"></th>
                {days.map((day) => (
                  <th
                    key={day}
                    className="text-xs text-gray-500 font-semibold p-2 text-center uppercase tracking-wide"
                  >
                    {day.slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hours.map((hour) => (
                <tr key={hour} className="border-t border-gray-100">
                  <td className="text-xs text-gray-400 p-2 text-right align-middle w-12 whitespace-nowrap">
                    {hour}:00
                  </td>
                  {days.map((day) => {
                    const event = getEvent(day, hour);
                    return (
                      <td key={day} className="p-1 align-middle h-16">
                        {event ? (
                          <div className={`w-full h-full rounded-xl p-2 flex flex-col justify-center gap-0.5 ${getColor(event.title)}`}>
                            <span className="font-bold text-xs leading-tight">{event.title}</span>
                            <span className="text-xs opacity-60">
                              {new Date(event.start).getHours()}:
                              {String(new Date(event.start).getMinutes()).padStart(2, "0")}
                              {" - "}
                              {new Date(event.end).getHours()}:
                              {String(new Date(event.end).getMinutes()).padStart(2, "0")}
                            </span>
                          </div>
                        ) : (
                          <div className="w-full h-full rounded-xl bg-gray-50" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // DAY VIEW - full width, large cells, perfect for mobile
        <div className="w-full rounded-xl">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {selectedDay}
          </h2>
          <div className="flex flex-col gap-2">
            {hours.map((hour) => {
              const event = getEvent(selectedDay, hour);
              return (
                <div key={hour} className="flex items-stretch gap-3">
                  {/* TIME */}
                  <div className="w-12 text-xs text-gray-400 text-right pt-4 shrink-0">
                    {hour}:00
                  </div>
                  {/* EVENT */}
                  <div className="flex-1 min-h-[72px]">
                    {event ? (
                      <div className={`w-full h-full rounded-xl p-4 flex flex-col justify-center gap-1 ${getColor(event.title)}`}>
                        <span className="font-bold text-base leading-tight">
                          {event.title}
                        </span>
                        <span className="text-sm opacity-60 font-medium">
                          {new Date(event.start).getHours()}:
                          {String(new Date(event.start).getMinutes()).padStart(2, "0")}
                          {" - "}
                          {new Date(event.end).getHours()}:
                          {String(new Date(event.end).getMinutes()).padStart(2, "0")}
                        </span>
                      </div>
                    ) : (
                      <div className="w-full h-full rounded-xl bg-gray-50 min-h-[72px]" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default BigCalendar;