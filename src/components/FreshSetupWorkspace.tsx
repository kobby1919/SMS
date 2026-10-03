"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, Loader2, Receipt, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { createDefaultAcademicSetupAction } from "@/src/lib/actions/onboardingActions";

type FreshSetupSchool = {
  _count: {
    grades: number;
    classes: number;
    subjects: number;
    teachers: number;
    students: number;
  };
};

function statusLabel(done: boolean) {
  return done ? "Started" : "Needs setup";
}

export default function FreshSetupWorkspace({ school }: { school: FreshSetupSchool }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const academicsReady = school._count.grades > 0 && school._count.classes > 0 && school._count.subjects > 0;
  const peopleStarted = school._count.teachers > 0 || school._count.students > 0;

  function createFoundation() {
    setMessage(null);
    startTransition(async () => {
      const result = await createDefaultAcademicSetupAction();

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      setMessage("Academic foundation created. You can now refine classes and subjects before adding people.");
    });
  }

  const areas = [
    {
      title: "Academic foundation",
      description: "Set grades, classes, and subjects before users and timetable work begin.",
      status: statusLabel(academicsReady),
      done: academicsReady,
      count: `${school._count.classes} classes · ${school._count.subjects} subjects`,
      href: "/list/classes",
      icon: BookOpen,
      action: "Review classes",
    },
    {
      title: "People setup",
      description: "Add or invite teachers first, then students and parents.",
      status: statusLabel(peopleStarted),
      done: peopleStarted,
      count: `${school._count.teachers} teachers · ${school._count.students} students`,
      href: "/list/teachers",
      icon: Users,
      action: "Open teachers",
    },
    {
      title: "Finance setup",
      description: "Configure payment settings and fee rules before real collections begin.",
      status: "Pending",
      done: false,
      count: "Fees and payment rules",
      href: "/admin/payment-settings",
      icon: Receipt,
      action: "Open finance setup",
    },
    {
      title: "Timetable setup",
      description: "Build and publish the master timetable after classes, subjects, and teachers are ready.",
      status: "Pending",
      done: false,
      count: "Published timetable required",
      href: "/admin/timetable",
      icon: CalendarDays,
      action: "Open timetable",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
        Start fresh means Edujay will guide the admin to create clean school records directly in the
        system. Create the academic foundation first, then add people, finance, and timetable.
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-blue-700">Recommended first action</p>
            <h2 className="mt-2 text-xl font-black text-gray-950">Create academic foundation</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Edujay can create a simple default foundation for grades, classes, and core subjects.
              The admin can edit it immediately after creation.
            </p>
          </div>
          <button
            type="button"
            onClick={createFoundation}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {academicsReady ? "Refresh foundation" : "Create foundation"}
          </button>
        </div>

        {message ? (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {message}
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {areas.map((area) => {
          const Icon = area.icon;

          return (
            <Link
              key={area.title}
              href={area.href}
              className="group flex min-h-[210px] flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    area.done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {area.status}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-black text-gray-950">{area.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-500">{area.description}</p>
              <p className="mt-4 text-sm font-bold text-gray-700">{area.count}</p>
              <span className="mt-auto flex items-center gap-2 pt-5 text-sm font-black text-blue-700">
                {area.action}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-gray-950">Ready to check setup?</p>
          <p className="mt-1 text-sm text-gray-500">
            Use readiness review after the core records are in place.
          </p>
        </div>
        <Link
          href="/onboarding/setup/review"
          className="rounded-xl bg-white px-4 py-3 text-center text-sm font-black text-gray-900 shadow-sm"
        >
          Review readiness
        </Link>
      </div>
    </div>
  );
}
