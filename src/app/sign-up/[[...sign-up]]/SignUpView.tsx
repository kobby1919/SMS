"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { MailCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AUTH_CALLBACK_PATH } from "@/src/lib/auth/constants";
import AuthShell from "@/src/components/auth/AuthShell";

const ClerkSignUp = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.SignUp),
  {
    ssr: false,
    loading: () => (
      <div className="w-full rounded-2xl bg-white p-2">
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
    role: "school_admin" | "teacher" | "parent" | "bursar";
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
  parent: {
    label: "parent",
    title: "Create parent account",
    subtitle: "Secure parent invite setup",
    warning: "Create this account with the invited parent email.",
  },
  bursar: {
    label: "bursar",
    title: "Create bursar account",
    subtitle: "Secure finance invite setup",
    warning: "Create this account with the invited bursar email.",
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
  const parentInviteToken = searchParams.get("parentInvite");
  const bursarInviteToken = searchParams.get("bursarInvite");
  const signInUrl = parentInviteToken
    ? `/sign-in?parentInvite=${encodeURIComponent(parentInviteToken)}`
    : teacherInviteToken
      ? `/sign-in?teacherInvite=${encodeURIComponent(teacherInviteToken)}`
      : bursarInviteToken
        ? `/sign-in?bursarInvite=${encodeURIComponent(bursarInviteToken)}`
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
    if (parentInviteToken) {
      document.cookie = `edujay_parent_invite=${encodeURIComponent(parentInviteToken)}; path=/; max-age=${maxAge}; samesite=lax`;
    }
    if (bursarInviteToken) {
      document.cookie = `edujay_bursar_invite=${encodeURIComponent(bursarInviteToken)}; path=/; max-age=${maxAge}; samesite=lax`;
    }
  }, [bursarInviteToken, parentInviteToken, schoolInviteToken, teacherInviteToken]);

  return (
    <AuthShell mode="sign-up" subtitle={pageSubtitle} eyebrow={activeInvite?.title ?? "Invite-only access"}>
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
    </AuthShell>
  );
}
