import {
  requireCompletedAdminSchoolSetup,
  requirePageSession,
} from "@/src/lib/authz";
import AdminDashboard from "@/src/components/AdminDashboard";

export const dynamic = "force-dynamic";

const AdminPage = async () => {
  const session = await requirePageSession(["admin"]);
  await requireCompletedAdminSchoolSetup(session);
  const { schoolId } = session;

  return <AdminDashboard schoolId={schoolId} />;
};

export default AdminPage;
