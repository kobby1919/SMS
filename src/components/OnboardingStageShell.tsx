import type { ReactNode } from "react";

type OnboardingStage = {
  label: string;
  href: string;
  active?: boolean;
  done?: boolean;
  locked?: boolean;
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

          <div className="mt-6 space-y-0">
            {stages.map((stage, index) => (
              <div key={stage.href} className="relative flex gap-3">
                {index < stages.length - 1 ? (
                  <span
                    className={`absolute left-[13px] top-9 h-[calc(100%-1.5rem)] w-0.5 rounded-full ${
                      stage.done ? "bg-blue-500" : "bg-gray-200"
                    }`}
                    aria-hidden="true"
                  />
                ) : null}
                <span
                  className={`z-10 mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ring-4 ring-white ${
                    stage.done
                      ? "bg-blue-600 text-white"
                      : stage.active
                        ? "bg-blue-700 text-white"
                        : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {stage.done ? "✓" : index + 1}
                </span>
                <div
                  className={`mb-2 flex min-h-[48px] flex-1 items-center rounded-xl border px-3 py-2 text-sm ${
                    stage.active
                      ? "border-blue-200 bg-blue-50 text-blue-950"
                      : stage.done
                        ? "border-blue-100 bg-white text-gray-800"
                        : "border-gray-100 bg-gray-50 text-gray-400"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-black">{stage.label}</p>
                    <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide">
                      {stage.active ? "Current step" : stage.done ? "Completed" : "Locked"}
                    </p>
                  </div>
                </div>
              </div>
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

