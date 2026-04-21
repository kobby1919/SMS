import prisma from "@/src/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import Announcements from "@/src/components/Announcements";
import EventCalendar from "@/src/components/EventCalendar";
import EventList from "@/src/components/EventList";
import BigCalendar from "@/src/components/BigCalendar";
import type { CalendarLesson } from "@/src/components/BigCalendar";

const TeacherPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const user = await currentUser();

  // Fetch this teacher's lessons with subject + class info
  const lessons = await prisma.lesson.findMany({
    where: { teacherId: user!.id },
    include: {
      subject: { select: { name: true } },
      class:   { select: { name: true } },
    },
  });

  // Shape into CalendarLesson format
  const calendarLessons: CalendarLesson[] = lessons.map((l) => ({
    title:     l.subject?.name ?? l.name,
    day:       l.day,               // "MONDAY" etc
    startTime: l.startTime,
    endTime:   l.endTime,
    className: l.class.name,        // e.g. "4A" — shown in calendar slot
  }));

  const teacherName = user?.firstName ?? "Teacher";

  return (
    <div className="p-4 flex gap-4 flex-col xl:flex-row">
      {/* LEFT */}
      <div className="w-full xl:w-2/3">
        <div className="bg-white p-5 rounded-2xl shadow-sm">
          <div className="mb-4">
            <h1 className="text-xl font-nunito font-extrabold text-gray-800">
              My Schedule
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {teacherName} — weekly timetable
            </p>
          </div>
          <BigCalendar lessons={calendarLessons} />
        </div>
      </div>
      {/* RIGHT */}
      <div className="w-full xl:w-1/3 flex flex-col gap-4">
        <EventCalendar />
        <EventList dateParam={searchParams.date} />
        <Announcements />
      </div>
    </div>
  );
};

export default TeacherPage;
