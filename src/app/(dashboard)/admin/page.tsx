import AdminDashboard from "@/src/components/AdminDashboard";
import UserCard from "@/src/components/UserCard";

const cardTypes = ["admin", "teacher", "student", "parent"] as const;

// Server component — fetches UserCard data, passes counts to client
const AdminPage = async () => {
  const counts = await Promise.all(
    cardTypes.map(async (type) => {
      const { default: prisma } = await import("@/src/lib/prisma");
      const modelMap: Record<string, any> = {
        admin:   prisma.admin,
        teacher: prisma.teacher,
        student: prisma.student,
        parent:  prisma.parent,
      };
      const count = await modelMap[type].count();
      return { type, count };
    })
  );

  return <AdminDashboard counts={counts} />;
};

export default AdminPage;
