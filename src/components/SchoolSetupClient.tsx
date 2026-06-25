"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  completeSchoolOnboardingAction,
  updateSchoolProfileSetupAction,
} from "@/src/lib/actions/onboardingActions";

type SchoolSetupState = {
  id: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  phone: string | null;
  address: string | null;
  onboardingStatus: string;
  _count: {
    grades: number;
    classes: number;
    subjects: number;
    teachers: number;
    students: number;
  };
};

export default function SchoolSetupClient({ school }: { school: SchoolSetupState }) {
  const router = useRouter();
  const [values, setValues] = useState({
    name: school.name,
    contactEmail: school.contactEmail ?? "",
    phone: school.phone ?? "",
    address: school.address ?? "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasAcademicBase =
    school._count.grades > 0 && school._count.classes > 0 && school._count.subjects > 0;

  function update(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setMessage(null);
  }

  function saveProfile() {
    startTransition(async () => {
      const result = await updateSchoolProfileSetupAction(values);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setMessage("School profile saved. Continue with academic setup.");
      router.refresh();
    });
  }

  function finishSetup() {
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
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-gray-900">School profile</h2>
        <p className="mt-1 text-sm text-gray-500">
          Confirm the basics. These details become the tenant profile for this school.
        </p>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs font-bold uppercase text-gray-500">School name</span>
            <input
              value={values.name}
              onChange={(event) => update("name", event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase text-gray-500">Contact email</span>
            <input
              value={values.contactEmail}
              onChange={(event) => update("contactEmail", event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase text-gray-500">Phone</span>
            <input
              value={values.phone}
              onChange={(event) => update("phone", event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase text-gray-500">Address</span>
            <textarea
              value={values.address}
              onChange={(event) => update("address", event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={saveProfile}
          disabled={isPending}
          className="mt-5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save profile"}
        </button>
      </section>

      <aside className="space-y-4">
        {message && (
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-medium text-blue-950">
            {message}
          </div>
        )}

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-gray-900">Setup checklist</h2>
          <div className="mt-4 space-y-3 text-sm">
            <ChecklistItem done={Boolean(school.name)} label="School profile created" />
            <ChecklistItem done={school._count.grades > 0} label="At least one grade" />
            <ChecklistItem done={school._count.classes > 0} label="At least one class" />
            <ChecklistItem done={school._count.subjects > 0} label="At least one subject" />
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            <Link
              href="/list/classes"
              className="rounded-lg border border-gray-200 px-3 py-2 text-center text-xs font-bold text-gray-700"
            >
              Add classes
            </Link>
            <Link
              href="/list/subjects"
              className="rounded-lg border border-gray-200 px-3 py-2 text-center text-xs font-bold text-gray-700"
            >
              Add subjects
            </Link>
            <Link
              href="/list/teachers"
              className="rounded-lg border border-gray-200 px-3 py-2 text-center text-xs font-bold text-gray-700"
            >
              Add teachers
            </Link>
          </div>

          <button
            type="button"
            onClick={finishSetup}
            disabled={isPending || !hasAcademicBase}
            className="mt-5 w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Finish setup
          </button>
          {!hasAcademicBase && (
            <p className="mt-2 text-xs leading-5 text-gray-400">
              Add at least one grade, class, and subject before unlocking the admin dashboard.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
      <span className="text-gray-600">{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
          done ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-500"
        }`}
      >
        {done ? "Done" : "Needed"}
      </span>
    </div>
  );
}
