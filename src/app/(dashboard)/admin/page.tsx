import prisma from "@/src/lib/prisma";
import AdminDashboard from "@/src/components/AdminDashboard";

// ONE server component that fetches ALL data
const AdminPage = async () => {
  const [adminCount, teacherCount, studentCount, parentCount, boyCount, girlCount] =
    await Promise.all([
      prisma.admin.count(),
      prisma.teacher.count(),
      prisma.student.count(),
      prisma.parent.count(),
      prisma.student.count({ where: { sex: "MALE" } }),
      prisma.student.count({ where: { sex: "FEMALE" } }),
    ]);

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
    />
  );
};

export default AdminPage;
