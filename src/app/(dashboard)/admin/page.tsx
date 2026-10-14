import {
  requireCompletedAdminSchoolSetup,
  requirePageSession,
} from "@/src/lib/authz";
import { getAdminOwnerDashboardData } from "@/src/lib/queries/admin-owner-dashboard";
import { getAdminFinanceSnapshot } from "@/src/lib/services/admin-finance-snapshot";
import AdminDashboard from "@/src/components/AdminDashboard";
import { getAdminTeacherAccountability } from "@/src/lib/services/admin-teacher-accountability";
import { getAdminAcademicReadinessSnapshot } from "@/src/lib/services/admin-academic-readiness";

export const dynamic = "force-dynamic";

const AdminPage = async () => {
  const session = await requirePageSession(["admin"]);
  await requireCompletedAdminSchoolSetup(session);
  const { schoolId } = session;

  const [ownerDashboard, financeSnapshot, accountability, academicReadiness] = await Promise.all([
    getAdminOwnerDashboardData(schoolId),
    getAdminFinanceSnapshot(schoolId),
    getAdminTeacherAccountability(schoolId),
    getAdminAcademicReadinessSnapshot(),
  ]);

  return (
    <AdminDashboard
      ownerDashboard={ownerDashboard}
      financeSnapshot={financeSnapshot}
      accountability={accountability}
      academicReadiness={academicReadiness}
    />
  );
};

export default AdminPage;
