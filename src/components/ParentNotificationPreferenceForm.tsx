"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateParentNotificationPreferenceWithState,
  type ParentPreferenceActionState,
} from "@/src/lib/actions/parentNotificationSettingsActions";
import type { ParentDeliveryChannel, ParentNotificationPreference } from "@/src/generated/prisma";

type ParentNotificationPreferenceFormProps = {
  contactEmail?: string | null;
  contactPhone?: string | null;
  preference?: ParentNotificationPreference | null;
};

const initialState: ParentPreferenceActionState = {
  status: "idle",
  message: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
    >
      {pending ? "Saving..." : "Save preferences"}
    </button>
  );
}

export default function ParentNotificationPreferenceForm({
  contactEmail,
  contactPhone,
  preference,
}: ParentNotificationPreferenceFormProps) {
  const [state, formAction] = useActionState(updateParentNotificationPreferenceWithState, initialState);
  const preferredChannel = (preference?.preferredChannel ?? "WHATSAPP") as ParentDeliveryChannel;
  const fallbackChannel = (preference?.fallbackChannel ?? "SMS") as ParentDeliveryChannel;

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-black text-gray-900">Delivery Preferences</h2>
          <p className="mt-1 text-xs font-semibold text-gray-400">
            Contact on file: {contactPhone || "no phone"} {contactEmail ? `- ${contactEmail}` : "- no email"}
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-4 grid gap-3 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase text-gray-400">Preferred</span>
          <select
            name="preferredChannel"
            defaultValue={preferredChannel}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold"
          >
            <option value="WHATSAPP">WhatsApp</option>
            <option value="SMS">SMS</option>
            <option value="EMAIL">Email</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase text-gray-400">Fallback</span>
          <select
            name="fallbackChannel"
            defaultValue={fallbackChannel}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold"
          >
            <option value="SMS">SMS</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="EMAIL">Email</option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2 lg:col-span-1">
          <label className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-black text-gray-600">
            <input type="checkbox" name="dailySummaryEnabled" defaultChecked={preference?.dailySummaryEnabled ?? true} />
            Daily
          </label>
          <label className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-black text-gray-600">
            <input type="checkbox" name="urgentAlertsEnabled" defaultChecked={preference?.urgentAlertsEnabled ?? true} />
            Urgent
          </label>
          <label className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-black text-gray-600">
            <input type="checkbox" name="emailEnabled" defaultChecked={preference?.emailEnabled ?? true} />
            Email
          </label>
          <label className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-black text-gray-600">
            <input type="checkbox" name="smsEnabled" defaultChecked={preference?.smsEnabled ?? true} />
            SMS
          </label>
          <label className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-black text-gray-600">
            <input type="checkbox" name="whatsappEnabled" defaultChecked={preference?.whatsappEnabled ?? true} />
            WhatsApp
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <SubmitButton />
          {state.status !== "idle" && (
            <p
              role="status"
              className={`rounded-xl px-3 py-2 text-xs font-black ${
                state.status === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              {state.message}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
