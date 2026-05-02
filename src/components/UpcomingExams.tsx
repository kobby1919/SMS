// src/components/UpcomingExams.tsx


import prisma from "@/src/lib/prisma";
import { Calendar, Clock } from "lucide-react";
import Link from "next/link";

const getCountdownColor = (date: Date) => {
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days <= 1) return "bg-rose-50 text-rose-600";
  if (days <= 3) return "bg-amber-50 text-amber-600";
  return "bg-emerald-50 text-emerald-600";
};

const getCountdown = (date: Date) => {
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days}d`;
};

type Props = {
  teacherId: string;
};

const UpcomingExams = async ({ teacherId }: Props) => {
  const exams = await prisma.exam.findMany({
    where: {
      startTime:    { gte: new Date() },
      lesson: { teacherId },
    },
    include: {
      lesson: {
        select: {
          subject: { select: { name: true } },
          class:   { select: { name: true } },
        },
      },
    },
    orderBy: { startTime: "asc" },
    take: 4,
  });

  const formatDate = (d: Date) =>
    new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "short" }).format(d);

  const formatTime = (d: Date) =>
    new Intl.DateTimeFormat("en-GH", { hour: "2-digit", minute: "2-digit" }).format(d);

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
            <Calendar size={15} className="text-amber-600" />
          </div>
          <h2 className="font-nunito font-extrabold text-base text-gray-800">Upcoming Exams</h2>
        </div>
        <Link
          href="/list/exams"
          className="text-xs text-indigo-500 font-bold hover:text-indigo-700 transition-colors"
        >
          View All →
        </Link>
      </div>

      {exams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <Calendar size={28} className="text-gray-200" />
          <p className="text-sm text-gray-400 font-medium">No upcoming exams</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-indigo-50/40 transition-colors"
            >
              {/* Countdown badge */}
              <span className={`text-[10px] font-black px-2 py-1 rounded-lg shrink-0 ${getCountdownColor(exam.startTime)}`}>
                {getCountdown(exam.startTime)}
              </span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-800 truncate">
                  {exam.lesson.subject.name}
                  <span className="font-semibold text-gray-400 ml-1.5 text-xs">· {exam.lesson.class.name}</span>
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Clock size={10} className="text-gray-400" />
                  <span className="text-[11px] text-gray-400 font-medium">
                    {formatDate(exam.startTime)} · {formatTime(exam.startTime)} – {formatTime(exam.endTime)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UpcomingExams;