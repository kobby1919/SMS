import { requirePageSession } from "@/src/lib/authz";
import { getCachedAdminDashboardData } from "@/src/lib/queries/admin-dashboard";
import { getAdminOwnerDashboardData } from "@/src/lib/queries/admin-owner-dashboard";
import AdminDashboard from "@/src/components/AdminDashboard";
import EventList from "@/src/components/EventList";
import Announcements from "@/src/components/Announcements";

export const dynamic = "force-dynamic";

const AdminPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { schoolId } = await requirePageSession(["admin"]);
  const [data, ownerDashboard, params] = await Promise.all([
    getCachedAdminDashboardData(schoolId),
    getAdminOwnerDashboardData(schoolId),
    searchParams,
  ]);

  return (
    <AdminDashboard
      ownerDashboard={ownerDashboard}
      counts={data.counts}
      boys={data.boys}
      girls={data.girls}
      attendanceData={data.attendanceData}
      financeData={data.financeData}
      eventList={<EventList dateParam={params.date} />}
      announcements={<Announcements />}
      timetableSnapshot={data.timetableSnapshot}
      caSnapshot={data.caSnapshot}
      syllabusSnapshot={data.syllabusSnapshot}
    />
  );
};

export default AdminPage;
