import { redirect } from "next/navigation";
import OnboardingStageShell from "@/src/components/OnboardingStageShell";
import SchoolSetupClient from "@/src/components/SchoolSetupClient";
import { requirePageSession } from "@/src/lib/authz";
import { setupStageNav } from "@/src/lib/onboarding/setup-stages";
import { getSchoolOnboardingState } from "@/src/lib/services/onboarding";

export default async function SchoolSetupPage() {
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
      eyebrow="School identity"
      title="Confirm the school Edujay is serving"
      description="Start with the official school identity. The next step will ask whether this school is starting fresh or migrating existing records."
      stages={setupStageNav("profile")}
    >
      <SchoolSetupClient school={school} />
    </OnboardingStageShell>
  );
}
