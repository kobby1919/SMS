import prisma from "@/src/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import Announcements from "@/src/components/Announcements";
import EventCalendar from "@/src/components/EventCalendar";
import EventList from "@/src/components/EventList";
import ParentTimetableTabs from "@/src/components/ParentTimetableTabs";
import type { ChildSchedule } from "@/src/components/ParentTimetableTabs";
import type { CalendarLesson } from "@/src/components/BigCalendar";

const ParentPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const user = await currentUser();

  // Fetch ALL children for this parent — no take: 1 limit
  const parent = await prisma.parent.findUnique({
    where: { id: user!.id },
    include: {
      students: {
        include: {
          class: { select: { id: true, name: true } },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  // For each child, fetch their class timetable
  const childrenSchedules: ChildSchedule[] = await Promise.all(
    (parent?.students ?? []).map(async (child) => {
      const lessons = await prisma.lesson.findMany({
        where: { classId: child.classId },
        include: {
          subject: { select: { name: true } },
          teacher: { select: { name: true, surname: true } },
        },
        orderBy: [{ day: "asc" }, { startTime: "asc" }],
      });

      const calendarLessons: CalendarLesson[] = lessons.map((l) => ({
        title:    l.subject.name,
        day:      l.day,
        startTime: l.startTime,
        endTime:   l.endTime,
        teacher:  `${l.teacher.name} ${l.teacher.surname}`,
      }));

      return {
        id:        child.id,
        name:      child.name,
        surname:   child.surname,
        className: child.class.name,
        lessons:   calendarLessons,
      };
    })
  );

  return (
    <div className="p-4 flex gap-4 flex-col xl:flex-row">
      {/* LEFT — tabbed timetable per ward */}
      <div className="w-full xl:w-2/3">
        <ParentTimetableTabs children={childrenSchedules} />
      </div>

      {/* RIGHT — calendar & announcements */}
      <div className="w-full xl:w-1/3 flex flex-col gap-4">
        <EventCalendar />
        <EventList dateParam={searchParams.date} />
        <Announcements />
      </div>
    </div>
  );
};

export default ParentPage;