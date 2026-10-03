import { redirect } from "next/navigation";
import FreshSetupWorkspace from "@/src/components/FreshSetupWorkspace";
import OnboardingStageShell from "@/src/components/OnboardingStageShell";
import { requirePageSession } from "@/src/lib/authz";
import { setupPathForStep, setupStageNav } from "@/src/lib/onboarding/setup-stages";
import { getSchoolOnboardingState } from "@/src/lib/services/onboarding";

export default async function FreshSetupPage() {
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

  if (school.setupStep !== "fresh") {
    redirect(setupPathForStep(school.setupStep));
  }

  return (
    <OnboardingStageShell
      eyebrow="Fresh setup"
      title="Build the school foundation"
      description="Use this path when the school wants to enter clean Edujay records from the beginning."
      stages={setupStageNav("fresh", ["profile", "path"])}
    >
      <FreshSetupWorkspace school={school} />
    </OnboardingStageShell>
  );
}

