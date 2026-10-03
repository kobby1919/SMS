"use client";

import { ArrowRight, Database, Loader2, PenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { selectSchoolSetupPathAction } from "@/src/lib/actions/onboardingActions";

type SetupPath = "fresh" | "migration";

const OPTIONS: Array<{
  key: SetupPath;
  title: string;
  eyebrow: string;
  description: string;
  href: string;
  icon: typeof PenLine;
}> = [
  {
    key: "fresh",
    eyebrow: "Start fresh",
    title: "Enter data manually",
    description: "For schools entering classes, people, fees, and timetable records directly in Edujay.",
    href: "/onboarding/setup/fresh",
    icon: PenLine,
  },
  {
    key: "migration",
    eyebrow: "Migrate existing records",
    title: "Bring records into Edujay",
    description: "For schools bringing existing students, parents, teachers, classes, subjects, or fee records into Edujay.",
    href: "/onboarding/setup/migration",
    icon: Database,
  },
];

export default function SetupPathChooser() {
  const router = useRouter();
  const [pendingPath, setPendingPath] = useState<SetupPath | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function choosePath(setupPath: SetupPath) {
    setPendingPath(setupPath);
    setError(null);

    startTransition(async () => {
      const result = await selectSchoolSetupPathAction({ setupPath });

      if (!result.ok) {
        setError(result.message);
        setPendingPath(null);
        return;
      }

      const option = OPTIONS.find((item) => item.key === setupPath);
      router.push(option?.href ?? "/onboarding/setup/path");
    });
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const busy = isPending && pendingPath === option.key;

          return (
            <button
              key={option.key}
              type="button"
              onClick={() => choosePath(option.key)}
              disabled={isPending}
              className="group flex h-full min-h-[230px] flex-col rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
              </span>
              <span className="mt-5 text-xs font-black uppercase tracking-wide text-blue-700">
                {option.eyebrow}
              </span>
              <span className="mt-2 block text-xl font-black leading-tight text-gray-950">
                {option.title}
              </span>
              <span className="mt-3 block text-sm leading-6 text-gray-500">
                {option.description}
              </span>
              <span className="mt-auto flex items-center gap-2 pt-6 text-sm font-black text-blue-700">
                Continue
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
