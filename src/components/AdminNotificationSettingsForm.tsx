"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarClock, Mail, MessageSquareText, Smartphone } from "lucide-react";
import type { SchoolNotificationSetting } from "@/src/generated/prisma";
import {
  updateSchoolNotificationSettingsWithState,
  type SchoolNotificationSettingsActionState,
} from "@/src/lib/actions/parentNotificationSettingsActions";

const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

const initialState: SchoolNotificationSettingsActionState = {
  status: "idle",
  message: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      disabled={pending}
      className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
    >
      {pending ? "Saving..." : "Save notification settings"}
    </button>
  );
}

export default function AdminNotificationSettingsForm({
  settings,
}: {
  settings: SchoolNotificationSetting;
}) {
  const [state, formAction] = useActionState(updateSchoolNotificationSettingsWithState, initialState);

  return (
    <form action={formAction} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-black uppercase tracking-wide text-gray-400">Timezone</span>
          <input name="timezone" defaultValue={settings.timezone} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-black uppercase tracking-wide text-gray-400">Summary rhythm</span>
          <select name="summaryCadence" defaultValue={settings.summaryCadence} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400">
            <option value="WEEKLY">Weekly summaries</option>
            <option value="DAILY">Daily summaries</option>
            <option value="BOTH">Daily and weekly</option>
            <option value="OFF">Paused</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-black uppercase tracking-wide text-gray-400">Opening time</span>
          <input type="time" name="openingTime" defaultValue={settings.openingTime} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-black uppercase tracking-wide text-gray-400">Closing time</span>
          <input type="time" name="closingTime" defaultValue={settings.closingTime} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-black uppercase tracking-wide text-gray-400">Daily send time</span>
          <input type="time" name="dailySummarySendTime" defaultValue={settings.dailySummarySendTime} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400" />
        </label>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-black uppercase tracking-wide text-gray-400">Weekly send day</span>
          <select name="weeklySummarySendDay" defaultValue={settings.weeklySummarySendDay} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400">
            {days.map((day) => (
              <option key={day} value={day}>
                {day.charAt(0) + day.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-black uppercase tracking-wide text-gray-400">Weekly send time</span>
          <input type="time" name="weeklySummarySendTime" defaultValue={settings.weeklySummarySendTime} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400" />
        </label>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center gap-2">
          <CalendarClock size={16} className="text-sky-600" />
          <p className="text-sm font-black text-gray-800">Active school days</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {days.map((day) => (
            <label key={day} className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-black text-gray-600">
              <input type="checkbox" name="activeDays" value={day} defaultChecked={settings.activeDays.includes(day)} />
              {day.slice(0, 3)}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <label className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <input type="checkbox" name="emailEnabled" defaultChecked={settings.emailEnabled} />
          <Mail className="h-5 w-5 text-sky-600" />
          <span className="text-sm font-black text-gray-800">Email enabled</span>
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <input type="checkbox" name="smsEnabled" defaultChecked={settings.smsEnabled} />
          <Smartphone className="h-5 w-5 text-emerald-600" />
          <span className="text-sm font-black text-gray-800">SMS enabled</span>
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <input type="checkbox" name="whatsappEnabled" defaultChecked={settings.whatsappEnabled} />
          <MessageSquareText className="h-5 w-5 text-green-600" />
          <span className="text-sm font-black text-gray-800">WhatsApp enabled</span>
        </label>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-black uppercase tracking-wide text-gray-400">Quiet hours start</span>
          <input type="time" name="quietHoursStart" defaultValue={settings.quietHoursStart} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-black uppercase tracking-wide text-gray-400">Quiet hours end</span>
          <input type="time" name="quietHoursEnd" defaultValue={settings.quietHoursEnd} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400" />
        </label>
        <label className="mt-5 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-black text-rose-700 md:mt-6">
          <input type="checkbox" name="urgentAlertsImmediate" defaultChecked={settings.urgentAlertsImmediate} />
          Urgent alerts send immediately
        </label>
      </div>

      <div className="mt-6 flex flex-col items-end gap-3">
        <SubmitButton />
        {state.status !== "idle" && (
          <p
            role="status"
            className={`rounded-xl px-4 py-2 text-sm font-black ${
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
  );
}
