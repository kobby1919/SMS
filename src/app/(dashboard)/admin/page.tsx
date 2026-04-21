import prisma from "@/src/lib/prisma";
import AdminDashboard from "@/src/components/AdminDashboard";
import EventList from "@/src/components/EventList";
import Announcements from "@/src/components/Announcements";

// Day enum → JS day index (0=Sun)
const DAY_ENUM_MAP: Record<number, string> = {
  1: "MONDAY", 2: "TUESDAY", 3: "WEDNESDAY", 4: "THURSDAY", 5: "FRIDAY",
};

const AdminPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const currentYear = new Date().getFullYear();

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

  // ── TODAY's day enum ────────────────────────────────────────────────────────
  const todayJsDay  = new Date().getDay(); // 0=Sun, 1=Mon...
  const todayEnum   = DAY_ENUM_MAP[todayJsDay] ?? "MONDAY";
  const todayLabel  = new Date().toLocaleDateString("en-US", { weekday: "long" });

  const [
    adminCount, teacherCount, studentCount, parentCount,
    boyCount, girlCount,
    totalLessons, totalClasses, todayLessons,
  ] = await Promise.all([
    prisma.admin.count(),
    prisma.teacher.count(),
    prisma.student.count(),
    prisma.parent.count(),
    prisma.student.count({ where: { sex: "MALE" } }),
    prisma.student.count({ where: { sex: "FEMALE" } }),
    // ── Timetable snapshot ──
    prisma.lesson.count(),
    prisma.class.count(),
    prisma.lesson.count({ where: { day: todayEnum as any } }),
  ]);

  const attendanceData = await Promise.all(
    weekDays.map(async ({ label, date }) => {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end   = new Date(date); end.setHours(23, 59, 59, 999);
      const [present, absent] = await Promise.all([
        prisma.attendance.count({ where: { date: { gte: start, lte: end }, present: true  } }),
        prisma.attendance.count({ where: { date: { gte: start, lte: end }, present: false } }),
      ]);
      return { name: label, present, absent };
    })
  );

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
      // ── NEW ──
      timetableSnapshot={{
        totalLessons,
        totalClasses,
        todayLessons,
        todayDay: todayLabel,
      }}
    />
  );
};

export default AdminPage;