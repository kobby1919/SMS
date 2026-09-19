"use client";

import { useEffect } from "react";
import { MailCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AUTH_CALLBACK_PATH } from "@/src/lib/auth/constants";
import AuthShell from "@/src/components/auth/AuthShell";
import CustomSignUpForm from "@/src/components/auth/CustomSignUpForm";

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
    warning: "Create this account with the invited school admin email.",
  },
  teacher: {
    label: "teacher",
    title: "Create teacher account",
    warning: "Create this account with the invited teacher email.",
  },
  parent: {
    label: "parent",
    title: "Create parent account",
    warning: "Create this account with the invited parent email.",
  },
  bursar: {
    label: "bursar",
    title: "Create bursar account",
    warning: "Create this account with the invited bursar email.",
  },
} satisfies Record<
  NonNullable<SignUpViewProps["inviteContext"]>["role"],
  { label: string; title: string; warning: string }
>;

export default function SignUpView({ inviteContext }: SignUpViewProps) {
  const searchParams = useSearchParams();
  const activeInvite = inviteContext ? inviteCopy[inviteContext.role] : null;
  const inviteEmail = inviteContext?.email;
  const inviteSchoolName = inviteContext?.schoolName ?? "the school";
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
    <AuthShell mode="sign-up" eyebrow={activeInvite?.title ?? "Invite-only access"} alternateHref={signInUrl}>
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

      <CustomSignUpForm callbackUrl={callbackUrl} initialEmail={inviteEmail} />
    </AuthShell>
  );
}
