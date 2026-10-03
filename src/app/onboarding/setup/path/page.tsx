import Link from "next/link";
import { redirect } from "next/navigation";
import OnboardingStageShell from "@/src/components/OnboardingStageShell";
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
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/onboarding/setup/fresh"
          className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
        >
          <p className="text-xs font-black uppercase text-blue-700">Start fresh</p>
          <h2 className="mt-2 text-xl font-black text-gray-950">Build the school manually</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Best for a new school or a school that wants to enter classes, subjects,
            users, and finance setup step by step.
          </p>
        </Link>

        <Link
          href="/admin/data-migration"
          className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
        >
          <p className="text-xs font-black uppercase text-blue-700">Migrate records</p>
          <h2 className="mt-2 text-xl font-black text-gray-950">Bring existing data into Edujay</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Best for schools that already have students, guardians, teachers,
            classes, subjects, or finance records in spreadsheets.
          </p>
        </Link>
      </div>
    </OnboardingStageShell>
  );
}

