import Link from "next/link";
import { getInvitePreview } from "@/src/lib/services/onboarding";

type AcceptInvitePageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function AcceptInvitePage({
  searchParams,
}: AcceptInvitePageProps) {
  const { token } = await searchParams;
  const invite = token ? await getInvitePreview(token) : null;
  const isUsable = invite && !invite.accepted && !invite.expired;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080B18] px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-white shadow-2xl">
        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-400/15 text-xl font-black text-blue-200">
          E
        </div>

        {isUsable ? (
          <>
            <p className="text-sm font-semibold text-blue-200">School admin invite</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight">
              Join {invite.schoolName}
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/60">
              This invite is for <span className="font-semibold text-white">{invite.email}</span>.
              Sign up or sign in with that same email so Edujay can securely link your account.
            </p>
            <Link
              href={`/sign-in?invite=${encodeURIComponent(token ?? "")}`}
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-blue-200 px-4 py-3 text-sm font-bold text-blue-950 transition hover:bg-white"
            >
              Continue to secure sign in
            </Link>
            <p className="mt-4 text-center text-xs text-white/35">
              Expires {invite.expiresAt.toLocaleDateString()}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-rose-200">Invite unavailable</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight">
              This invite cannot be used
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/60">
              The invite link may be missing, expired, already accepted, or incorrect.
              Ask the Edujay team to issue a fresh invitation.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white/80 transition hover:bg-white/10"
            >
              Back to homepage
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
