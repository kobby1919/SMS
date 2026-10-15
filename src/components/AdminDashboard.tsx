import WelcomeBanner from "@/src/components/WelcomeBanner";
import Link from "next/link";
import { Database, CalendarDays, BookMarked, UserCheck, Star, FileText } from "lucide-react";
import AdminOwnerSchoolPulse from "@/src/components/AdminOwnerSchoolPulse";
import AdminFinanceSnapshot from "@/src/components/AdminFinanceSnapshot";
import AdminTeacherAccountability from "@/src/components/AdminTeacherAccountability";
import AdminAcademicReadiness from "@/src/components/AdminAcademicReadiness";
import AdminParentEngagement from "@/src/components/AdminParentEngagement";
import { getAdminParentEngagementSnapshot } from "@/src/lib/services/admin-parent-engagement";
import { getAdminAcademicReadinessSnapshot } from "@/src/lib/services/admin-academic-readiness";
import { getAdminSchoolPulse } from "@/src/lib/services/admin-school-pulse";
import { getAdminFinanceSnapshot } from "@/src/lib/services/admin-finance-snapshot";
import { getAdminTeacherAccountability } from "@/src/lib/services/admin-teacher-accountability";
import { createDashboardReader } from "@/src/lib/services/admin-dashboard-section";
import AdminDashboardSection from "@/src/components/AdminDashboardSection";
import AdminDashboardRefresh from "@/src/components/AdminDashboardRefresh";

export default function AdminDashboard({ schoolId }: { schoolId: string }) {
  const read = createDashboardReader();
  const now = new Date();
  return (
    <div className="flex min-w-0 flex-col gap-6 p-4 md:p-6">
      <WelcomeBanner role="admin" name="Admin" subtitle="Here is what is happening at your school today."
        tag="School overview" />
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <p>Requested <time dateTime={now.toISOString()}>{now.toISOString().slice(11, 19)} UTC</time></p>
        <AdminDashboardRefresh />
      </div>
      <AdminDashboardSection requestKey={now.toISOString()} id="pulse" title="Today's School Pulse" read={read} load={() => getAdminSchoolPulse(schoolId, now)}>
        {(data) => <AdminOwnerSchoolPulse pulse={data.schoolPulse} activePeriod={data.activePeriod} />}
      </AdminDashboardSection>
      <AdminDashboardSection requestKey={now.toISOString()} id="finance" title="Finance Snapshot" read={read} load={() => getAdminFinanceSnapshot(schoolId, now)}>
        {(data) => <AdminFinanceSnapshot snapshot={data} />}
      </AdminDashboardSection>
      <AdminDashboardSection requestKey={now.toISOString()} id="accountability" title="Teacher Accountability" read={read} load={() => getAdminTeacherAccountability(schoolId, now, undefined, false, { dashboard: true })}>
        {(data) => <AdminTeacherAccountability snapshot={data} />}
      </AdminDashboardSection>
      <AdminDashboardSection requestKey={now.toISOString()} id="academics" title="Academic Readiness" read={read} load={() => getAdminAcademicReadinessSnapshot()}>
        {(data) => <AdminAcademicReadiness snapshot={data} />}
      </AdminDashboardSection>
      <AdminDashboardSection requestKey={now.toISOString()} id="parents" title="Parent Engagement" read={read} load={() => getAdminParentEngagementSnapshot()}>
        {(data) => <AdminParentEngagement snapshot={data} />}
      </AdminDashboardSection>
      <nav aria-label="Academic review" className="flex flex-wrap gap-x-5 gap-y-3 border-t border-gray-200 pt-4 text-sm font-semibold text-gray-700">
        {[["Timetable", "/admin/timetable", CalendarDays], ["Curriculum", "/list/syllabus", BookMarked], ["Attendance Review", "/list/attendance", UserCheck], ["Assessments", "/list/ca?view=summary", Star], ["Reports & Approval", "/list/report-cards", FileText]].map(([label, href, Icon]) => {
          const Symbol = Icon as typeof CalendarDays;
          return <Link prefetch={false} key={String(href)} href={String(href)} className="inline-flex min-h-10 items-center gap-2 hover:text-blue-800"><Symbol size={16} aria-hidden="true" />{String(label)}</Link>;
        })}
      </nav>
      <div className="border-t border-gray-200 pt-4">
        <Link prefetch={false} href="/admin/data-migration" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-800">
          <Database size={16} aria-hidden="true" /> Data setup and bulk invites
        </Link>
      </div>
    </div>
  );
}
