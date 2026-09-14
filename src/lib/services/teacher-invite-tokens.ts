import { createHash, randomBytes } from "crypto";
import { appBaseUrl } from "@/src/lib/services/notifications";

const TEACHER_INVITE_TOKEN_BYTES = 32;
const TEACHER_INVITE_EXPIRY_DAYS = 7;
const TEACHER_INVITE_ACCEPT_PATH = "/onboarding/teacher/accept";

export type TeacherInviteTokenBundle = {
  token: string;
  tokenHash: string;
  expiresAt: Date;
  invitePath: string;
  inviteUrl: string;
};

export function createTeacherInviteToken(): string {
  return randomBytes(TEACHER_INVITE_TOKEN_BYTES).toString("base64url");
}

export function hashTeacherInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function teacherInviteExpiresAt(now = new Date()): Date {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + TEACHER_INVITE_EXPIRY_DAYS);
  return expiresAt;
}

export function buildTeacherInvitePath(token: string): string {
  return `${TEACHER_INVITE_ACCEPT_PATH}?token=${encodeURIComponent(token)}`;
}

export function buildTeacherInviteUrl(token: string): string {
  return `${appBaseUrl()}${buildTeacherInvitePath(token)}`;
}

export function isTeacherInviteExpired(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() <= now.getTime();
}

export function createTeacherInviteTokenBundle(
  now = new Date(),
): TeacherInviteTokenBundle {
  const token = createTeacherInviteToken();

  return {
    token,
    tokenHash: hashTeacherInviteToken(token),
    expiresAt: teacherInviteExpiresAt(now),
    invitePath: buildTeacherInvitePath(token),
    inviteUrl: buildTeacherInviteUrl(token),
  };
}
