import { Suspense } from "react";
import SignInView from "./SignInView";
import { getTeacherInvitePreview } from "@/src/lib/services/teacher-invites";

type SignInPageProps = {
  searchParams: Promise<{
    teacherInvite?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { teacherInvite } = await searchParams;
  const teacherInvitePreview = teacherInvite
    ? await getTeacherInvitePreview(teacherInvite)
    : null;

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f0f4ff]" />}>
      <SignInView
        teacherInviteEmail={
          teacherInvitePreview?.usable ? teacherInvitePreview.email : undefined
        }
        teacherInviteSchoolName={
          teacherInvitePreview?.usable ? teacherInvitePreview.schoolName : undefined
        }
      />
    </Suspense>
  );
}
