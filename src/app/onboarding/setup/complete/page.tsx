import Link from "next/link";
import { redirect } from "next/navigation";
import OnboardingStageShell from "@/src/components/OnboardingStageShell";
import { requirePageSession } from "@/src/lib/authz";
import { setupStageNav } from "@/src/lib/onboarding/setup-stages";
import { getSchoolOnboardingState } from "@/src/lib/services/onboarding";

export default async function SetupCompletePage() {
  const session = await requirePageSession(["admin"]);
  const school = await getSchoolOnboardingState(session.schoolId);

  if (!school) {
    redirect("/sign-in?error=missing_school");
  }

  return (
    <OnboardingStageShell
      eyebrow="Completion"
      title="All set"
      description="This is the final handoff screen before the admin enters the live Edujay workspace."
      stages={setupStageNav("complete", ["profile", "path", "review"])}
    >
      <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
        <div className="flex h-32 w-32 items-center justify-center rounded-full border-8 border-blue-100 bg-blue-50">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-700 text-4xl font-black text-white">
            ✓
          </div>
        </div>
        <h2 className="mt-6 text-3xl font-black tracking-tight text-gray-950">
          Welcome to Edujay
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">
          Your school workspace is ready for the next phase. Continue to the
          dashboard when the required setup checks are complete.
        </p>
        <Link
          href="/admin"
          className="mt-6 rounded-lg bg-gray-900 px-5 py-3 text-sm font-bold text-white"
        >
          Enter Admin Dashboard
        </Link>
      </div>
    </OnboardingStageShell>
  );
}

