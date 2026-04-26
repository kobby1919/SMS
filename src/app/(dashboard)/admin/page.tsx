// src/app/(dashboard)/admin/page.tsx

import prisma from "@/src/lib/prisma";
import AdminDashboard from "@/src/components/AdminDashboard";
import EventList from "@/src/components/EventList";
import Announcements from "@/src/components/Announcements";

// ✅ CRITICAL FIX: Force this page to always server-render fresh on every request.
// Without this, Next.js statically caches the page at build time and the
// attendance chart (and all other data) never updates on refresh.
export const dynamic = "force-dynamic";

const DAY_ENUM_MAP: Record<number, string> = {
  1: "MONDAY", 2: "TUESDAY", 3: "WEDNESDAY", 4: "THURSDAY", 5: "FRIDAY",
};

const AdminPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const currentYear = new Date().getFullYear();
  const now         = new Date();

  // Last 5 school days for attendance chart
  const weekDays: { label: string; date: Date }[] = [];
  let d = new Date();
  while (weekDays.length < 5) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      weekDays.unshift({ label: d.toLocaleDateString("en-US", { weekday: "short" }), date: new Date(d) });
    }
    d.setDate(d.getDate() - 1);
  }

  const months     = Array.from({ length: 12 }, (_, i) => i);
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const todayJsDay = now.getDay();
  const todayEnum  = DAY_ENUM_MAP[todayJsDay] ?? "MONDAY";
  const todayLabel = now.toLocaleDateString("en-US", { weekday: "long" });

  // Today boundaries
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const [
    adminCount, teacherCount, studentCount, parentCount,
    boyCount, girlCount,
    totalLessons, totalClasses, todayLessons,
    todayPresent, todayAbsent, todayLate, todayExcused,
    totalStudents,
  ] = await Promise.all([
    prisma.admin.count(),
    prisma.teacher.count(),
    prisma.student.count(),
    prisma.parent.count(),
    prisma.student.count({ where: { sex: "MALE" } }),
    prisma.student.count({ where: { sex: "FEMALE" } }),
    prisma.lesson.count(),
    prisma.class.count(),
    prisma.lesson.count({ where: { day: todayEnum as any } }),
    prisma.attendance.count({ where: { date: { gte: todayStart, lte: todayEnd }, status: "PRESENT" } }),
    prisma.attendance.count({ where: { date: { gte: todayStart, lte: todayEnd }, status: "ABSENT"  } }),
    prisma.attendance.count({ where: { date: { gte: todayStart, lte: todayEnd }, status: "LATE"    } }),
    prisma.attendance.count({ where: { date: { gte: todayStart, lte: todayEnd }, status: "EXCUSED" } }),
    prisma.student.count(),
  ]);

  // Attendance chart data — last 5 school days
  const attendanceData = await Promise.all(
    weekDays.map(async ({ label, date }) => {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end   = new Date(date); end.setHours(23, 59, 59, 999);
      const [present, absent] = await Promise.all([
        prisma.attendance.count({ where: { date: { gte: start, lte: end }, status: "PRESENT" } }),
        prisma.attendance.count({ where: { date: { gte: start, lte: end }, status: "ABSENT"  } }),
      ]);
      return { name: label, present, absent };
    })
  );

  // Finance data
  const financeData = await Promise.all(
    months.map(async (i) => {
      const start = new Date(currentYear, i, 1);
      const end   = new Date(currentYear, i + 1, 0, 23, 59, 59);
      const [examAvg, assignAvg] = await Promise.all([
        prisma.result.aggregate({ _avg: { score: true }, where: { exam:       { startTime: { gte: start, lte: end } } } }),
        prisma.result.aggregate({ _avg: { score: true }, where: { assignment: { dueDate:   { gte: start, lte: end } } } }),
      ]);
      return {
        name:    monthNames[i],
        income:  Math.round(examAvg._avg.score   ?? 0),
        expense: Math.round(assignAvg._avg.score ?? 0),
      };
    })
  );

  // Flagged students (3+ consecutive absences)
  const allStudents = await prisma.student.findMany({
    select: { id: true, name: true, surname: true, class: { select: { name: true } } },
  });
  const flagged: { name: string; surname: string; className: string; streak: number }[] = [];
  for (const student of allStudents) {
    const recent = await prisma.attendance.findMany({
      where:   { studentId: student.id },
      orderBy: { date: "desc" },
      take:    5,
      select:  { status: true },
    });
    let streak = 0;
    for (const r of recent) {
      if (r.status === "ABSENT") streak++;
      else break;
    }
    if (streak >= 3) flagged.push({ ...student, className: student.class.name, streak });
  }

  const todayTotal = todayPresent + todayAbsent + todayLate + todayExcused;
  const todayRate  = todayTotal > 0 ? Math.round((todayPresent / todayTotal) * 100) : 0;

  return (
    <AdminDashboard
      counts={[
        { type: "admin",   count: adminCount   },
        { type: "teacher", count: teacherCount },
        { type: "student", count: studentCount },
        { type: "parent",  count: parentCount  },
      ]}
      boys={boyCount}
      girls={girlCount}
      attendanceData={attendanceData}
      financeData={financeData}
      eventList={<EventList dateParam={searchParams.date} />}
      announcements={<Announcements />}
      timetableSnapshot={{ totalLessons, totalClasses, todayLessons, todayDay: todayLabel }}
      attendanceSnapshot={{
        todayPresent, todayAbsent, todayLate, todayExcused,
        todayRate, totalStudents, flaggedCount: flagged.length,
        flagged: flagged.slice(0, 5),
      }}
    />
  );
};

export default AdminPage;
