import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";
import SetupAdvanceButton from "@/src/components/SetupAdvanceButton";

type ReadinessSchool = {
  name: string;
  contactEmail: string | null;
  phone: string | null;
  _count: {
    grades: number;
    classes: number;
    subjects: number;
    teachers: number;
    students: number;
  };
  readiness: {
    activeParentLinks: number;
    feeSetupStarted: boolean;
    onlinePaymentsEnabled: boolean;
    activeTimetablePublished: boolean;
  };
};

type ReadinessCheck = {
  label: string;
  description: string;
  count: string;
  ready: boolean;
  required: boolean;
  href: string;
  action: string;
};

export default function ReadinessReviewWorkspace({ school }: { school: ReadinessSchool }) {
  const checks: ReadinessCheck[] = [
    {
      label: "School identity",
      description: "School name and basic contact identity are available for records and documents.",
      count: school.contactEmail || school.phone ? "Contact saved" : "Contact can be added later",
      ready: Boolean(school.name),
      required: true,
      href: "/onboarding/setup",
      action: "Edit identity",
    },
    {
      label: "Grades",
      description: "The academic levels that classes belong to have been created.",
      count: `${school._count.grades} grades`,
      ready: school._count.grades > 0,
      required: true,
      href: "/list/classes",
      action: "Review classes",
    },
    {
      label: "Classes",
      description: "Classes are ready for students, attendance, timetable, and reports.",
      count: `${school._count.classes} classes`,
      ready: school._count.classes > 0,
      required: true,
      href: "/list/classes",
      action: "Review classes",
    },
    {
      label: "Subjects",
      description: "Subjects are ready for teacher capability, timetable, assessment, and reports.",
      count: `${school._count.subjects} subjects`,
      ready: school._count.subjects > 0,
      required: true,
      href: "/list/subjects",
      action: "Review subjects",
    },
    {
      label: "Teachers",
      description: "Teachers can be invited now or after dashboard access, depending on the school's rollout plan.",
      count: `${school._count.teachers} teachers`,
      ready: school._count.teachers > 0,
      required: false,
      href: "/list/teachers",
      action: "Open teachers",
    },
    {
      label: "Students",
      description: "Students can be entered manually, imported, or added after the school enters the dashboard.",
      count: `${school._count.students} students`,
      ready: school._count.students > 0,
      required: false,
      href: "/list/students",
      action: "Open students",
    },
    {
      label: "Parent links",
      description: "Parent access is ready when active guardian links exist for students.",
      count: `${school.readiness.activeParentLinks} active links`,
      ready: school.readiness.activeParentLinks > 0,
      required: false,
      href: "/list/parents",
      action: "Open parents",
    },
    {
      label: "Fee setup",
      description: "Finance can begin once payment settings or fee setup work has started.",
      count: school.readiness.onlinePaymentsEnabled
        ? "Online payments enabled"
        : school.readiness.feeSetupStarted
          ? "Payment settings started"
          : "Not started yet",
      ready: school.readiness.feeSetupStarted,
      required: false,
      href: "/admin/payment-settings",
      action: "Open finance setup",
    },
    {
      label: "Timetable",
      description: "The timetable can be built and published later after classes, subjects, and teachers are stable.",
      count: school.readiness.activeTimetablePublished ? "Published timetable found" : "Can be done later",
      ready: school.readiness.activeTimetablePublished,
      required: false,
      href: "/admin/timetable",
      action: "Open timetable",
    },
  ];

  const requiredChecks = checks.filter((check) => check.required);
  const readyRequired = requiredChecks.filter((check) => check.ready).length;
  const canComplete = readyRequired === requiredChecks.length;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-blue-700">Required foundation</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-gray-950">
              {readyRequired} of {requiredChecks.length} required checks ready
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Edujay only unlocks the live dashboard after the minimum academic foundation is ready.
              People and finance setup can continue from the dashboard.
            </p>
          </div>
          <span
            className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-black ${
              canComplete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {canComplete ? "Ready to complete" : "Needs attention"}
          </span>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {checks.map((check) => (
          <Link
            key={check.label}
            href={check.href}
            className="group flex min-h-[190px] flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
          >
            <div className="flex items-start justify-between gap-4">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                  check.ready
                    ? "bg-emerald-100 text-emerald-700"
                    : check.required
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-500"
                }`}
              >
                {check.ready ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : check.required ? (
                  <CircleAlert className="h-5 w-5" />
                ) : (
                  <CircleDashed className="h-5 w-5" />
                )}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-black ${
                  check.ready
                    ? "bg-emerald-100 text-emerald-700"
                    : check.required
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-500"
                }`}
              >
                {check.ready ? "Ready" : check.required ? "Required" : "Optional"}
              </span>
            </div>
            <h3 className="mt-5 text-lg font-black text-gray-950">{check.label}</h3>
            <p className="mt-2 text-sm leading-6 text-gray-500">{check.description}</p>
            <p className="mt-4 text-sm font-bold text-gray-700">{check.count}</p>
            <span className="mt-auto flex items-center gap-2 pt-5 text-sm font-black text-blue-700">
              {check.action}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-gray-950">
            {canComplete ? "The required foundation is ready." : "Finish the required foundation first."}
          </p>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            {canComplete
              ? "The next screen confirms setup completion before the live dashboard opens."
              : "Grades, classes, and subjects must exist before Edujay can safely unlock the dashboard."}
          </p>
        </div>
        {canComplete ? (
          <SetupAdvanceButton target="complete" label="Continue to completion" />
        ) : (
          <Link
            href="/onboarding/setup/fresh"
            className="rounded-xl bg-white px-4 py-3 text-center text-sm font-black text-gray-900 shadow-sm"
          >
            Return to setup
          </Link>
        )}
      </section>
    </div>
  );
}
