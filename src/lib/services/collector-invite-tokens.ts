import { createHash, randomBytes } from "crypto";
import { appBaseUrl } from "@/src/lib/services/notifications";

const COLLECTOR_INVITE_TOKEN_BYTES = 32;
const COLLECTOR_INVITE_EXPIRY_DAYS = 7;
const COLLECTOR_INVITE_ACCEPT_PATH = "/onboarding/collector/accept";

export type CollectorInviteTokenBundle = {
  token: string;
  tokenHash: string;
  expiresAt: Date;
  invitePath: string;
  inviteUrl: string;
};

export function createCollectorInviteToken(): string {
  return randomBytes(COLLECTOR_INVITE_TOKEN_BYTES).toString("base64url");
}

export function hashCollectorInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function collectorInviteExpiresAt(now = new Date()): Date {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + COLLECTOR_INVITE_EXPIRY_DAYS);
  return expiresAt;
}

export function buildCollectorInvitePath(token: string): string {
  return `${COLLECTOR_INVITE_ACCEPT_PATH}?token=${encodeURIComponent(token)}`;
}

export function buildCollectorInviteUrl(token: string): string {
  return `${appBaseUrl()}${buildCollectorInvitePath(token)}`;
}

export function isCollectorInviteExpired(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() <= now.getTime();
}

export function createCollectorInviteTokenBundle(
  now = new Date(),
): CollectorInviteTokenBundle {
  const token = createCollectorInviteToken();

  return {
    token,
    tokenHash: hashCollectorInviteToken(token),
    expiresAt: collectorInviteExpiresAt(now),
    invitePath: buildCollectorInvitePath(token),
    inviteUrl: buildCollectorInviteUrl(token),
  };
}
