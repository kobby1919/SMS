import { redirect } from "next/navigation";
import OnboardingStageShell from "@/src/components/OnboardingStageShell";
import SetupPathChooser from "@/src/components/SetupPathChooser";
import { requirePageSession } from "@/src/lib/authz";
import { setupPathForStep, setupStageNav } from "@/src/lib/onboarding/setup-stages";
import { getSchoolOnboardingState } from "@/src/lib/services/onboarding";

export default async function SetupPathPage() {
  const session = await requirePageSession(["admin"]);
  const school = await getSchoolOnboardingState(session.schoolId);

  if (!school) {
    redirect("/sign-in?error=missing_school");
  }

  if (school.onboardingStatus === "COMPLETED") {
    redirect("/admin");
  }

  if (school.setupStep !== "path") {
    redirect(setupPathForStep(school.setupStep));
  }

  return (
    <OnboardingStageShell
      eyebrow="Setup path"
      title="Welcome to Edujay"
      description="Choose the setup route that matches how this school wants to begin."
      stages={setupStageNav("path", ["profile"])}
    >
      <SetupPathChooser />
    </OnboardingStageShell>
  );
}

