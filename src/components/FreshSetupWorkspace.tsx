"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Layers3,
  Loader2,
  Receipt,
  School,
  Users,
} from "lucide-react";
import { useState, useTransition } from "react";
import { createDefaultAcademicSetupAction } from "@/src/lib/actions/onboardingActions";

type FreshSetupSchool = {
  _count: {
    grades: number;
    classes: number;
    subjects: number;
    teachers: number;
    students: number;
    parents: number;
    feeStructures: number;
  };
  readiness: {
    activeParentLinks: number;
    feeSetupStarted: boolean;
    feeStructuresStarted: boolean;
    activeTimetablePublished: boolean;
  };
};

function statusLabel(done: boolean, disabled = false) {
  if (done) return "Completed";
  if (disabled) return "Waiting";
  return "Needs setup";
}

export default function FreshSetupWorkspace({ school }: { school: FreshSetupSchool }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const academicStructureReady = school._count.grades > 0;
  const classesReady = school._count.classes > 0;
  const subjectsReady = school._count.subjects > 0;
  const teachersReady = school._count.teachers > 0;
  const studentsReady = school._count.students > 0;
  const parentsReady = school._count.parents > 0 || school.readiness.activeParentLinks > 0;
  const feesReady = school.readiness.feeSetupStarted || school.readiness.feeStructuresStarted;
  const timetableReady = school.readiness.activeTimetablePublished;

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
      title: "Academic structure",
      description: "Create the school levels or grades that classes belong to.",
      status: statusLabel(academicStructureReady),
      done: academicStructureReady,
      disabled: false,
      count: `${school._count.grades} grades`,
      href: "/list/classes",
      icon: Layers3,
      action: academicStructureReady ? "Review structure" : "Create structure",
    },
    {
      title: "Classes",
      description: "Set up classrooms so students, attendance, timetable, and reports have a home.",
      status: statusLabel(classesReady),
      done: classesReady,
      disabled: false,
      count: `${school._count.classes} classes`,
      href: "/list/classes",
      icon: School,
      action: classesReady ? "Review classes" : "Create classes",
    },
    {
      title: "Subjects",
      description: "Add the subjects the school teaches before assigning teacher capability.",
      status: statusLabel(subjectsReady),
      done: subjectsReady,
      disabled: false,
      count: `${school._count.subjects} subjects`,
      href: "/list/subjects",
      icon: BookOpen,
      action: subjectsReady ? "Review subjects" : "Create subjects",
    },
    {
      title: "Teachers",
      description: "Invite or add teachers after classes and subjects have started.",
      status: statusLabel(teachersReady, !classesReady || !subjectsReady),
      done: teachersReady,
      disabled: !classesReady || !subjectsReady,
      count: `${school._count.teachers} teachers`,
      href: "/list/teachers",
      icon: Users,
      action: teachersReady ? "Review teachers" : "Add teachers",
    },
    {
      title: "Students",
      description: "Add students manually or import them after classes are ready.",
      status: statusLabel(studentsReady, !classesReady),
      done: studentsReady,
      disabled: !classesReady,
      count: `${school._count.students} students`,
      href: "/list/students",
      icon: GraduationCap,
      action: studentsReady ? "Review students" : "Add students",
    },
    {
      title: "Parents",
      description: "Create parent profiles and link them to the right wards.",
      status: statusLabel(parentsReady, !studentsReady),
      done: parentsReady,
      disabled: !studentsReady,
      count: `${school._count.parents} parents · ${school.readiness.activeParentLinks} links`,
      href: "/list/parents",
      icon: Users,
      action: parentsReady ? "Review parents" : "Link parents",
    },
    {
      title: "Fees",
      description: "Prepare fee structures or payment settings before collections begin.",
      status: statusLabel(feesReady),
      done: feesReady,
      disabled: false,
      count: school.readiness.feeStructuresStarted ? `${school._count.feeStructures} fee structures` : "Fee setup not started",
      href: "/admin/payment-settings",
      icon: Receipt,
      action: feesReady ? "Review fees" : "Set up fees",
    },
    {
      title: "Timetable",
      description: "Build and publish the master timetable after classes, subjects, and teachers are stable.",
      status: timetableReady ? "Completed" : "Can be done later",
      done: timetableReady,
      disabled: !classesReady || !subjectsReady || !teachersReady,
      count: timetableReady ? "Published timetable found" : "Not published yet",
      href: "/admin/timetable",
      icon: CalendarDays,
      action: timetableReady ? "Review timetable" : "Set timetable",
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
            {academicStructureReady && classesReady && subjectsReady ? "Refresh foundation" : "Create foundation"}
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
          const disabled = area.disabled && !area.done;
          const cardClassName = `group flex min-h-[210px] flex-col rounded-2xl border p-5 shadow-sm transition ${
            disabled
              ? "border-gray-100 bg-gray-50 opacity-75"
              : "border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50"
          }`;
          const content = (
            <>
              <div className="flex items-start justify-between gap-4">
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                  disabled ? "bg-gray-100 text-gray-500" : "bg-blue-100 text-blue-700"
                }`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    area.done
                      ? "bg-emerald-100 text-emerald-700"
                      : disabled
                        ? "bg-gray-200 text-gray-500"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {area.status}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-black text-gray-950">{area.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-500">{area.description}</p>
              <p className="mt-4 text-sm font-bold text-gray-700">{area.count}</p>
              <span
                className={`mt-auto flex items-center gap-2 pt-5 text-sm font-black ${
                  disabled ? "text-gray-400" : "text-blue-700"
                }`}
              >
                {disabled ? "Complete earlier steps first" : area.action}
                {!disabled ? <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /> : null}
              </span>
            </>
          );

          return disabled ? (
            <div key={area.title} className={cardClassName}>
              {content}
            </div>
          ) : (
            <Link
              key={area.title}
              href={area.href}
              className={cardClassName}
            >
              {content}
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
