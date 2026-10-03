import Link from "next/link";
import type { ReactNode } from "react";

type OnboardingStage = {
  label: string;
  href: string;
  active?: boolean;
  done?: boolean;
};

export default function OnboardingStageShell({
  eyebrow,
  title,
  description,
  stages,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  stages: OnboardingStage[];
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#F7F8FA] px-4 py-6 md:px-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-blue-700">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-gray-950">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>

          <div className="mt-6 space-y-2">
            {stages.map((stage, index) => (
              <Link
                key={stage.href}
                href={stage.href}
                className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition ${
                  stage.active
                    ? "border-blue-200 bg-blue-50 text-blue-950"
                    : "border-gray-100 bg-white text-gray-600 hover:border-gray-200"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                    stage.done
                      ? "bg-emerald-100 text-emerald-700"
                      : stage.active
                        ? "bg-blue-700 text-white"
                        : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {stage.done ? "✓" : index + 1}
                </span>
                <span className="min-w-0 font-bold">{stage.label}</span>
              </Link>
            ))}
          </div>
        </aside>

        <section className="min-w-0 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-7">
          {children}
        </section>
      </div>
    </main>
  );
}

