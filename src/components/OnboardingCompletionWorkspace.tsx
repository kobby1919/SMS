"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { completeSchoolOnboardingAction } from "@/src/lib/actions/onboardingActions";

type CompletionSchool = {
  name: string;
  _count: {
    grades: number;
    classes: number;
    subjects: number;
    teachers: number;
    students: number;
  };
};

export default function OnboardingCompletionWorkspace({ school }: { school: CompletionSchool }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function completeSetup() {
    setMessage(null);
    startTransition(async () => {
      const result = await completeSchoolOnboardingAction();

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      router.push("/admin");
    });
  }

  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
      <style>{`
        @keyframes edujay-setup-ring {
          from { stroke-dashoffset: 326; }
          to { stroke-dashoffset: 0; }
        }

        @keyframes edujay-setup-fade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes edujay-setup-check {
          0% { opacity: 0; transform: scale(0.78); }
          70% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div className="relative flex h-40 w-40 items-center justify-center">
        <svg className="absolute inset-0 h-40 w-40 -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="#dbeafe"
            strokeWidth="8"
          />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="#1d4ed8"
            strokeLinecap="round"
            strokeWidth="8"
            style={{
              strokeDasharray: 326,
              strokeDashoffset: 326,
              animation: "edujay-setup-ring 1.2s ease-out forwards",
            }}
          />
        </svg>
        <div
          className="relative flex h-24 w-24 items-center justify-center rounded-full bg-blue-700 text-white shadow-sm"
          style={{ animation: "edujay-setup-check 520ms ease-out 620ms both" }}
        >
          <Check className="h-12 w-12" />
        </div>
      </div>

      <div style={{ animation: "edujay-setup-fade 520ms ease-out 900ms both" }}>
        <h2 className="mt-6 text-3xl font-black tracking-tight text-gray-950">
          All set. Welcome to Edujay.
        </h2>
        <p className="mt-3 max-w-lg text-sm leading-6 text-gray-500">
          {school.name} is ready for the live admin dashboard. Teachers, students,
          parents, finance, and timetable setup can continue from there.
        </p>
      </div>

      <div className="mt-6 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <p className="text-2xl font-black text-gray-950">{school._count.classes}</p>
          <p className="mt-1 text-xs font-bold uppercase text-gray-500">Classes</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <p className="text-2xl font-black text-gray-950">{school._count.subjects}</p>
          <p className="mt-1 text-xs font-bold uppercase text-gray-500">Subjects</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <p className="text-2xl font-black text-gray-950">
            {school._count.teachers + school._count.students}
          </p>
          <p className="mt-1 text-xs font-bold uppercase text-gray-500">People started</p>
        </div>
      </div>

      {message ? (
        <div className="mt-5 max-w-xl rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {message}
        </div>
      ) : null}

      <button
        type="button"
        onClick={completeSetup}
        disabled={isPending}
        className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {isPending ? "Completing setup..." : "Enter Admin Dashboard"}
      </button>
    </div>
  );
}
