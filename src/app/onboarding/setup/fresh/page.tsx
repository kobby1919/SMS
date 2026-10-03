import Link from "next/link";
import { redirect } from "next/navigation";
import OnboardingStageShell from "@/src/components/OnboardingStageShell";
import { requirePageSession } from "@/src/lib/authz";
import { setupStageNav } from "@/src/lib/onboarding/setup-stages";
import { getSchoolOnboardingState } from "@/src/lib/services/onboarding";

const freshItems = [
  "Academic structure",
  "Classes",
  "Subjects",
  "Teachers",
  "Students and parents",
  "Fees",
  "Timetable",
];

export default async function FreshSetupPage() {
  const session = await requirePageSession(["admin"]);
  const school = await getSchoolOnboardingState(session.schoolId);

  if (!school) {
    redirect("/sign-in?error=missing_school");
  }

  if (school.onboardingStatus === "COMPLETED") {
    redirect("/admin");
  }

  return (
    <OnboardingStageShell
      eyebrow="Fresh setup"
      title="Build the school foundation"
      description="Use this path when the school wants to enter clean Edujay records from the beginning."
      stages={setupStageNav("fresh", ["profile", "path"])}
    >
      <div className="space-y-3">
        {freshItems.map((item, index) => (
          <div
            key={item}
            className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
          >
            <div>
              <p className="text-sm font-black text-gray-900">{item}</p>
              <p className="text-xs text-gray-500">Step {index + 1} in the fresh setup path</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-500">
              Pending
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/list/classes"
          className="rounded-lg bg-gray-900 px-4 py-3 text-center text-sm font-bold text-white"
        >
          Start with classes
        </Link>
        <Link
          href="/onboarding/setup/review"
          className="rounded-lg border border-gray-200 px-4 py-3 text-center text-sm font-bold text-gray-700"
        >
          Review readiness
        </Link>
      </div>
    </OnboardingStageShell>
  );
}

