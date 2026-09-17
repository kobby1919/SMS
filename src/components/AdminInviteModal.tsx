"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Copy, Loader2, MailPlus, X } from "lucide-react";
import {
  createSchoolAdminInviteAction,
  type OnboardingActionResult,
} from "@/src/lib/actions/onboardingActions";

const initialForm = {
  email: "",
  expiresInDays: "7",
};

export default function AdminInviteModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState<OnboardingActionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setResult(null);
    setCopied(false);
  }

  function submitInvite() {
    setResult(null);
    setCopied(false);

    startTransition(async () => {
      const response = await createSchoolAdminInviteAction({
        email: form.email,
        expiresInDays: form.expiresInDays,
      });
      setResult(response);

      if (response.ok) {
        setForm(initialForm);
        router.refresh();
      }
    });
  }

  async function copyInviteLink(inviteUrl: string) {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const inviteUrl = result?.ok && result.invite && typeof window !== "undefined"
    ? `${window.location.origin}${result.invite.invitePath}`
    : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-edujay-primary px-4 py-2.5 text-sm font-black text-white shadow-sm shadow-blue-100 transition hover:bg-edujay-primaryDark active:scale-95"
      >
        <MailPlus size={18} strokeWidth={3} />
        Invite admin
      </button>

      {open && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-gray-900/60 p-3 py-6 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <button
              type="button"
              onClick={close}
              className="absolute right-3 top-3 z-10 rounded-lg bg-white/90 p-2 text-gray-400 shadow-sm ring-1 ring-gray-100 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close invite form"
            >
              <X size={20} />
            </button>

            <div className="max-h-[calc(100dvh-3rem)] overflow-y-auto p-4 pt-12 sm:p-8 sm:pt-8">
              <div className="mb-6">
                <p className="text-xs font-black uppercase tracking-widest text-edujay-primary">
                  Admin onboarding
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-gray-900">
                  Invite school admin
                </h2>
                <p className="mt-2 text-sm font-medium leading-6 text-gray-500">
                  Use this to replace a test admin or add another trusted admin to this same school.
                  The invited person must sign in or sign up with this exact email.
                </p>
              </div>

              {result && !result.ok && (
                <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                  {result.message}
                </div>
              )}

              {inviteUrl && (
                <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 text-emerald-600" size={18} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-emerald-800">Admin invite created</p>
                      <p className="mt-1 text-xs font-semibold text-emerald-700">
                        Email delivery was attempted. You can copy this link for local testing.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 rounded-xl bg-white p-3 sm:flex-row sm:items-center">
                    <code className="min-w-0 flex-1 overflow-x-auto text-xs font-semibold text-gray-600">
                      {inviteUrl}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyInviteLink(inviteUrl)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-950 px-3 py-2 text-xs font-black text-white"
                    >
                      <Copy size={14} />
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid gap-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-black uppercase tracking-wide text-gray-500">Admin email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="owner@school.edu"
                    className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 outline-none transition focus:border-edujay-primary focus:ring-2 focus:ring-edujay-ring"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-black uppercase tracking-wide text-gray-500">Invite expires in</span>
                  <select
                    value={form.expiresInDays}
                    onChange={(event) => setForm((current) => ({ ...current, expiresInDays: event.target.value }))}
                    className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 outline-none transition focus:border-edujay-primary focus:ring-2 focus:ring-edujay-ring"
                  >
                    <option value="1">1 day</option>
                    <option value="3">3 days</option>
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                    <option value="30">30 days</option>
                  </select>
                </label>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={close}
                  disabled={isPending}
                  className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-black text-gray-600 transition hover:bg-gray-200 disabled:opacity-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={submitInvite}
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-edujay-primary px-4 py-2.5 text-sm font-black text-white transition hover:bg-edujay-primaryDark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending && <Loader2 size={16} className="animate-spin" />}
                  {isPending ? "Creating invite..." : "Create invite"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

