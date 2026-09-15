"use client";

import dynamic from "next/dynamic";
import {
  BadgeCheck,
  Building2,
  LockKeyhole,
  MailCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AUTH_CALLBACK_PATH, MISSING_ROLE_QUERY } from "@/src/lib/auth/constants";

const ClerkSignIn = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.SignIn),
  {
    ssr: false,
    loading: () => (
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="space-y-4">
          <div className="h-12 rounded-xl bg-slate-100" />
          <div className="h-12 rounded-xl bg-slate-100" />
          <div className="h-12 rounded-xl bg-blue-100" />
        </div>
      </div>
    ),
  },
);

type SignInViewProps = {
  schoolAdminInviteEmail?: string;
  schoolAdminInviteSchoolName?: string;
  teacherInviteEmail?: string;
  teacherInviteSchoolName?: string;
};

export default function SignInView({
  schoolAdminInviteEmail,
  schoolAdminInviteSchoolName,
  teacherInviteEmail,
  teacherInviteSchoolName,
}: SignInViewProps) {
  const searchParams = useSearchParams();
  const missingRole = searchParams.get("error") === MISSING_ROLE_QUERY;
  const invalidInvite = searchParams.get("error") === "invalid_invite";
  const inviteToken = searchParams.get("invite");
  const teacherInviteToken = searchParams.get("teacherInvite");
  const isSchoolAdminInviteSignIn = Boolean(inviteToken);
  const isTeacherInviteSignIn = Boolean(teacherInviteToken);
  const inviteEmail = teacherInviteEmail ?? schoolAdminInviteEmail;
  const inviteRoleLabel = isTeacherInviteSignIn
    ? "teacher"
    : isSchoolAdminInviteSignIn
      ? "school admin"
      : null;
  const inviteSchoolName =
    teacherInviteSchoolName ?? schoolAdminInviteSchoolName ?? "the school";
  const pageSubtitle = isTeacherInviteSignIn
    ? "Secure teacher invite access"
    : isSchoolAdminInviteSignIn
      ? "Secure school admin invite access"
      : "Secure school access";
  const callbackUrl = inviteToken
    ? `${AUTH_CALLBACK_PATH}?invite=${encodeURIComponent(inviteToken)}`
    : teacherInviteToken
      ? `${AUTH_CALLBACK_PATH}?teacherInvite=${encodeURIComponent(teacherInviteToken)}`
    : AUTH_CALLBACK_PATH;

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <section className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 overflow-hidden lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="relative hidden min-h-screen flex-col justify-between bg-[#07111f] px-10 py-10 text-white lg:flex">
          <div className="absolute inset-0 opacity-80">
            <div className="absolute inset-x-0 top-1/3 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <div className="absolute inset-y-0 left-1/3 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
            <div className="absolute inset-x-10 bottom-24 h-px bg-white/10" />
            <div className="absolute right-20 top-24 h-32 w-px bg-white/10" />
          </div>

          <div className="relative z-10">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-200 text-blue-950">
                <Building2 size={21} />
              </div>
              <div>
                <p className="text-xl font-black tracking-tight">Edujay</p>
                <p className="text-xs font-bold text-white/45">School operations, secured</p>
              </div>
            </div>

            <div className="mt-20 max-w-xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-blue-100">
                <Sparkles size={14} />
                One school truth
              </p>
              <h1 className="mt-5 text-5xl font-black leading-[1.02] tracking-tight">
                Sign in to run school work with clarity.
              </h1>
              <p className="mt-5 max-w-lg text-base font-medium leading-8 text-white/60">
                Edujay connects owners, admins, teachers, parents, and finance
                teams through role-based access. Every person enters through
                their own account, and every action stays traceable.
              </p>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-3">
            {[
              { title: "Role-based", body: "Each user sees only what they should." },
              { title: "Invite-led", body: "Staff join through secure school invites." },
              { title: "Audit-ready", body: "Sensitive actions keep a clear trail." },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-sm font-black text-white">{item.title}</p>
                <p className="mt-2 text-xs font-medium leading-5 text-white/45">{item.body}</p>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <section className="w-full max-w-[460px]">
            <div className="mb-6 lg:hidden">
              <div className="inline-flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-700 text-white">
                  <Building2 size={22} />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-950">
                    Edujay
                  </h1>
                  <p className="text-sm font-bold text-slate-500">{pageSubtitle}</p>
                </div>
              </div>
            </div>

            <div className="mb-5 hidden lg:block">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-blue-700">
                Secure access
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Welcome back
              </h2>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                {pageSubtitle}
              </p>
            </div>

            <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.10)] sm:p-5">
              <div className="mb-4 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <LockKeyhole size={18} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">Protected sign-in</p>
                  <p className="text-xs font-semibold leading-5 text-slate-500">
                    Passwords and sessions are handled securely by Clerk.
                  </p>
                </div>
              </div>

              {(isTeacherInviteSignIn || isSchoolAdminInviteSignIn) && (
                <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950">
                  <div className="flex items-start gap-3">
                    <MailCheck size={18} className="mt-0.5 shrink-0 text-blue-700" />
                    <div>
                      <p className="font-black">
                        {isTeacherInviteSignIn
                          ? "Teacher invite sign-in"
                          : "School admin invite sign-in"}
                      </p>
                      <p className="mt-1 font-medium leading-6 text-blue-900/80">
                        Use the {inviteRoleLabel} email invited by{" "}
                        <span className="font-bold">{inviteSchoolName}</span>.
                        Do not use seeded test credentials here.
                      </p>
                      {inviteEmail && (
                        <p className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-xs font-black text-blue-900">
                          Invited email: {inviteEmail}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {missingRole && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-semibold">Account is missing a role</p>
                  <p className="mt-1 text-amber-800/90">
                    In Clerk, open the user account and set public metadata:
                  </p>
                  <pre className="mt-2 overflow-x-auto rounded-xl bg-white/80 px-3 py-2 font-mono text-xs text-slate-800">
                    {`{ "role": "admin", "schoolId": "default-school" }`}
                  </pre>
                  <p className="mt-2 text-xs text-amber-800/80">
                    Sign out, save metadata, then sign in again.
                  </p>
                </div>
              )}

              {invalidInvite && (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  <p className="font-semibold">Invitation could not be accepted</p>
                  <p className="mt-1 text-rose-800/90">
                    The invite may be expired, already used, or linked to a different email address.
                  </p>
                </div>
              )}

              <ClerkSignIn
                forceRedirectUrl={callbackUrl}
                fallbackRedirectUrl={callbackUrl}
                signUpFallbackRedirectUrl={callbackUrl}
                initialValues={
                  inviteEmail
                    ? {
                        emailAddress: inviteEmail,
                      }
                    : undefined
                }
                routing="path"
                path="/sign-in"
                appearance={{
                  layout: {
                    logoPlacement: "none",
                    showOptionalFields: false,
                  },
                  elements: {
                    rootBox: "w-full",
                    card: "w-full rounded-2xl border-0 shadow-none",
                    cardBox: "shadow-none",
                    main: "p-0",
                    header: "hidden",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    form: "space-y-4",
                    formField: "space-y-1.5",
                    formFieldLabel: "text-xs font-black uppercase tracking-wide text-slate-500",
                    formFieldInput:
                      "h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[15px] font-semibold text-slate-900 " +
                      "placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-blue-500 " +
                      "focus:bg-white focus:ring-4 focus:ring-blue-100",
                    formFieldInputShowPasswordButton: "text-slate-400 hover:text-slate-600",
                    formButtonPrimary:
                      "h-12 w-full rounded-xl bg-blue-700 text-sm font-black text-white transition-colors " +
                      "duration-200 hover:bg-blue-800 normal-case shadow-none",
                    footerActionLink: "font-black text-blue-700 hover:text-blue-900",
                    footerActionText: "text-sm text-slate-500",
                    dividerLine: "bg-slate-100",
                    dividerText: "text-xs font-bold text-slate-400",
                    formFieldErrorText: "text-xs font-semibold text-rose-500",
                    alert: "rounded-xl border border-rose-100 bg-rose-50",
                    alertText: "text-sm font-semibold text-rose-600",
                    socialButtonsBlockButton:
                      "h-12 rounded-xl border border-slate-200 text-sm font-bold transition-colors hover:bg-slate-50",
                    footer: "hidden",
                    footerAction: "hidden",
                    footerPages: "hidden",
                  },
                  variables: {
                    colorPrimary: "#1d4ed8",
                    colorText: "#0f172a",
                    colorTextSecondary: "#64748b",
                    colorBackground: "#ffffff",
                    colorInputBackground: "#f8fafc",
                    colorInputText: "#0f172a",
                    borderRadius: "0.875rem",
                    fontFamily: "var(--font-nunito)",
                  },
                }}
              />

              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-xs font-bold text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  Protected by Clerk
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck size={14} className="text-blue-700" />
                  Edujay role verified
                </span>
              </div>
            </div>

            <p className="mt-5 text-center text-xs font-semibold leading-5 text-slate-400">
              Access is controlled by your school. If your invite email is wrong,
              ask the school admin or Edujay platform team to resend it.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
