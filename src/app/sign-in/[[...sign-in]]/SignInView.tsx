"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  AUTH_CALLBACK_PATH,
  MISSING_ROLE_QUERY,
  TEACHER_ACCESS_BLOCKED_QUERY,
} from "@/src/lib/auth/constants";
import InviteSignOutButton from "@/src/components/InviteSignOutButton";
import AuthShell from "@/src/components/auth/AuthShell";

const ClerkSignIn = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.SignIn),
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

type SignInViewProps = {
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
    title: "School admin invite sign-in",
    subtitle: "Secure school admin invite access",
    warning:
      "Use the school admin email invited by the school owner or Edujay platform team.",
  },
  teacher: {
    label: "teacher",
    title: "Teacher invite sign-in",
    subtitle: "Secure teacher invite access",
    warning: "Use the teacher email invited by the school admin.",
  },
  parent: {
    label: "parent",
    title: "Parent invite sign-in",
    subtitle: "Secure parent invite access",
    warning: "Use the parent email invited by the school admin.",
  },
  bursar: {
    label: "bursar",
    title: "Bursar invite sign-in",
    subtitle: "Secure finance invite access",
    warning: "Use the bursar email invited by the school admin.",
  },
} satisfies Record<
  NonNullable<SignInViewProps["inviteContext"]>["role"],
  { label: string; title: string; subtitle: string; warning: string }
>;

export default function SignInView({ inviteContext }: SignInViewProps) {
  const searchParams = useSearchParams();
  const missingRole = searchParams.get("error") === MISSING_ROLE_QUERY;
  const teacherAccessBlocked = searchParams.get("error") === TEACHER_ACCESS_BLOCKED_QUERY;
  const blockedTeacherStatus = searchParams.get("status");
  const invalidInvite = searchParams.get("error") === "invalid_invite";
  const activeInvite = inviteContext ? inviteCopy[inviteContext.role] : null;
  const inviteEmail = inviteContext?.email;
  const inviteSchoolName = inviteContext?.schoolName ?? "the school";
  const pageSubtitle = activeInvite?.subtitle ?? "Secure school access";
  const callbackUrl = inviteContext?.callbackUrl ?? AUTH_CALLBACK_PATH;
  const teacherInviteToken = searchParams.get("teacherInvite");
  const schoolInviteToken = searchParams.get("invite");
  const parentInviteToken = searchParams.get("parentInvite");
  const bursarInviteToken = searchParams.get("bursarInvite");
  const signUpUrl = parentInviteToken
    ? `/sign-up?parentInvite=${encodeURIComponent(parentInviteToken)}`
    : teacherInviteToken
      ? `/sign-up?teacherInvite=${encodeURIComponent(teacherInviteToken)}`
      : bursarInviteToken
        ? `/sign-up?bursarInvite=${encodeURIComponent(bursarInviteToken)}`
        : schoolInviteToken
          ? `/sign-up?invite=${encodeURIComponent(schoolInviteToken)}`
          : "/sign-up";

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
    <AuthShell mode="sign-in" subtitle={pageSubtitle} eyebrow={activeInvite?.title ?? "Secure school access"}>
      {activeInvite && (
        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <div className="flex items-start gap-3">
            <MailCheck size={18} className="mt-0.5 shrink-0 text-blue-700" />
            <div>
              <p className="font-black">{activeInvite.title}</p>
              <p className="mt-1 font-medium leading-6 text-blue-900/80">
                {activeInvite.warning}{" "}
                <span className="font-bold">{inviteSchoolName}</span>{" "}
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

      {missingRole && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Account setup is not complete</p>
          <p className="mt-1 text-amber-800/90">
            Edujay could not find a school role for this account yet. If you are accepting an invite,
            sign out and open the invite link again with the invited email. If this is your school account,
            ask the school admin to confirm your invite or access setup.
          </p>
          <InviteSignOutButton
            redirectUrl="/sign-in"
            label="Sign out and restart access setup"
          />
        </div>
      )}

      {teacherAccessBlocked && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <p className="font-semibold">Teacher access is currently blocked</p>
          <p className="mt-1 text-rose-800/90">
            This teacher account is not active in Edujay{blockedTeacherStatus ? ` (${blockedTeacherStatus.replaceAll("_", " ").toLowerCase()})` : ""}.
            Please contact the school admin before trying to use the teacher dashboard.
          </p>
          <InviteSignOutButton redirectUrl="/sign-in" label="Sign out" />
        </div>
      )}

      {invalidInvite && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <p className="font-semibold">Invitation could not be accepted</p>
          <p className="mt-1 text-rose-800/90">
            The invite may be expired, already used, or linked to a different email address.
          </p>
        </div>
      )}

      <ClerkSignIn
        forceRedirectUrl={callbackUrl}
        fallbackRedirectUrl={callbackUrl}
        signUpUrl={signUpUrl}
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

      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-center text-sm font-bold text-slate-600">
        {activeInvite ? (
          <>
            New invited user?{" "}
            <Link href={signUpUrl} className="font-black text-blue-700 hover:text-blue-900">
              Create your {activeInvite.label} account
            </Link>
          </>
        ) : (
          <>
            New to Edujay?{" "}
            <Link href={signUpUrl} className="font-black text-blue-700 hover:text-blue-900">
              Create an account
            </Link>
          </>
        )}
      </div>
    </AuthShell>
  );
}
