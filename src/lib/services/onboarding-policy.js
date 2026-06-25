export function getInviteAvailability(invite, now = new Date()) {
  if (!invite) return { usable: false, reason: "missing" };
  if (invite.acceptedAt) return { usable: false, reason: "accepted" };
  if (invite.revokedAt) return { usable: false, reason: "revoked" };
  if (new Date(invite.expiresAt).getTime() < now.getTime()) {
    return { usable: false, reason: "expired" };
  }
  return { usable: true, reason: "active" };
}

export function canFinishOnboarding(counts) {
  return counts.grades > 0 && counts.classes > 0 && counts.subjects > 0;
}
