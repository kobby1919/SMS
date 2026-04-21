import prisma from "@/src/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import Announcements from "@/src/components/Announcements";
import EventCalendar from "@/src/components/EventCalendar";
import EventList from "@/src/components/EventList";
import BigCalendar from "@/src/components/BigCalendar";
import type { CalendarLesson } from "@/src/components/BigCalendar";

const ParentPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const user = await currentUser();

  // Get parent's first child (can be extended to support multiple later)
  const parent = await prisma.parent.findUnique({
    where: { id: user!.id },
    include: {
      students: {
        take: 1,
        include: {
          class: { select: { name: true } },
        },
      },
    },
  });

  const child = parent?.students[0];

  // Fetch lessons for child's class
  const lessons = child
    ? await prisma.lesson.findMany({
        where: { classId: child.classId },
        include: {
          subject: { select: { name: true } },
          teacher: { select: { name: true, surname: true } },
        },
      })
    : [];

  const calendarLessons: CalendarLesson[] = lessons.map((l) => ({
    title:     l.subject?.name ?? l.name,
    day:       l.day,
    startTime: l.startTime,
    endTime:   l.endTime,
    teacher:   `${l.teacher.name} ${l.teacher.surname}`,
  }));

  const childName = child ? `${child.name} ${child.surname}` : "Child";

  return (
    <div className="p-4 flex gap-4 flex-col xl:flex-row">
      {/* LEFT */}
      <div className="w-full xl:w-2/3">
        <div className="bg-white p-5 rounded-2xl shadow-sm">
          <div className="mb-4">
            <h1 className="text-xl font-nunito font-extrabold text-gray-800">
              {childName}&apos;s Schedule
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Class {child?.class?.name ?? ""} — weekly timetable
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

export default ParentPage;
