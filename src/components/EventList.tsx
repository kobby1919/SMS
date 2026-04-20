import prisma from "@/src/lib/prisma";
import { CalendarDays } from "lucide-react";

const colorMap = [
  "bg-jaySkyLight border-l-4 border-jaySky",
  "bg-jayPurpleLight border-l-4 border-jayPurple",
  "bg-jayYellowLight border-l-4 border-jayYellow",
];
const dotMap = ["bg-jaySky", "bg-jayPurple", "bg-jayYellow"];

const EventList = async ({ dateParam }: { dateParam: string | undefined }) => {
  // Parse the date from URL param, fallback to today
  const date = dateParam ? new Date(dateParam) : new Date();
  const start = new Date(date); start.setHours(0,  0,  0, 0);
  const end   = new Date(date); end.setHours(23, 59, 59, 999);

  const events = await prisma.event.findMany({
    where: {
      startTime: { gte: start, lte: end },
    },
    orderBy: { startTime: "asc" },
  });

  const formatTime = (d: Date) =>
    new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const displayDate = date.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-nunito font-extrabold text-base text-gray-800">Events</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">{displayDate}</p>
        </div>
        <span className="text-xs text-jayPurple font-semibold cursor-pointer hover:underline">View All</span>
      </div>

      {/* Events */}
      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <CalendarDays size={32} className="text-gray-200" />
          <p className="text-sm text-gray-400 font-medium">No events on this day</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((event, i) => (
            <div
              key={event.id}
              className={`p-3 rounded-xl ${colorMap[i % colorMap.length]}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${dotMap[i % dotMap.length]}`} />
                  <h2 className="font-semibold text-sm text-gray-700">{event.title}</h2>
                </div>
                <span className="text-[10px] text-gray-400 font-medium">
                  {formatTime(event.startTime)} – {formatTime(event.endTime)}
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed pl-4 line-clamp-2">
                {event.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventList;
