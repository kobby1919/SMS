"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  advanceSchoolSetupToCompletionAction,
  advanceSchoolSetupToReviewAction,
} from "@/src/lib/actions/onboardingActions";

type SetupAdvanceTarget = "review" | "complete";

const TARGETS: Record<SetupAdvanceTarget, { href: string; action: () => Promise<{ ok: true } | { ok: false; message: string }> }> = {
  review: {
    href: "/onboarding/setup/review",
    action: advanceSchoolSetupToReviewAction,
  },
  complete: {
    href: "/onboarding/setup/complete",
    action: advanceSchoolSetupToCompletionAction,
  },
};

export default function SetupAdvanceButton({
  target,
  label,
  disabled,
  className,
}: {
  target: SetupAdvanceTarget;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const config = TARGETS[target];

  function advance() {
    setError(null);
    startTransition(async () => {
      const result = await config.action();

      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.push(config.href);
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={advance}
        disabled={disabled || isPending}
        className={
          className ??
          "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-center text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        }
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {isPending ? "Checking..." : label}
        {!isPending ? <ArrowRight className="h-4 w-4" /> : null}
      </button>
      {error ? (
        <p className="max-w-md text-sm font-semibold leading-6 text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
