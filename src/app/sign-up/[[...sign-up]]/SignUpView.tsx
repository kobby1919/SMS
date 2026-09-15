"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { BadgeCheck, Building2, MailCheck, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AUTH_CALLBACK_PATH } from "@/src/lib/auth/constants";

const ClerkSignUp = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.SignUp),
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

type SignUpViewProps = {
  inviteContext?: {
    role: "school_admin" | "teacher";
    email?: string;
    schoolName?: string;
    callbackUrl: string;
  };
};

const inviteCopy = {
  school_admin: {
    label: "school admin",
    title: "Create school admin account",
    subtitle: "Secure school admin setup",
    warning: "Create this account with the invited school admin email.",
  },
  teacher: {
    label: "teacher",
    title: "Create teacher account",
    subtitle: "Secure teacher invite setup",
    warning: "Create this account with the invited teacher email.",
  },
} satisfies Record<
  NonNullable<SignUpViewProps["inviteContext"]>["role"],
  { label: string; title: string; subtitle: string; warning: string }
>;

export default function SignUpView({ inviteContext }: SignUpViewProps) {
  const searchParams = useSearchParams();
  const activeInvite = inviteContext ? inviteCopy[inviteContext.role] : null;
  const inviteEmail = inviteContext?.email;
  const inviteSchoolName = inviteContext?.schoolName ?? "the school";
  const pageSubtitle = activeInvite?.subtitle ?? "Create secure school access";
  const callbackUrl = inviteContext?.callbackUrl ?? AUTH_CALLBACK_PATH;
  const teacherInviteToken = searchParams.get("teacherInvite");
  const schoolInviteToken = searchParams.get("invite");
  const signInUrl = teacherInviteToken
    ? `/sign-in?teacherInvite=${encodeURIComponent(teacherInviteToken)}`
    : schoolInviteToken
      ? `/sign-in?invite=${encodeURIComponent(schoolInviteToken)}`
      : "/sign-in";

  useEffect(() => {
    const maxAge = 20 * 60;
    if (teacherInviteToken) {
      document.cookie = `edujay_teacher_invite=${encodeURIComponent(teacherInviteToken)}; path=/; max-age=${maxAge}; samesite=lax`;
    }
    if (schoolInviteToken) {
      document.cookie = `edujay_school_invite=${encodeURIComponent(schoolInviteToken)}; path=/; max-age=${maxAge}; samesite=lax`;
    }
  }, [schoolInviteToken, teacherInviteToken]);

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#f5f7fb] text-slate-950">
      <section className="grid min-h-dvh w-full grid-cols-1 lg:grid-cols-[minmax(340px,40%)_1fr]">
        <aside className="hidden min-h-dvh bg-[#07111f] px-10 py-12 text-white lg:flex xl:px-14">
          <div className="my-auto max-w-xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-200">
              Invite-only access
            </p>
            <h1 className="mt-5 text-4xl font-black leading-[1.08] tracking-tight xl:text-5xl">
              Every school user gets a clean, traceable login.
            </h1>
            <p className="mt-5 max-w-lg text-base font-medium leading-8 text-white/60">
              Edujay links this account to the exact invite, role, and school so
              access stays controlled from the first login.
            </p>
          </div>
        </aside>

        <div className="flex min-h-dvh items-start justify-center px-4 py-6 sm:px-6 lg:items-center lg:px-12">
          <section className="w-full max-w-[440px]">
            <div className="mb-5">
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

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              {activeInvite && (
                <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950">
                  <div className="flex items-start gap-3">
                    <MailCheck size={18} className="mt-0.5 shrink-0 text-blue-700" />
                    <div>
                      <p className="font-black">{activeInvite.title}</p>
                      <p className="mt-1 font-medium leading-6 text-blue-900/80">
                        {activeInvite.warning} <span className="font-bold">{inviteSchoolName}</span>{" "}
                        will only connect this invite to the exact invited {activeInvite.label} account.
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

              <ClerkSignUp
                forceRedirectUrl={callbackUrl}
                fallbackRedirectUrl={callbackUrl}
                signInUrl={signInUrl}
                signInFallbackRedirectUrl={callbackUrl}
                initialValues={
                  inviteEmail
                    ? {
                        emailAddress: inviteEmail,
                      }
                    : undefined
                }
                routing="path"
                path="/sign-up"
                appearance={{
                  layout: {
                    logoPlacement: "none",
                    showOptionalFields: false,
                  },
                  elements: {
                    rootBox: "w-full",
                    card: "w-full max-w-none rounded-none border-0 bg-transparent shadow-none",
                    cardBox: "w-full shadow-none",
                    main: "p-0",
                    header: "hidden",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    form: "w-full space-y-4",
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
                    formContainer: "w-full",
                    identityPreview: "rounded-xl border border-slate-100 bg-slate-50",
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
          </section>
        </div>
      </section>
    </main>
  );
}
