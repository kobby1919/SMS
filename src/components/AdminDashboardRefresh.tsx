"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export default function AdminDashboardRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())}
    className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-800 disabled:opacity-50" aria-busy={pending}>
    <RefreshCw size={16} aria-hidden="true" className={pending ? "motion-safe:animate-spin" : ""} />
    {pending ? "Refreshing..." : "Refresh dashboard"}
  </button>;
}
