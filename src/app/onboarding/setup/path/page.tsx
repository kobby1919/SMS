import { redirect } from "next/navigation";
import OnboardingStageShell from "@/src/components/OnboardingStageShell";
import SetupPathChooser from "@/src/components/SetupPathChooser";
import { requirePageSession } from "@/src/lib/authz";
import { setupStageNav } from "@/src/lib/onboarding/setup-stages";
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

  return (
    <OnboardingStageShell
      eyebrow="Setup path"
      title="Choose how this school will start"
      description="Edujay should guide the school with the right setup route, whether records are new or already exist elsewhere."
      stages={setupStageNav("path", ["profile"])}
    >
      <SetupPathChooser />
    </OnboardingStageShell>
  );
}

