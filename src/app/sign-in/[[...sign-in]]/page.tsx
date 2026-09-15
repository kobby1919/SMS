import { Suspense } from "react";
import SignInView from "./SignInView";
import { getTeacherInvitePreview } from "@/src/lib/services/teacher-invites";
import { getInvitePreview } from "@/src/lib/services/onboarding";

type SignInPageProps = {
  searchParams: Promise<{
    invite?: string;
    teacherInvite?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { invite, teacherInvite } = await searchParams;
  const teacherInvitePreview = teacherInvite
    ? await getTeacherInvitePreview(teacherInvite)
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
      <SignInView
        inviteContext={
          teacherInvitePreview?.usable
            ? {
                role: "teacher",
                email: teacherInvitePreview.email,
                schoolName: teacherInvitePreview.schoolName,
              }
            : schoolAdminInviteUsable
              ? {
                  role: "school_admin",
                  email: schoolAdminInvitePreview?.email,
                  schoolName: schoolAdminInvitePreview?.schoolName,
                }
              : undefined
        }
      />
    </Suspense>
  );
}
