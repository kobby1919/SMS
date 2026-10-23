import { Send } from "lucide-react";
import { redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { requirePageSession, requireRole } from "@/src/lib/authz";
import { MONITORING_TEST_MESSAGE, monitoringOptions } from "@/src/lib/monitoring/privacy";

async function sendMonitoringTest() {
  "use server";
  await requireRole(["platform_admin"]);
  if (!monitoringOptions().enabled) redirect("/platform/monitoring?result=unconfigured");
  let sent = false;
  try {
    Sentry.captureMessage(MONITORING_TEST_MESSAGE, { level: "error", tags: { component: "monitoring-test" } });
    sent = await Sentry.flush(5000);
  } catch {
    sent = false;
  }
  redirect(`/platform/monitoring?result=${sent ? "submitted" : "unconfirmed"}`);
}

export default async function PlatformMonitoringPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  await requirePageSession(["platform_admin"]);
  const { result } = await searchParams;
  const options = monitoringOptions();
  const outcomes: Record<string, string> = {
    submitted: "Test event submitted. Alert receipt not yet verified.",
    unconfigured: "Monitoring is not configured.",
    unconfirmed: "Event delivery is unconfirmed. Check Sentry before retrying.",
  };
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold text-gray-950">Error monitoring</h1>
      <dl className="grid grid-cols-1 gap-4 border-y border-gray-200 py-4 sm:grid-cols-2">
        <div><dt className="text-sm text-gray-500">Configuration</dt><dd className="font-semibold">{options.enabled ? "Configured" : "Not configured"}</dd></div>
        <div><dt className="text-sm text-gray-500">Environment</dt><dd className="font-semibold">{options.environment}</dd></div>
      </dl>
      <form action={sendMonitoringTest}>
        <button type="submit" disabled={!options.enabled} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-blue-800 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          <Send size={16} aria-hidden="true" />Send test alert
        </button>
      </form>
      {result && outcomes[result] ? <p role="status" className="break-words text-sm text-gray-700">{outcomes[result]}</p> : null}
    </main>
  );
}
