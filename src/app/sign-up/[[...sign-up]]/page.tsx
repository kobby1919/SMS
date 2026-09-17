import { Suspense } from "react";
import SignUpView from "./SignUpView";
import { getBursarInvitePreview } from "@/src/lib/services/bursar-invites";
import { getParentInvitePreview } from "@/src/lib/services/parent-invites";
import { getTeacherInvitePreview } from "@/src/lib/services/teacher-invites";
import { getInvitePreview } from "@/src/lib/services/onboarding";
import { AUTH_CALLBACK_PATH } from "@/src/lib/auth/constants";

type SignUpPageProps = {
  searchParams: Promise<{
    invite?: string;
    teacherInvite?: string;
    parentInvite?: string;
    bursarInvite?: string;
  }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { invite, teacherInvite, parentInvite, bursarInvite } = await searchParams;
  const teacherInvitePreview = teacherInvite
    ? await getTeacherInvitePreview(teacherInvite)
    : null;
  const parentInvitePreview = parentInvite
    ? await getParentInvitePreview(parentInvite)
    : null;
  const bursarInvitePreview = bursarInvite
    ? await getBursarInvitePreview(bursarInvite)
    : null;
  const schoolAdminInvitePreview = invite ? await getInvitePreview(invite) : null;
  const schoolAdminInviteUsable = Boolean(
    schoolAdminInvitePreview &&
      !schoolAdminInvitePreview.accepted &&
      !schoolAdminInvitePreview.revoked &&
      !schoolAdminInvitePreview.expired,
  );

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f0f4ff]" />}>
      <SignUpView
        inviteContext={
          parentInvitePreview?.usable
            ? {
                role: "parent",
                email: parentInvitePreview.email,
                schoolName: parentInvitePreview.schoolName,
                callbackUrl: `/onboarding/parent/accept?token=${encodeURIComponent(parentInvite ?? "")}`,
              }
            : teacherInvitePreview?.usable
              ? {
                  role: "teacher",
                  email: teacherInvitePreview.email,
                  schoolName: teacherInvitePreview.schoolName,
                  callbackUrl: `/onboarding/teacher/accept?token=${encodeURIComponent(teacherInvite ?? "")}`,
                }
              : bursarInvitePreview?.usable
                ? {
                    role: "bursar",
                    email: bursarInvitePreview.email,
                    schoolName: bursarInvitePreview.schoolName,
                    callbackUrl: `/onboarding/bursar/accept?token=${encodeURIComponent(bursarInvite ?? "")}`,
                  }
                : schoolAdminInviteUsable
                  ? {
                      role: "school_admin",
                      email: schoolAdminInvitePreview?.email,
                      schoolName: schoolAdminInvitePreview?.schoolName,
                      callbackUrl: `/onboarding/accept?token=${encodeURIComponent(invite ?? "")}`,
                    }
                  : undefined
        }
      />
    </Suspense>
  );
}
