import { ShieldCheck } from "lucide-react";
import { requirePageSession } from "@/src/lib/authz";
import TeacherAccountabilitySettingsForm from "@/src/components/TeacherAccountabilitySettingsForm";
import { ensureDefaultTeacherAccountabilitySettings } from "@/src/lib/services/teacher-accountability-settings";

export const dynamic = "force-dynamic";

const AdminAccountabilitySettingsPage = async () => {
  const { schoolId } = await requirePageSession(["admin"]);
  const settings = await ensureDefaultTeacherAccountabilitySettings(schoolId);

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-sky-400/10 p-2 text-sky-200">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black">
              Teacher Accountability Settings
            </h1>
            <p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Configure how Edujay keeps teachers disciplined using timetable
              periods, CA activity follow-through, homework checks, syllabus
              progress, reminders, and correction approvals.
            </p>
          </div>
        </div>
      </div>

      <TeacherAccountabilitySettingsForm settings={settings} />
    </div>
  );
};

export default AdminAccountabilitySettingsPage;

