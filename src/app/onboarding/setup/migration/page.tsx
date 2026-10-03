import { redirect } from "next/navigation";
import OnboardingStageShell from "@/src/components/OnboardingStageShell";
import { DataMigrationWorkspace } from "@/src/app/(dashboard)/admin/data-migration/page";
import { requirePageSession } from "@/src/lib/authz";
import { setupPathForStep, setupStageNav } from "@/src/lib/onboarding/setup-stages";
import { getSchoolOnboardingState } from "@/src/lib/services/onboarding";

export default async function SetupMigrationPage() {
  const session = await requirePageSession(["admin"]);
  const school = await getSchoolOnboardingState(session.schoolId);

  if (!school) {
    redirect("/sign-in?error=missing_school");
  }

  if (school.onboardingStatus === "COMPLETED") {
    redirect("/admin");
  }

  if (school.setupStep !== "migration") {
    redirect(setupPathForStep(school.setupStep));
  }

  return (
    <OnboardingStageShell
      eyebrow="Data migration"
      title="Bring existing records into Edujay"
      description="Upload, map, validate, import clean records, then send secure login invites before the live dashboard opens."
      stages={setupStageNav("migration", ["profile", "path"], "migration")}
    >
      <DataMigrationWorkspace schoolId={session.schoolId} setupContext="onboarding" />
    </OnboardingStageShell>
  );
}
