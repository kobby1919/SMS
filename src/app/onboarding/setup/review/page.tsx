import Link from "next/link";
import { redirect } from "next/navigation";
import OnboardingStageShell from "@/src/components/OnboardingStageShell";
import { requirePageSession } from "@/src/lib/authz";
import { setupStageNav } from "@/src/lib/onboarding/setup-stages";
import { getSchoolOnboardingState } from "@/src/lib/services/onboarding";

export default async function SetupReviewPage() {
  const session = await requirePageSession(["admin"]);
  const school = await getSchoolOnboardingState(session.schoolId);

  if (!school) {
    redirect("/sign-in?error=missing_school");
  }

  if (school.onboardingStatus === "COMPLETED") {
    redirect("/admin");
  }

  const checks = [
    { label: "School profile", done: Boolean(school.name) },
    { label: "Grades", done: school._count.grades > 0 },
    { label: "Classes", done: school._count.classes > 0 },
    { label: "Subjects", done: school._count.subjects > 0 },
    { label: "Teachers or migration plan", done: school._count.teachers > 0 },
    { label: "Students or migration plan", done: school._count.students > 0 },
  ];

  return (
    <OnboardingStageShell
      eyebrow="Readiness review"
      title="Check what is ready before dashboard access"
      description="This page will become the final professional checkpoint before the admin dashboard unlocks."
      stages={setupStageNav("review", ["profile", "path"])}
    >
      <div className="grid gap-3">
        {checks.map((check) => (
          <div
            key={check.label}
            className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
          >
            <span className="text-sm font-bold text-gray-800">{check.label}</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-black ${
                check.done ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-500"
              }`}
            >
              {check.done ? "Ready" : "Needed"}
            </span>
          </div>
        ))}
      </div>

      <Link
        href="/onboarding/setup/complete"
        className="mt-6 inline-flex rounded-lg bg-blue-700 px-4 py-3 text-sm font-bold text-white"
      >
        Continue to completion
      </Link>
    </OnboardingStageShell>
  );
}

