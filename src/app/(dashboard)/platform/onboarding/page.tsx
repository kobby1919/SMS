import OnboardingRequestsClient from "@/src/components/OnboardingRequestsClient";
import { requirePageSession } from "@/src/lib/authz";
import { listWaitlistEntriesForReview } from "@/src/lib/services/onboarding";

export default async function PlatformOnboardingPage() {
  await requirePageSession(["platform_admin"]);
  const entries = await listWaitlistEntriesForReview();

  return (
    <main className="p-4 md:p-6">
      <div className="mb-6">
        <p className="text-sm font-semibold text-blue-700">Platform onboarding</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-gray-900">
          School access requests
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          Review each school before creating a tenant. Approval creates the school,
          prepares a first-admin invite, and keeps the invite scoped to that school.
        </p>
      </div>

      <OnboardingRequestsClient entries={entries} />
    </main>
  );
}
