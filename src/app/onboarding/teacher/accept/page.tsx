import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCircle2, Clock3, Mail, ShieldCheck, XCircle } from "lucide-react";
import {
  getTeacherInvitePreview,
  type TeacherInvitePreview,
} from "@/src/lib/services/teacher-invites";

type TeacherAcceptInvitePageProps = {
  searchParams: Promise<{ token?: string }>;
};

const stateCopy: Record<
  TeacherInvitePreview["state"],
  { label: string; title: string; body: string }
> = {
  active: {
    label: "Teacher invite",
    title: "Join your school on Edujay",
    body: "Continue with the exact email address this invite was sent to. Edujay will use it to securely connect your account to the school.",
  },
  accepted: {
    label: "Invite already accepted",
    title: "This invite has already been used",
    body: "This teacher invite is already connected to an Edujay account. If you need access, ask the school admin to check your teacher profile.",
  },
  expired: {
    label: "Invite expired",
    title: "This invite has expired",
    body: "For security, teacher invites expire after a short period. Ask the school admin to resend your invite.",
  },
  revoked: {
    label: "Invite revoked",
    title: "This invite is no longer active",
    body: "The school has revoked this invite. Ask the school admin to issue a fresh teacher invite if you still need access.",
  },
  invalid: {
    label: "Invite unavailable",
    title: "This invite link is not valid",
    body: "The invite link may be incorrect or has been replaced by a newer invite. Ask the school admin to resend it.",
  },
  missing: {
    label: "Invite missing",
    title: "No teacher invite token was found",
    body: "Open the invite link sent by your school admin, or ask them to send a fresh invite.",
  },
};

export default async function TeacherAcceptInvitePage({
  searchParams,
}: TeacherAcceptInvitePageProps) {
  const { token } = await searchParams;
  const invite = await getTeacherInvitePreview(token);
  const copy = stateCopy[invite.state];
  const signInHref = `/sign-in?teacherInvite=${encodeURIComponent(token ?? "")}`;

  return (
    <main className="min-h-screen bg-[#080B18] px-4 py-10 text-white sm:py-16">
      <section className="mx-auto flex w-full max-w-[920px] flex-col gap-6 lg:flex-row lg:items-stretch">
        <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl sm:p-8">
          <div className="mb-7 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-400/15 text-blue-200">
            {invite.usable ? <ShieldCheck size={24} /> : <XCircle size={24} />}
          </div>

          <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-200">
            {copy.label}
          </p>
          <h1 className="mt-3 max-w-xl text-3xl font-black tracking-tight sm:text-4xl">
            {copy.title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-white/60">
            {copy.body}
          </p>

          {invite.usable ? (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={signInHref}
                className="inline-flex items-center justify-center rounded-xl bg-blue-200 px-5 py-3 text-sm font-black text-blue-950 transition hover:bg-white"
              >
                Continue to secure sign in
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 px-5 py-3 text-sm font-black text-white/80 transition hover:bg-white/10"
              >
                Back to homepage
              </Link>
            </div>
          ) : (
            <Link
              href="/"
              className="mt-8 inline-flex w-full items-center justify-center rounded-xl border border-white/10 px-5 py-3 text-sm font-black text-white/80 transition hover:bg-white/10 sm:w-auto"
            >
              Back to homepage
            </Link>
          )}
        </div>

        <aside className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl lg:max-w-[340px]">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/40">
            Invite details
          </h2>
          <div className="mt-5 space-y-4">
            <Detail label="School" value={invite.schoolName ?? "Not available"} />
            <Detail label="Teacher" value={invite.teacherName ?? "Not available"} />
            <Detail label="Email" value={invite.email ?? "Not available"} icon={<Mail size={15} />} />
            <Detail
              label="Expires"
              value={invite.expiresAt ? invite.expiresAt.toLocaleDateString("en-GH") : "Not available"}
              icon={<Clock3 size={15} />}
            />
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-300" size={17} />
                <p className="text-xs font-semibold leading-5 text-white/55">
                  The next step will verify that the signed-in Clerk email matches
                  this invite email before Edujay creates the teacher profile.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function Detail({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
        {label}
      </p>
      <div className="mt-2 flex items-center gap-2 text-sm font-bold text-white/80">
        {icon}
        <span className="min-w-0 break-words">{value}</span>
      </div>
    </div>
  );
}
