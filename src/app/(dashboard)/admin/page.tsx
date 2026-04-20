import prisma from "@/src/lib/prisma";
import AdminDashboard from "@/src/components/AdminDashboard";

const AdminPage = async () => {
  const currentYear = new Date().getFullYear();

  // ── Weekday labels for last 5 days ──
  const weekDays: { label: string; date: Date }[] = [];
  let d = new Date();
  while (weekDays.length < 5) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      weekDays.unshift({ label: d.toLocaleDateString("en-US", { weekday: "short" }), date: new Date(d) });
    }
    d.setDate(d.getDate() - 1);
  }

  const months = Array.from({ length: 12 }, (_, i) => i);
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const [
    adminCount, teacherCount, studentCount, parentCount,
    boyCount, girlCount,
  ] = await Promise.all([
    prisma.admin.count(),
    prisma.teacher.count(),
    prisma.student.count(),
    prisma.parent.count(),
    prisma.student.count({ where: { sex: "MALE" } }),
    prisma.student.count({ where: { sex: "FEMALE" } }),
  ]);

  // ── Attendance: last 5 weekdays ──
  const attendanceData = await Promise.all(
    weekDays.map(async ({ label, date }) => {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end   = new Date(date); end.setHours(23, 59, 59, 999);
      const [present, absent] = await Promise.all([
        prisma.attendance.count({ where: { date: { gte: start, lte: end }, present: true } }),
        prisma.attendance.count({ where: { date: { gte: start, lte: end }, present: false } }),
      ]);
      return { name: label, present, absent };
    })
  );

  // ── Finance: avg scores per month as proxy ──
  const financeData = await Promise.all(
    months.map(async (i) => {
      const start = new Date(currentYear, i, 1);
      const end   = new Date(currentYear, i + 1, 0, 23, 59, 59);
      const [examAvg, assignAvg] = await Promise.all([
        prisma.result.aggregate({ _avg: { score: true }, where: { exam: { startTime: { gte: start, lte: end } } } }),
        prisma.result.aggregate({ _avg: { score: true }, where: { assignment: { dueDate: { gte: start, lte: end } } } }),
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
    />
  );
};

export default AdminPage;
