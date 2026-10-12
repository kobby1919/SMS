import { requirePageSession } from "@/src/lib/authz";
import { redirect } from "next/navigation";
import AdminAttendanceReview from "@/src/components/AdminAttendanceReview";
import { getAdminAttendanceReview } from "@/src/lib/queries/admin-attendance-review";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { role } = await requirePageSession(["admin", "teacher"]);
  if (role === "teacher") redirect("/list/attendance/take");
  const data = await getAdminAttendanceReview(await searchParams);
  return <AdminAttendanceReview data={data} />;
}
