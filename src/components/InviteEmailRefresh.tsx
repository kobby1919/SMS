"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export default function InviteEmailRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button type="button" aria-label="Refresh email activity" title="Refresh email activity" disabled={pending}
    onClick={() => startTransition(() => router.refresh())}
    className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-gray-200 disabled:opacity-50">
    <RefreshCw size={18} className={pending ? "animate-spin motion-reduce:animate-none" : ""} />
  </button>;
}
