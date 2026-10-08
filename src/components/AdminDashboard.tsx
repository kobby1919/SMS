import WelcomeBanner from "@/src/components/WelcomeBanner";
import Link from "next/link";
import { Database } from "lucide-react";
import AdminOwnerSchoolPulse from "@/src/components/AdminOwnerSchoolPulse";
import AdminFinanceSnapshot from "@/src/components/AdminFinanceSnapshot";
import AdminTeacherAccountability from "@/src/components/AdminTeacherAccountability";
import type { AdminOwnerDashboardData } from "@/src/lib/queries/admin-owner-dashboard";
import type { AdminFinanceSnapshot as FinanceSnapshot } from "@/src/lib/services/admin-finance-snapshot";
import type { AdminTeacherAccountabilitySnapshot } from "@/src/lib/services/admin-teacher-accountability";

export default function AdminDashboard({ ownerDashboard, financeSnapshot, accountability }: {
  ownerDashboard: AdminOwnerDashboardData;
  financeSnapshot: FinanceSnapshot;
  accountability: AdminTeacherAccountabilitySnapshot;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-6 p-4 md:p-6">
      <WelcomeBanner role="admin" name="Admin" subtitle="Here is what is happening at your school today."
        tag={`${ownerDashboard.activePeriod.currentTerm.replace("_", " ")} · ${ownerDashboard.activePeriod.academicYear}`} />
      <AdminOwnerSchoolPulse pulse={ownerDashboard.schoolPulse} activePeriod={ownerDashboard.activePeriod} />
      <AdminFinanceSnapshot snapshot={financeSnapshot} />
      <AdminTeacherAccountability snapshot={accountability} />
      <div className="border-t border-gray-200 pt-4">
        <Link href="/admin/data-migration" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-800">
          <Database size={16} aria-hidden="true" /> Data setup and bulk invites
        </Link>
      </div>
    </div>
  );
}
