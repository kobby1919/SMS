import { redirect } from "next/navigation";
import SchoolSetupClient from "@/src/components/SchoolSetupClient";
import { requirePageSession } from "@/src/lib/authz";
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
    <main className="min-h-screen bg-[#F7F8FA] p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <p className="text-sm font-semibold text-blue-700">School setup</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-gray-900">
            Finish setting up {school.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
            Complete the required basics before using the live admin dashboard.
            You can continue adding users and finance details after launch.
          </p>
        </div>

        <SchoolSetupClient school={school} />
      </div>
    </main>
  );
}
