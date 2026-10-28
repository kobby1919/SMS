"use client";

import Link from "next/link";
import { RotateCcw, ArrowLeft } from "lucide-react";

export default function PageRecoveryError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto w-full min-w-0 max-w-xl space-y-4 p-5 py-12 font-inter text-sm text-gray-700 sm:p-8">
      <h1 className="break-words text-xl font-black text-gray-950">We could not load this page</h1>
      <p className="leading-relaxed">Try again. If the problem continues, return to your workspace and reopen the record.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-blue-800 px-4 py-2 font-bold text-white"><RotateCcw size={16} aria-hidden="true" />Try again</button>
        <Link href="/auth/callback" className="inline-flex min-h-11 items-center gap-2 px-2 py-2 font-bold text-blue-800"><ArrowLeft size={16} aria-hidden="true" />Return to your workspace</Link>
      </div>
    </main>
  );
}
