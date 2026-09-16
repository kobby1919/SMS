export function getParentInviteAccountSafety({
  signedInEmail,
  inviteEmail,
  existingRole,
  metadataSchoolId,
  inviteSchoolId,
  parentForUserSchoolId,
  parentForEmailUserId,
  userId,
}) {
  const normalizedSignedInEmail = signedInEmail?.trim().toLowerCase() ?? null;
  const normalizedInviteEmail = inviteEmail?.trim().toLowerCase() ?? null;

  if (existingRole && existingRole !== "parent") {
    return { allowed: false, reason: "wrong-role" };
  }

  if (existingRole === "parent" && metadataSchoolId && metadataSchoolId !== inviteSchoolId) {
    return { allowed: false, reason: "wrong-school-metadata" };
  }

  if (!normalizedSignedInEmail || normalizedSignedInEmail !== normalizedInviteEmail) {
    return { allowed: false, reason: "wrong-email" };
  }

  if (parentForUserSchoolId && parentForUserSchoolId !== inviteSchoolId) {
    return { allowed: false, reason: "wrong-school-parent" };
  }

  if (parentForEmailUserId && parentForEmailUserId !== userId) {
    return { allowed: false, reason: "email-already-linked" };
  }

  return { allowed: true, reason: "allowed" };
}

export function canUseParentWardRelationship({
  hasRelationshipRows,
  status,
  permission,
  canViewFees = true,
  canViewReports = true,
  canMessageSchool = true,
  legacyParentMatches = false,
}) {
  if (!hasRelationshipRows) return legacyParentMatches;
  if (status !== "ACTIVE") return false;
  if (permission === "fees") return canViewFees;
  if (permission === "reports") return canViewReports;
  if (permission === "messages") return canMessageSchool;
  return true;
}
