"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  completeSchoolOnboardingAction,
  createDefaultAcademicSetupAction,
  recordOnboardingImportAction,
  updateSchoolProfileSetupAction,
} from "@/src/lib/actions/onboardingActions";

type SchoolSetupState = {
  id: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
  onboardingStatus: string;
  onboardingAuditLogs: {
    id: number;
    action: string;
    performedBy: string;
    metadata: unknown;
    createdAt: Date;
  }[];
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
    logoUrl: school.logoUrl ?? "",
  });
  const [importValues, setImportValues] = useState({
    importType: "teachers" as "teachers" | "students",
    fileName: "",
    rowCount: "0",
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

  function createDefaults() {
    startTransition(async () => {
      const result = await createDefaultAcademicSetupAction();
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setMessage("Default grades, classes, and subjects created.");
      router.refresh();
    });
  }

  function recordImport() {
    startTransition(async () => {
      const result = await recordOnboardingImportAction({
        ...importValues,
        rowCount: Number(importValues.rowCount),
      });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setImportValues({ importType: "teachers", fileName: "", rowCount: "0" });
      setMessage("Import has been recorded in the onboarding audit log.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <ProgressCard label="Profile" done={Boolean(school.name)} />
        <ProgressCard label="Grades" done={school._count.grades > 0} />
        <ProgressCard label="Classes" done={school._count.classes > 0} />
        <ProgressCard label="Subjects" done={school._count.subjects > 0} />
      </div>

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
          <label className="block">
            <span className="text-xs font-bold uppercase text-gray-500">Logo URL</span>
            <input
              value={values.logoUrl}
              onChange={(event) => update("logoUrl", event.target.value)}
              placeholder="https://..."
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <span className="mt-1 block text-xs text-gray-400">
              Use a secure hosted image URL for now. File storage can be connected later.
            </span>
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
            <button
              type="button"
              onClick={createDefaults}
              disabled={isPending}
              className="rounded-lg bg-gray-900 px-3 py-2 text-center text-xs font-bold text-white disabled:opacity-50"
            >
              Create default academics
            </button>
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

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-gray-900">Import checkpoint</h2>
          <p className="mt-1 text-sm text-gray-500">
            Record staff or student imports during onboarding so setup history is visible.
          </p>
          <div className="mt-4 grid gap-3">
            <select
              value={importValues.importType}
              onChange={(event) =>
                setImportValues((current) => ({
                  ...current,
                  importType: event.target.value as "teachers" | "students",
                }))
              }
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="teachers">Teachers</option>
              <option value="students">Students</option>
            </select>
            <input
              value={importValues.fileName}
              onChange={(event) =>
                setImportValues((current) => ({ ...current, fileName: event.target.value }))
              }
              placeholder="spreadsheet-name.csv"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <input
              value={importValues.rowCount}
              type="number"
              min="0"
              onChange={(event) =>
                setImportValues((current) => ({ ...current, rowCount: event.target.value }))
              }
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={recordImport}
              disabled={isPending || !importValues.fileName}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 disabled:opacity-50"
            >
              Record import
            </button>
          </div>
        </div>
      </aside>
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-gray-900">Recent onboarding activity</h2>
        <div className="mt-4 grid gap-2">
          {school.onboardingAuditLogs.length === 0 ? (
            <p className="text-sm text-gray-500">No activity recorded yet.</p>
          ) : (
            school.onboardingAuditLogs.map((log) => (
              <div
                key={log.id}
                className="flex flex-col justify-between gap-1 rounded-lg bg-gray-50 px-3 py-2 text-sm sm:flex-row"
              >
                <span className="font-semibold text-gray-700">
                  {log.action.replaceAll("_", " ").toLowerCase()}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function ProgressCard({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase text-gray-400">{label}</p>
      <p className={`mt-2 text-sm font-black ${done ? "text-emerald-700" : "text-gray-500"}`}>
        {done ? "Complete" : "Pending"}
      </p>
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
