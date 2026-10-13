import UnavailablePage from "@/src/components/UnavailablePage";
import { requirePageSession } from "@/src/lib/authz";
import { dashboardPathForRole } from "@/src/lib/roles";

export default async function DashboardNotFound() {
  const { role } = await requirePageSession();
  return <UnavailablePage href={dashboardPathForRole(role)} />;
}
