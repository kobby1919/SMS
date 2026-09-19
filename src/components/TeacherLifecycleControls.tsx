"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Ban, CheckCircle2, Loader2, LogOut, RotateCcw, ShieldAlert, X } from "lucide-react";
import type { TeacherStatus } from "@/src/generated/prisma";
import { updateTeacherLifecycleStatusAction } from "@/src/lib/actions/teacherLifecycleActions";
import { getTeacherLifecycleAvailability } from "@/src/lib/teacher-lifecycle-rules";
import type { TeacherLifecycleActionInput } from "@/src/lib/validation/teacher-lifecycle";

type ActionOption = {
  action: TeacherLifecycleActionInput;
  label: string;
  description: string;
  icon: React.ReactNode;
  tone: string;
  enabled: boolean;
  disabledReason?: string;
};

export default function TeacherLifecycleControls({
  teacherId,
  teacherName,
  status,
}: {
  teacherId: string;
  teacherName: string;
  status: TeacherStatus;
}) {
  const router = useRouter();
  const availability = getTeacherLifecycleAvailability(status);
  const [selectedAction, setSelectedAction] = useState<TeacherLifecycleActionInput | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const actions = useMemo<ActionOption[]>(() => [
    {
      action: "SUSPEND",
      label: "Suspend access",
      description: "Block teacher login and operations until admin reactivates the account.",
      icon: <Ban size={15} />,
      tone: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
      enabled: availability.canSuspend,
      disabledReason: availability.reasons.suspend,
    },
    {
      action: "REACTIVATE",
      label: "Reactivate teacher",
      description: "Restore access for a suspended teacher. Profile readiness is recalculated.",
      icon: <RotateCcw size={15} />,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
      enabled: availability.canReactivate,
      disabledReason: availability.reasons.reactivate,
    },
    {
      action: "MARK_LEFT_SCHOOL",
      label: "Mark as left school",
      description: "Permanently remove operational access while keeping school history intact.",
      icon: <LogOut size={15} />,
      tone: "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100",
      enabled: availability.canMarkLeftSchool,
      disabledReason: availability.reasons.markLeftSchool,
    },
  ], [availability]);

  const selected = actions.find((item) => item.action === selectedAction) ?? null;
  const reasonLength = reason.trim().length;
  const canSubmit = Boolean(selected?.enabled && reasonLength >= 10 && !isPending);

  function openAction(action: ActionOption) {
    if (!action.enabled) {
      setMessage({ type: "error", text: action.disabledReason ?? "This action is not available from the current status." });
      return;
    }
    setSelectedAction(action.action);
    setReason("");
    setMessage(null);
  }

  function closeAction() {
    if (isPending) return;
    setSelectedAction(null);
    setReason("");
    setMessage(null);
  }

  function submitAction() {
    if (!selectedAction || !canSubmit) return;
    setMessage(null);

    startTransition(async () => {
      const result = await updateTeacherLifecycleStatusAction({
        teacherId,
        action: selectedAction,
        reason,
      });

      if (!result.ok) {
        setMessage({ type: "error", text: result.message });
        return;
      }

      setMessage({ type: "success", text: "Teacher status updated and audit history recorded." });
      setSelectedAction(null);
      setReason("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs font-semibold leading-5 text-blue-900">
        <div className="flex items-start gap-2">
          <ShieldAlert size={15} className="mt-0.5 shrink-0 text-blue-700" />
          <p>
            Status changes require a reason and are recorded. Deleting teachers is not allowed because lessons, reports, attendance, and finance history may depend on them.
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        {actions.map((action) => (
          <button
            key={action.action}
            type="button"
            onClick={() => openAction(action)}
            className={`flex min-w-0 items-start gap-3 rounded-xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${
              action.enabled ? action.tone : "border-gray-100 bg-gray-50 text-gray-400"
            }`}
          >
            <span className="mt-0.5 shrink-0">{action.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black">{action.label}</span>
              <span className="mt-0.5 block text-xs font-semibold leading-5 opacity-80">
                {action.enabled ? action.description : action.disabledReason}
              </span>
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-gray-900">{selected.label}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">
                Write why this status change is needed for {teacherName}. This note will be kept in the audit history.
              </p>
            </div>
            <button
              type="button"
              onClick={closeAction}
              disabled={isPending}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
              aria-label="Close status action"
            >
              <X size={16} />
            </button>
          </div>

          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Example: Teacher is leaving the school at the end of the week, so operational access should be removed after handover."
            className="mt-3 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none transition placeholder:text-gray-300 focus:border-edujay-primary focus:ring-2 focus:ring-edujay-ring"
          />
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-xs font-bold ${reasonLength >= 10 ? "text-gray-400" : "text-amber-600"}`}>
              {reasonLength}/500 characters · minimum 10 required
            </p>
            <button
              type="button"
              onClick={submitAction}
              disabled={!canSubmit}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-950 px-3 py-2 text-xs font-black text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {isPending ? "Saving..." : "Confirm status change"}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={`rounded-xl px-3 py-2 text-xs font-bold ${message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
