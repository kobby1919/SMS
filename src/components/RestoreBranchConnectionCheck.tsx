import { RefreshCw, ShieldCheck } from "lucide-react";
import { getRestoreBranchConnectionDiagnostic } from "@/src/lib/services/restore-branch-diagnostic";

const outcomes = {
  MATCH: { text: "Uses the October 23 restore branch. Do not delete it.", tone: "text-rose-800" },
  DIFFERENT: { text: "Points to a different Neon endpoint.", tone: "text-gray-800" },
  UNKNOWN: { text: "Could not establish the endpoint. Do not assume this branch is unused.", tone: "text-amber-900" },
  NOT_CONFIGURED: { text: "Not configured in this deployment.", tone: "text-gray-500" },
};

export default function RestoreBranchConnectionCheck() {
  const result = getRestoreBranchConnectionDiagnostic();
  return (
    <section aria-labelledby="restore-branch-check-title" className="min-w-0 rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-gray-600" />
          <h2 id="restore-branch-check-title" className="text-lg font-bold text-gray-950">Restore branch connection check</h2>
        </div>
        <form method="get">
          <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-gray-200 px-3 text-sm font-semibold text-gray-700"><RefreshCw size={16} />Refresh check</button>
        </form>
      </div>
      <p className="mt-3 text-sm leading-6 text-gray-600">Checks this running deployment against the October 23 restore-test branch. No passwords or database URLs are displayed. No database or Neon API calls are made.</p>
      <dl className="mt-4 grid min-w-0 gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-gray-500">Environment</dt><dd className="break-words font-semibold text-gray-900">{result.environment}</dd></div>
        <div><dt className="text-gray-500">Release</dt><dd className="font-semibold text-gray-900">{result.commit}</dd></div>
        <div className="min-w-0 sm:col-span-2"><dt className="text-gray-500">Deployment</dt><dd className="break-all font-semibold text-gray-900">{result.deployment}</dd></div>
      </dl>
      <ul className="mt-4 divide-y divide-gray-100 border-y border-gray-100">
        {result.connections.map((connection) => <li key={connection.setting} className="min-w-0 py-3">
          <p className="break-all text-xs font-bold text-gray-700">{connection.setting} <span className="font-normal">{connection.runtime ? "(application runtime)" : "(additional setting, if used)"}</span></p>
          <p className={`mt-1 text-sm leading-6 ${outcomes[connection.comparison].tone}`}>{outcomes[connection.comparison].text}</p>
        </li>)}
      </ul>
      <p className="mt-3 break-words text-xs text-gray-500">Checked {result.checkedAt}</p>
      <p className="mt-3 text-sm font-semibold leading-6 text-amber-900">This is not permission to delete the branch. Check production, staging, retained deployments, local tools, and any other clients separately. A different endpoint here does not establish that the branch is globally unused.</p>
    </section>
  );
}
