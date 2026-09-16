import { createHash, randomBytes } from "crypto";
import { appBaseUrl } from "@/src/lib/services/notifications";

const BURSAR_INVITE_TOKEN_BYTES = 32;
const BURSAR_INVITE_EXPIRY_DAYS = 7;
const BURSAR_INVITE_ACCEPT_PATH = "/onboarding/bursar/accept";

export type BursarInviteTokenBundle = {
  token: string;
  tokenHash: string;
  expiresAt: Date;
  invitePath: string;
  inviteUrl: string;
};

export function createBursarInviteToken(): string {
  return randomBytes(BURSAR_INVITE_TOKEN_BYTES).toString("base64url");
}

export function hashBursarInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function bursarInviteExpiresAt(now = new Date()): Date {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + BURSAR_INVITE_EXPIRY_DAYS);
  return expiresAt;
}

export function buildBursarInvitePath(token: string): string {
  return `${BURSAR_INVITE_ACCEPT_PATH}?token=${encodeURIComponent(token)}`;
}

export function buildBursarInviteUrl(token: string): string {
  return `${appBaseUrl()}${buildBursarInvitePath(token)}`;
}

export function isBursarInviteExpired(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() <= now.getTime();
}

export function createBursarInviteTokenBundle(
  now = new Date(),
): BursarInviteTokenBundle {
  const token = createBursarInviteToken();

  return {
    token,
    tokenHash: hashBursarInviteToken(token),
    expiresAt: bursarInviteExpiresAt(now),
    invitePath: buildBursarInvitePath(token),
    inviteUrl: buildBursarInviteUrl(token),
  };
}
