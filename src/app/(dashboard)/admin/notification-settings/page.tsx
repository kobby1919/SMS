import { BellRing } from "lucide-react";
import { requirePageSession } from "@/src/lib/authz";
import { ensureDefaultSchoolNotificationSettings } from "@/src/lib/services/parent-notification-delivery";
import AdminNotificationSettingsForm from "@/src/components/AdminNotificationSettingsForm";

export const dynamic = "force-dynamic";

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
              Configure when Edujay sends parent summaries for this school and which delivery channels are allowed.
            </p>
          </div>
        </div>
      </div>

      <AdminNotificationSettingsForm settings={settings} />
    </div>
  );
};

export default AdminNotificationSettingsPage;
