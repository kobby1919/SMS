export function getBursarInviteAccountSafety(input) {
  const signedInEmail = input.signedInEmail?.trim().toLowerCase() ?? null;
  const inviteEmail = input.inviteEmail?.trim().toLowerCase() ?? null;

  if (input.existingRole && input.existingRole !== "bursar") {
    return { allowed: false, reason: "wrong-role" };
  }

  if (!signedInEmail || !inviteEmail || signedInEmail !== inviteEmail) {
    return { allowed: false, reason: "wrong-email" };
  }

  if (input.metadataSchoolId && input.metadataSchoolId !== input.inviteSchoolId) {
    return { allowed: false, reason: "wrong-school-metadata" };
  }

  if (input.bursarForUserSchoolId && input.bursarForUserSchoolId !== input.inviteSchoolId) {
    return { allowed: false, reason: "account-linked-to-another-school" };
  }

  if (input.bursarForEmailUserId && input.bursarForEmailUserId !== input.userId) {
    return { allowed: false, reason: "email-already-linked" };
  }

  return { allowed: true, reason: "ok" };
}

export function canUseBursarIdentity(input) {
  return input.status === "ACTIVE";
}
