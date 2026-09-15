import { createHash, randomBytes } from "crypto";
import { appBaseUrl } from "@/src/lib/services/notifications";

const PARENT_INVITE_TOKEN_BYTES = 32;
const PARENT_INVITE_EXPIRY_DAYS = 7;
const PARENT_INVITE_ACCEPT_PATH = "/onboarding/parent/accept";

export type ParentInviteTokenBundle = {
  token: string;
  tokenHash: string;
  expiresAt: Date;
  invitePath: string;
  inviteUrl: string;
};

export function createParentInviteToken(): string {
  return randomBytes(PARENT_INVITE_TOKEN_BYTES).toString("base64url");
}

export function hashParentInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function parentInviteExpiresAt(now = new Date()): Date {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + PARENT_INVITE_EXPIRY_DAYS);
  return expiresAt;
}

export function buildParentInvitePath(token: string): string {
  return `${PARENT_INVITE_ACCEPT_PATH}?token=${encodeURIComponent(token)}`;
}

export function buildParentInviteUrl(token: string): string {
  return `${appBaseUrl()}${buildParentInvitePath(token)}`;
}

export function isParentInviteExpired(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() <= now.getTime();
}

export function createParentInviteTokenBundle(now = new Date()): ParentInviteTokenBundle {
  const token = createParentInviteToken();

  return {
    token,
    tokenHash: hashParentInviteToken(token),
    expiresAt: parentInviteExpiresAt(now),
    invitePath: buildParentInvitePath(token),
    inviteUrl: buildParentInviteUrl(token),
  };
}