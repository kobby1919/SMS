import WelcomeBanner from "@/src/components/WelcomeBanner";
import Link from "next/link";
import { Database, CalendarDays, BookMarked, UserCheck, Star, FileText } from "lucide-react";
import AdminOwnerSchoolPulse from "@/src/components/AdminOwnerSchoolPulse";
import AdminFinanceSnapshot from "@/src/components/AdminFinanceSnapshot";
import AdminTeacherAccountability from "@/src/components/AdminTeacherAccountability";
import AdminAcademicReadiness from "@/src/components/AdminAcademicReadiness";
import type { getAdminAcademicReadinessSnapshot } from "@/src/lib/services/admin-academic-readiness";
import type { AdminOwnerDashboardData } from "@/src/lib/queries/admin-owner-dashboard";
import type { AdminFinanceSnapshot as FinanceSnapshot } from "@/src/lib/services/admin-finance-snapshot";
import type { AdminTeacherAccountabilitySnapshot } from "@/src/lib/services/admin-teacher-accountability";

export default function AdminDashboard({ ownerDashboard, financeSnapshot, accountability, academicReadiness }: {
  ownerDashboard: AdminOwnerDashboardData;
  financeSnapshot: FinanceSnapshot;
  accountability: AdminTeacherAccountabilitySnapshot;
  academicReadiness: Awaited<ReturnType<typeof getAdminAcademicReadinessSnapshot>>;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-6 p-4 md:p-6">
      <WelcomeBanner role="admin" name="Admin" subtitle="Here is what is happening at your school today."
        tag={`${ownerDashboard.activePeriod.currentTerm.replace("_", " ")} · ${ownerDashboard.activePeriod.academicYear}`} />
      <AdminOwnerSchoolPulse pulse={ownerDashboard.schoolPulse} activePeriod={ownerDashboard.activePeriod} />
      <AdminFinanceSnapshot snapshot={financeSnapshot} />
      <AdminTeacherAccountability snapshot={accountability} />
      <AdminAcademicReadiness snapshot={academicReadiness} />
      <nav aria-label="Academic review" className="flex flex-wrap gap-x-5 gap-y-3 border-t border-gray-200 pt-4 text-sm font-semibold text-gray-700">
        {[["Timetable", "/admin/timetable", CalendarDays], ["Curriculum", "/list/syllabus", BookMarked], ["Attendance Review", "/list/attendance", UserCheck], ["Assessments", "/list/ca?view=summary", Star], ["Reports & Approval", "/list/report-cards", FileText]].map(([label, href, Icon]) => {
          const Symbol = Icon as typeof CalendarDays;
          return <Link key={String(href)} href={String(href)} className="inline-flex min-h-10 items-center gap-2 hover:text-blue-800"><Symbol size={16} aria-hidden="true" />{String(label)}</Link>;
        })}
      </nav>
      <div className="border-t border-gray-200 pt-4">
        <Link href="/admin/data-migration" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-800">
          <Database size={16} aria-hidden="true" /> Data setup and bulk invites
        </Link>
      </div>
    </div>
  );
}
