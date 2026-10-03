import { redirect } from "next/navigation";
import OnboardingStageShell from "@/src/components/OnboardingStageShell";
import OnboardingCompletionWorkspace from "@/src/components/OnboardingCompletionWorkspace";
import { requirePageSession } from "@/src/lib/authz";
import { setupPathForStep, setupStageNav } from "@/src/lib/onboarding/setup-stages";
import { getSchoolOnboardingState } from "@/src/lib/services/onboarding";

export default async function SetupCompletePage() {
  const session = await requirePageSession(["admin"]);
  const school = await getSchoolOnboardingState(session.schoolId);

  if (!school) {
    redirect("/sign-in?error=missing_school");
  }

  if (school.onboardingStatus === "COMPLETED") {
    redirect("/admin");
  }

  if (!school.code) {
    redirect("/onboarding/setup");
  }

  if (school.setupStep !== "complete") {
    redirect(setupPathForStep(school.setupStep));
  }

  return (
    <OnboardingStageShell
      eyebrow="Completion"
      title="All set"
      description="This is the final handoff screen before the admin enters the live Edujay workspace."
      stages={setupStageNav("complete", ["profile", "path", "fresh", "review"])}
    >
      <OnboardingCompletionWorkspace school={school} />
    </OnboardingStageShell>
  );
}

