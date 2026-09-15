import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { getInvitePreview } from "@/src/lib/services/onboarding";
import { getInviteAvailability } from "@/src/lib/services/onboarding-policy";
import { normalizeAppRole } from "@/src/lib/roles";
import InviteSignOutButton from "@/src/components/InviteSignOutButton";

type AcceptInvitePageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function AcceptInvitePage({
  searchParams,
}: AcceptInvitePageProps) {
  const { token } = await searchParams;
  const [invite, user] = await Promise.all([
    token ? getInvitePreview(token) : null,
    currentUser(),
  ]);
  const availability = getInviteAvailability(invite);
  const isUsable = Boolean(invite && availability.usable);
  const signedInEmail = user
    ? user.emailAddresses
        .find((email) => email.id === user.primaryEmailAddressId)
        ?.emailAddress.toLowerCase()
    : null;
  const signedInRole = normalizeAppRole(user?.publicMetadata?.role);
  const invitedEmail = invite?.email.toLowerCase() ?? null;
  const roleConflict = Boolean(isUsable && signedInRole);
  const emailMismatch = Boolean(
    isUsable &&
      !roleConflict &&
      signedInEmail &&
      invitedEmail &&
      signedInEmail !== invitedEmail,
  );
  const emailMatches = Boolean(
    isUsable &&
      !roleConflict &&
      signedInEmail &&
      invitedEmail &&
      signedInEmail === invitedEmail,
  );
  const signInHref = `/sign-in?invite=${encodeURIComponent(token ?? "")}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080B18] px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-white shadow-2xl">
        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-400/15 text-xl font-black text-blue-200">
          E
        </div>

        {invite && isUsable ? (
          <>
            <p className="text-sm font-semibold text-blue-200">School admin invite</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight">
              Join {invite.schoolName}
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/60">
              This invite is for <span className="font-semibold text-white">{invite.email}</span>.
              Sign up or sign in with that same email so Edujay can securely link your account.
            </p>
            {roleConflict && (
              <div className="mt-5 rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50/80">
                <p className="font-black text-amber-100">
                  You are signed in with an existing {signedInRole?.replace("_", " ")} account
                </p>
                <p className="mt-1">
                  This first-admin invite must be accepted by the invited admin&apos;s
                  own account. Sign out, then open this invite again with the invited email.
                </p>
                <InviteSignOutButton
                  redirectUrl={signInHref}
                  label="Sign out and use invited admin email"
                />
              </div>
            )}
            {emailMismatch && (
              <div className="mt-5 rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50/80">
                <p className="font-black text-amber-100">
                  Signed in with the wrong email
                </p>
                <p className="mt-1">
                  This invite is for <span className="font-bold text-white">{invite.email}</span>,
                  but the current session is <span className="font-bold text-white">{signedInEmail}</span>.
                </p>
                <InviteSignOutButton
                  redirectUrl={signInHref}
                  label="Sign out and use invited email"
                />
              </div>
            )}
            {emailMatches && (
              <div className="mt-5 rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm leading-6 text-emerald-50/80">
                <p className="font-black text-emerald-100">Email verified</p>
                <p className="mt-1">
                  Continue below and Edujay will connect this account as the first school admin.
                </p>
              </div>
            )}
            {!roleConflict && !emailMismatch && (
              <Link
                href={signInHref}
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-blue-200 px-4 py-3 text-sm font-bold text-blue-950 transition hover:bg-white"
              >
                {signedInEmail ? "Connect admin account" : "Continue to secure sign in"}
              </Link>
            )}
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
