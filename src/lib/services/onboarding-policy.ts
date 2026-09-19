type InviteAvailabilityInput = {
  accepted?: boolean | null;
  acceptedAt?: Date | string | null;
  revoked?: boolean | null;
  revokedAt?: Date | string | null;
  expiresAt: Date | string;
} | null | undefined;

type InviteAvailabilityReason = "missing" | "accepted" | "revoked" | "expired" | "active";

type InviteAvailability =
  | { usable: true; reason: "active" }
  | { usable: false; reason: Exclude<InviteAvailabilityReason, "active"> };

type SchoolAdminInviteAccountSafetyInput = {
  signedInEmail?: string | null;
  inviteEmail?: string | null;
  existingRole?: string | null;
  metadataSchoolId?: string | null;
  inviteSchoolId: string;
  existingRoleRecord: boolean;
  adminForEmailUserId?: string | null;
  userId: string;
};

type SchoolAdminInviteAccountSafetyReason =
  | "allowed"
  | "wrong-role"
  | "wrong-school-metadata"
  | "wrong-email"
  | "account-already-linked"
  | "email-already-linked";

type SchoolAdminInviteAccountSafety =
  | { allowed: true; reason: "allowed" }
  | { allowed: false; reason: Exclude<SchoolAdminInviteAccountSafetyReason, "allowed"> };

type OnboardingCounts = {
  grades: number;
  classes: number;
  subjects: number;
};

export function getInviteAvailability(invite: InviteAvailabilityInput, now = new Date()): InviteAvailability {
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
}: SchoolAdminInviteAccountSafetyInput): SchoolAdminInviteAccountSafety {
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

export function canFinishOnboarding(counts: OnboardingCounts) {
  return counts.grades > 0 && counts.classes > 0 && counts.subjects > 0;
}
