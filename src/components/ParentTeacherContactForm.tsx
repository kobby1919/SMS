"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MessageCircle } from "lucide-react";
import {
  createParentTeacherContactRequestWithState,
  type ParentTeacherContactActionState,
} from "@/src/lib/actions/parentTeacherContactActions";

type ContactPolicy = {
  enabled: boolean;
  allowParentTeacherMessaging: boolean;
  allowInAppMessages: boolean;
  allowEmailMessages: boolean;
  allowSmsMessages: boolean;
  allowWhatsappMessages: boolean;
  responseSlaHours: number;
};

const initialState: ParentTeacherContactActionState = {
  status: "idle",
  message: "",
};

const categories = [
  { value: "ATTENDANCE", label: "Attendance" },
  { value: "ACADEMIC_SUPPORT", label: "Academic support" },
  { value: "HOMEWORK", label: "Homework" },
  { value: "WELLBEING", label: "Wellbeing" },
  { value: "GENERAL", label: "General" },
];

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      <MessageCircle size={16} />
      {pending ? "Sending..." : "Send request"}
    </button>
  );
}

export default function ParentTeacherContactForm({
  studentId,
  teacherId,
  teacherName,
  policy,
}: {
  studentId: string;
  teacherId: string;
  teacherName: string;
  policy: ContactPolicy;
}) {
  const [state, formAction] = useActionState(createParentTeacherContactRequestWithState, initialState);
  const enabled = policy.enabled && policy.allowParentTeacherMessaging;
  const channels = [
    policy.allowInAppMessages ? { value: "IN_APP", label: "In-app" } : null,
    policy.allowEmailMessages ? { value: "EMAIL", label: "Email" } : null,
    policy.allowSmsMessages ? { value: "SMS", label: "SMS" } : null,
    policy.allowWhatsappMessages ? { value: "WHATSAPP", label: "WhatsApp" } : null,
  ].filter((channel): channel is { value: string; label: string } => Boolean(channel));

  if (!enabled) {
    return (
      <p className="mt-3 rounded-xl bg-slate-100 px-3 py-3 text-xs font-bold leading-relaxed text-slate-500">
        Parent-teacher messaging is currently managed through the school office.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-3 rounded-xl border border-slate-100 bg-white p-3">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="teacherId" value={teacherId} />
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-wide text-gray-400">Reason</span>
          <select name="category" defaultValue="GENERAL" className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400">
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-wide text-gray-400">Preferred reply channel</span>
          <select name="preferredChannel" defaultValue={channels[0]?.value ?? "IN_APP"} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400">
            {channels.map((channel) => (
              <option key={channel.value} value={channel.value}>
                {channel.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-3 flex flex-col gap-1">
        <span className="text-[10px] font-black uppercase tracking-wide text-gray-400">Subject</span>
        <input
          name="subject"
          defaultValue={`Question for ${teacherName}`}
          maxLength={120}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400"
        />
      </label>
      <label className="mt-3 flex flex-col gap-1">
        <span className="text-[10px] font-black uppercase tracking-wide text-gray-400">Message</span>
        <textarea
          name="message"
          rows={3}
          maxLength={1000}
          placeholder="Write the concern clearly so the teacher can respond properly."
          className="resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400"
        />
      </label>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold text-gray-400">
          Expected response: within {policy.responseSlaHours} hour{policy.responseSlaHours === 1 ? "" : "s"}.
        </p>
        <SubmitButton disabled={channels.length === 0} />
      </div>
      {state.status !== "idle" && (
        <p
          role="status"
          className={`mt-3 rounded-xl px-3 py-2 text-xs font-black ${
            state.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
