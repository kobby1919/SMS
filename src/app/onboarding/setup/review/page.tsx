import { redirect } from "next/navigation";
import OnboardingStageShell from "@/src/components/OnboardingStageShell";
import ReadinessReviewWorkspace from "@/src/components/ReadinessReviewWorkspace";
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

  return (
    <OnboardingStageShell
      eyebrow="Readiness review"
      title="Check what is ready before dashboard access"
      description="Confirm the minimum school foundation before Edujay unlocks the live admin dashboard."
      stages={setupStageNav("review", ["profile", "path", "fresh"])}
    >
      <ReadinessReviewWorkspace school={school} />
    </OnboardingStageShell>
  );
}

