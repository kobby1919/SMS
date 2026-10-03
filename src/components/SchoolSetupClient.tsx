"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSchoolProfileSetupAction } from "@/src/lib/actions/onboardingActions";

type SchoolSetupState = {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  legalName: string | null;
  displayName: string | null;
  shortName: string | null;
  primaryColor: string;
  contactEmail: string | null;
  phone: string | null;
  address: string | null;
  onboardingStatus: string;
  setupStep: string | null;
};

export default function SchoolSetupClient({ school }: { school: SchoolSetupState }) {
  const router = useRouter();
  const [values, setValues] = useState({
    name: school.name,
    code: school.code ?? "",
    legalName: school.legalName ?? school.name,
    displayName: school.displayName ?? school.name,
    shortName: school.shortName ?? school.name,
    primaryColor: school.primaryColor ?? "#2563eb",
    contactEmail: school.contactEmail ?? "",
    phone: school.phone ?? "",
    address: school.address ?? "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
      router.push(school.onboardingStatus === "COMPLETED" ? "/admin" : "/onboarding/setup/path");
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-gray-900">School identity</h2>
        <p className="mt-1 text-sm text-gray-500">
          Confirm the official school details first. Edujay will use this identity on
          dashboards, receipts, parent updates, and school-facing documents.
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
            <span className="text-xs font-bold uppercase text-gray-500">School code</span>
            <input
              value={values.code}
              onChange={(event) => update("code", event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              placeholder="e.g. SMS"
              maxLength={6}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-black uppercase tracking-wide outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <span className="mt-1 block text-xs text-gray-400">
              Required for Edujay admission numbers. Use 3-6 uppercase letters or numbers, no spaces.
            </span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase text-gray-500">Legal name</span>
              <input
                value={values.legalName}
                onChange={(event) => update("legalName", event.target.value)}
                placeholder={values.name}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-gray-500">Parent display name</span>
              <input
                value={values.displayName}
                onChange={(event) => update("displayName", event.target.value)}
                placeholder={values.name}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-gray-500">Short name</span>
              <input
                value={values.shortName}
                onChange={(event) => update("shortName", event.target.value)}
                placeholder="e.g. Bright Future"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-bold uppercase text-gray-500">Primary brand color</span>
            <div className="mt-1 flex gap-2">
              <input
                type="color"
                value={values.primaryColor}
                onChange={(event) => update("primaryColor", event.target.value)}
                className="h-10 w-14 rounded-lg border border-gray-200 bg-white p-1"
              />
              <input
                value={values.primaryColor}
                onChange={(event) => update("primaryColor", event.target.value)}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <span className="mt-1 block text-xs text-gray-400">
              Used on parent emails, receipts, and school-facing documents.
            </span>
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
          {isPending ? "Saving..." : "Save and continue"}
        </button>
      </section>

      {message && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-medium text-blue-950">
          {message}
        </div>
      )}
    </div>
  );
}
