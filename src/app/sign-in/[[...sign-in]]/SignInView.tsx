"use client";

import { useEffect } from "react";
import { MailCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  AUTH_CALLBACK_PATH,
  AUTH_RATE_LIMITED_QUERY,
  MISSING_ROLE_QUERY,
  TEACHER_ACCESS_BLOCKED_QUERY,
} from "@/src/lib/auth/constants";
import InviteSignOutButton from "@/src/components/InviteSignOutButton";
import AuthShell from "@/src/components/auth/AuthShell";
import CustomSignInForm from "@/src/components/auth/CustomSignInForm";

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
    warning:
      "Use the school admin email invited by the school owner or Edujay platform team.",
  },
  teacher: {
    label: "teacher",
    title: "Teacher invite sign-in",
    warning: "Use the teacher email invited by the school admin.",
  },
  parent: {
    label: "parent",
    title: "Parent invite sign-in",
    warning: "Use the parent email invited by the school admin.",
  },
  bursar: {
    label: "bursar",
    title: "Bursar invite sign-in",
    warning: "Use the bursar email invited by the school admin.",
  },
} satisfies Record<
  NonNullable<SignInViewProps["inviteContext"]>["role"],
  { label: string; title: string; warning: string }
>;

export default function SignInView({ inviteContext }: SignInViewProps) {
  const searchParams = useSearchParams();
  const missingRole = searchParams.get("error") === MISSING_ROLE_QUERY;
  const teacherAccessBlocked = searchParams.get("error") === TEACHER_ACCESS_BLOCKED_QUERY;
  const blockedTeacherStatus = searchParams.get("status");
  const invalidInvite = searchParams.get("error") === "invalid_invite";
  const authRateLimited = searchParams.get("error") === AUTH_RATE_LIMITED_QUERY;
  const retryAfter = searchParams.get("retryAfter");
  const activeInvite = inviteContext ? inviteCopy[inviteContext.role] : null;
  const inviteEmail = inviteContext?.email;
  const inviteSchoolName = inviteContext?.schoolName ?? "the school";
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
    <AuthShell mode="sign-in" eyebrow={activeInvite?.title ?? "Secure school access"} alternateHref={signUpUrl}>
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

      {authRateLimited && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <p className="font-semibold">Sign-in is catching up</p>
          <p className="mt-1 text-blue-900/90">
            Edujay received several secure sign-in checks from this device. Please wait{retryAfter ? ` about ${retryAfter} seconds` : " a moment"} and try again.
          </p>
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
      <CustomSignInForm callbackUrl={callbackUrl} initialEmail={inviteEmail} />
    </AuthShell>
  );
}

