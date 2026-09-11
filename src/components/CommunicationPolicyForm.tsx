"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Clock3, MessageCircle, ShieldCheck } from "lucide-react";
import type { SchoolCommunicationPolicy, SchoolCommunicationRoute } from "@/src/generated/prisma";
import {
  updateSchoolCommunicationPolicyWithState,
  type CommunicationPolicyActionState,
} from "@/src/lib/actions/communicationPolicyActions";

const initialState: CommunicationPolicyActionState = {
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
      {pending ? "Saving..." : "Save communication policy"}
    </button>
  );
}

function Toggle({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1" />
      <span>
        <span className="block text-sm font-black text-gray-900">{label}</span>
        <span className="mt-1 block text-xs font-semibold leading-relaxed text-gray-500">{description}</span>
      </span>
    </label>
  );
}

export default function CommunicationPolicyForm({
  policy,
  routes,
  teachers,
}: {
  policy: SchoolCommunicationPolicy;
  routes: SchoolCommunicationRoute[];
  teachers: { id: string; name: string; surname: string }[];
}) {
  const [state, formAction] = useActionState(updateSchoolCommunicationPolicyWithState, initialState);
  const routeByCategory = new Map(routes.map((route) => [route.category, route]));
  const routeLabels = [
    { category: "ATTENDANCE", label: "Attendance", help: "Late, absent, or attendance follow-up." },
    { category: "ACADEMIC_SUPPORT", label: "Academic support", help: "CA progress, classwork, exam preparation." },
    { category: "HOMEWORK", label: "Homework", help: "Homework issue, submission, missing work." },
    { category: "FINANCE", label: "Fees and payments", help: "Bill balance, receipt, payment, discount, or finance follow-up." },
    { category: "WELLBEING", label: "Wellbeing", help: "Behaviour, health, safety, emotional support." },
    { category: "GENERAL", label: "General", help: "Anything that does not fit another category." },
  ] as const;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h2 className="text-base font-black text-gray-950">Access Rules</h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-gray-500">
              Decide whether parents can contact teachers directly and what teacher details may be visible.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Toggle
            name="enabled"
            label="Communication policy enabled"
            description="Keep this on so Edujay enforces one school-wide rule."
            defaultChecked={policy.enabled}
          />
          <Toggle
            name="allowParentTeacherMessaging"
            label="Allow parent-teacher messaging"
            description="Parents can start approved contact flows when this is enabled."
            defaultChecked={policy.allowParentTeacherMessaging}
          />
          <Toggle
            name="exposeTeacherPhone"
            label="Show teacher phone numbers"
            description="Only enable this if the school wants parents to see teacher phone numbers."
            defaultChecked={policy.exposeTeacherPhone}
          />
          <Toggle
            name="exposeTeacherEmail"
            label="Show teacher email addresses"
            description="Only enable this if the school wants parents to see teacher email addresses."
            defaultChecked={policy.exposeTeacherEmail}
          />
          <Toggle
            name="requireParentReason"
            label="Require a parent reason"
            description="Parents must choose or write why they are contacting a teacher."
            defaultChecked={policy.requireParentReason}
          />
          <Toggle
            name="requireTeacherResponse"
            label="Require teacher response"
            description="Open parent messages remain trackable until a teacher responds."
            defaultChecked={policy.requireTeacherResponse}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
            <MessageCircle size={18} />
          </div>
          <div>
            <h2 className="text-base font-black text-gray-950">Concern Routing</h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-gray-500">
              Choose who receives each parent concern type. This keeps parents from guessing and protects teachers from random contact.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {routeLabels.map((item) => {
            const route = routeByCategory.get(item.category);
            const routeTargetName = `routeTarget_${item.category}`;
            const selectedTeacherName = `selectedTeacherId_${item.category}`;

            return (
              <div key={item.category} className="grid gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 lg:grid-cols-[1fr_220px_260px]">
                <div>
                  <p className="text-sm font-black text-gray-900">{item.label}</p>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-500">{item.help}</p>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-wide text-gray-400">Route to</span>
                  <select name={routeTargetName} defaultValue={route?.target ?? (item.category === "ACADEMIC_SUPPORT" || item.category === "HOMEWORK" ? "SUBJECT_TEACHER" : item.category === "FINANCE" ? "SCHOOL_OFFICE" : "CLASS_TEACHER")} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400">
                    <option value="SUBJECT_TEACHER">Subject teacher</option>
                    <option value="CLASS_TEACHER">Class teacher</option>
                    <option value="SELECTED_TEACHER">Selected teacher</option>
                    <option value="SCHOOL_OFFICE">School office fallback</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-wide text-gray-400">Selected teacher</span>
                  <select name={selectedTeacherName} defaultValue={route?.selectedTeacherId ?? ""} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400">
                    <option value="">Only needed for selected teacher</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name} {teacher.surname}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
            <MessageCircle size={18} />
          </div>
          <div>
            <h2 className="text-base font-black text-gray-950">Allowed Channels</h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-gray-500">
              These switches prepare the system for in-app, email, SMS, and WhatsApp delivery without hardcoding channels.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Toggle
            name="allowInAppMessages"
            label="In-app"
            description="Use Edujay notifications and inbox flows."
            defaultChecked={policy.allowInAppMessages}
          />
          <Toggle
            name="allowEmailMessages"
            label="Email"
            description="Allow school-approved email delivery."
            defaultChecked={policy.allowEmailMessages}
          />
          <Toggle
            name="allowSmsMessages"
            label="SMS"
            description="Reserve SMS for parents who prefer phone delivery."
            defaultChecked={policy.allowSmsMessages}
          />
          <Toggle
            name="allowWhatsappMessages"
            label="WhatsApp"
            description="Reserve WhatsApp for future provider integration."
            defaultChecked={policy.allowWhatsappMessages}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-xl bg-amber-50 p-2 text-amber-700">
            <Clock3 size={18} />
          </div>
          <div>
            <h2 className="text-base font-black text-gray-950">Time And Escalation Rules</h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-gray-500">
              Control when parents can expect replies and when unresolved contact should be escalated.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-400">Contact start</span>
            <input type="time" name="contactStartTime" defaultValue={policy.contactStartTime} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-400">Contact end</span>
            <input type="time" name="contactEndTime" defaultValue={policy.contactEndTime} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-400">Quiet hours start</span>
            <input type="time" name="quietHoursStart" defaultValue={policy.quietHoursStart} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-400">Quiet hours end</span>
            <input type="time" name="quietHoursEnd" defaultValue={policy.quietHoursEnd} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-400">Response SLA hours</span>
            <input type="number" min={1} max={168} name="responseSlaHours" defaultValue={policy.responseSlaHours} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-400">Escalate after hours</span>
            <input type="number" min={1} max={336} name="escalateAfterHours" defaultValue={policy.escalateAfterHours} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400" />
          </label>
          <Toggle
            name="escalationEnabled"
            label="Escalations enabled"
            description="Unanswered communication can be reviewed by school leadership."
            defaultChecked={policy.escalationEnabled}
          />
          <Toggle
            name="urgentBypassesQuietHours"
            label="Urgent bypass"
            description="Critical messages may bypass quiet hours."
            defaultChecked={policy.urgentBypassesQuietHours}
          />
        </div>
      </section>

      <div className="flex flex-col items-end gap-3">
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
