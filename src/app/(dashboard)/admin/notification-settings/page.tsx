import { BellRing, Clock, Mail, MessageSquareText, Smartphone } from "lucide-react";
import { requirePageSession } from "@/src/lib/authz";
import { ensureDefaultSchoolNotificationSettings } from "@/src/lib/services/parent-notification-delivery";
import { updateSchoolNotificationSettings } from "@/src/lib/actions/parentNotificationSettingsActions";

export const dynamic = "force-dynamic";

const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

const AdminNotificationSettingsPage = async () => {
  const { schoolId } = await requirePageSession(["admin"]);
  const settings = await ensureDefaultSchoolNotificationSettings(schoolId);

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-sky-400/10 p-2 text-sky-200">
            <BellRing size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black">Parent Notification Settings</h1>
            <p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Configure when Edujay sends parent daily summaries for this school and which delivery channels are allowed.
            </p>
          </div>
        </div>
      </div>

      <form action={updateSchoolNotificationSettings} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-400">Timezone</span>
            <input name="timezone" defaultValue={settings.timezone} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400" />
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
            <span className="text-xs font-black uppercase tracking-wide text-gray-400">Summary send time</span>
            <input type="time" name="dailySummarySendTime" defaultValue={settings.dailySummarySendTime} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400" />
          </label>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2">
            <Clock size={16} className="text-sky-600" />
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

        <div className="mt-6 flex justify-end">
          <button className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-slate-800">
            Save notification settings
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminNotificationSettingsPage;
