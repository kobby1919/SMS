"use client";

import { useState, useTransition } from "react";
import {
  approveWaitlistEntryAction,
  rejectWaitlistEntryAction,
  type OnboardingActionResult,
} from "@/src/lib/actions/onboardingActions";

type WaitlistEntryForReview = {
  id: string;
  name: string;
  schoolName: string;
  email: string;
  role: string;
  message: string | null;
  status: string;
  createdAt: Date;
  reviewedAt: Date | null;
  school: {
    id: string;
    name: string;
    slug: string;
    onboardingStatus: string;
  } | null;
};

export default function OnboardingRequestsClient({
  entries,
}: {
  entries: WaitlistEntryForReview[];
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runAction(
    entryId: string,
    action: () => Promise<OnboardingActionResult>,
  ) {
    setPendingId(entryId);
    setBanner(null);
    setInviteUrl(null);

    startTransition(async () => {
      const result = await action();
      setPendingId(null);

      if (!result.ok) {
        setBanner(result.message);
        return;
      }

      if (result.invite) {
        const url = `${window.location.origin}${result.invite.invitePath}`;
        setInviteUrl(url);
        setBanner(`School created for ${result.invite.schoolName}. Send this invite to the first admin.`);
        return;
      }

      setBanner("Request updated.");
    });
  }

  return (
    <div className="space-y-5">
      {(banner || inviteUrl) && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950">
          {banner && <p className="font-medium">{banner}</p>}
          {inviteUrl && (
            <div className="mt-3 flex flex-col gap-2 rounded-md bg-white p-3 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 overflow-x-auto text-xs text-gray-700">
                {inviteUrl}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(inviteUrl)}
                className="rounded-md bg-blue-950 px-3 py-2 text-xs font-semibold text-white"
              >
                Copy
              </button>
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="grid grid-cols-12 gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
          <span className="col-span-4">School</span>
          <span className="col-span-3 hidden md:block">Contact</span>
          <span className="col-span-2 hidden lg:block">Status</span>
          <span className="col-span-3 text-right">Action</span>
        </div>

        {entries.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-500">
            No onboarding requests yet.
          </div>
        ) : (
          entries.map((entry) => {
            const locked = isPending || entry.status === "SCHOOL_CREATED";
            return (
              <div
                key={entry.id}
                className="grid grid-cols-12 gap-3 border-b border-gray-100 px-4 py-4 last:border-b-0"
              >
                <div className="col-span-9 md:col-span-4">
                  <p className="font-semibold text-gray-900">{entry.schoolName}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Requested by {entry.name} ({entry.role.toLowerCase()})
                  </p>
                  {entry.message && (
                    <p className="mt-2 line-clamp-2 text-xs text-gray-500">
                      {entry.message}
                    </p>
                  )}
                  {entry.school && (
                    <p className="mt-2 text-xs font-medium text-emerald-700">
                      Tenant: {entry.school.slug}
                    </p>
                  )}
                </div>

                <div className="col-span-3 hidden md:block">
                  <p className="text-sm text-gray-700">{entry.email}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="col-span-2 hidden lg:block">
                  <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                    {entry.status.replace("_", " ").toLowerCase()}
                  </span>
                </div>

                <div className="col-span-3 flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={locked || entry.status === "REJECTED"}
                    onClick={() =>
                      runAction(entry.id, () =>
                        approveWaitlistEntryAction({
                          waitlistEntryId: entry.id,
                          expiresInDays: 7,
                        }),
                      )
                    }
                    className="rounded-md bg-gray-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {pendingId === entry.id ? "Working..." : "Approve"}
                  </button>
                  <button
                    type="button"
                    disabled={locked || entry.status === "REJECTED"}
                    onClick={() =>
                      runAction(entry.id, () =>
                        rejectWaitlistEntryAction({ waitlistEntryId: entry.id }),
                      )
                    }
                    className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
