import prisma from "@/src/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AttendanceTaker from "@/src/components/AttendanceTaker";
import { Day } from "@/src/generated/prisma";


const TakeAttendancePage = async ({
  searchParams,
}: {
  searchParams: Promise<{ lessonId?: string; date?: string }>;
}) => {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (!["admin", "teacher"].includes(role!)) redirect("/");

  const user = await currentUser();
  const params = await searchParams;

  const todayStr = new Date().toISOString().split("T")[0];
  const dateStr = params.date ?? todayStr;
  const lessonId = params.lessonId ? parseInt(params.lessonId) : null;

  // 1. Calculate the day of the week
  const dayOfWeekStr = new Date(dateStr)
    .toLocaleDateString("en-US", { weekday: "long" })
    .toUpperCase();

  // 2. CHECK FOR WEEKENDS: Prevent the Prisma error if today is Saturday or Sunday
  const isWeekend = dayOfWeekStr === "SATURDAY" || dayOfWeekStr === "SUNDAY";

  let teacherLessons: any[] = [];

  if (!isWeekend) {
    teacherLessons = await prisma.lesson.findMany({
      where: {
        teacherId: user!.id,
        day: dayOfWeekStr as Day, // Cast to the Enum type safely
      },
      include: {
        subject: { select: { name: true } },
        class: { select: { id: true, name: true } },
      },
      orderBy: { startTime: "asc" },
    });
  }

  // If a lesson is selected, fetch its students + existing attendance
  let selectedLesson = null;
  let students: any[] = [];
  let existingAttendance: any[] = [];

  // Only proceed with lesson details if it's a weekday and we have an ID
  if (lessonId && !isWeekend) {
    selectedLesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        subject: { select: { name: true } },
        class: { select: { id: true, name: true } },
      },
    });

    if (selectedLesson) {
      students = await prisma.student.findMany({
        where: { classId: selectedLesson.classId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, surname: true, img: true },
      });

      const dayStart = new Date(dateStr);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dateStr);
      dayEnd.setHours(23, 59, 59, 999);

      existingAttendance = await prisma.attendance.findMany({
        where: {
          lessonId,
          date: { gte: dayStart, lte: dayEnd },
        },
        select: { studentId: true, status: true, note: true },
      });
    }
  }

  return (
    <div className="flex-1 m-4 mt-0">
      {isWeekend ? (
        <div className="flex flex-col items-center justify-center h-[50vh] bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="text-4xl mb-4">🏖️</div>
          <h2 className="text-xl font-bold text-gray-800">It&apos;s the Weekend!</h2>
          <p className="text-gray-500 max-w-xs mt-2">
            No lessons are scheduled for {dayOfWeekStr.toLowerCase()}. You can only take attendance on school days (Mon-Fri).
          </p>
        </div>
      ) : (
        <AttendanceTaker
          teacherLessons={teacherLessons.map((l) => ({
            id: l.id,
            subjectName: l.subject.name,
            className: l.class.name,
            classId: l.classId,
            startTime: l.startTime.toISOString(),
            endTime: l.endTime.toISOString(),
            day: l.day,
          }))}
          selectedLessonId={lessonId}
          selectedLesson={
            selectedLesson
              ? {
                  id: selectedLesson.id,
                  subjectName: selectedLesson.subject.name,
                  className: selectedLesson.class.name,
                }
              : null
          }
          students={students}
          existingAttendance={existingAttendance}
          dateStr={dateStr}
          todayStr={todayStr}
          role={role!}
        />
      )}
    </div>
  );
};

export default TakeAttendancePage;