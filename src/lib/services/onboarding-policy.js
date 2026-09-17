export function getInviteAvailability(invite, now = new Date()) {
  if (!invite) return { usable: false, reason: "missing" };
  if (invite.acceptedAt || invite.accepted) return { usable: false, reason: "accepted" };
  if (invite.revokedAt || invite.revoked) return { usable: false, reason: "revoked" };
  if (new Date(invite.expiresAt).getTime() < now.getTime()) {
    return { usable: false, reason: "expired" };
  }
  return { usable: true, reason: "active" };
}

export function getSchoolAdminInviteAccountSafety({
  signedInEmail,
  inviteEmail,
  existingRole,
  metadataSchoolId,
  inviteSchoolId,
  existingRoleRecord,
  adminForEmailUserId,
  userId,
}) {
  const normalizedSignedInEmail = signedInEmail?.trim().toLowerCase() ?? null;
  const normalizedInviteEmail = inviteEmail?.trim().toLowerCase() ?? null;

  if (existingRole) {
    return { allowed: false, reason: "wrong-role" };
  }

  if (metadataSchoolId && metadataSchoolId !== inviteSchoolId) {
    return { allowed: false, reason: "wrong-school-metadata" };
  }

  if (!normalizedSignedInEmail || normalizedSignedInEmail !== normalizedInviteEmail) {
    return { allowed: false, reason: "wrong-email" };
  }

  if (existingRoleRecord) {
    return { allowed: false, reason: "account-already-linked" };
  }

  if (adminForEmailUserId && adminForEmailUserId !== userId) {
    return { allowed: false, reason: "email-already-linked" };
  }

  return { allowed: true, reason: "allowed" };
}
export function canFinishOnboarding(counts) {
  return counts.grades > 0 && counts.classes > 0 && counts.subjects > 0;
}

