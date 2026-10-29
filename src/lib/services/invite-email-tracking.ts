import { createHash, randomUUID } from "crypto";
import prisma from "@/src/lib/prisma";
import type { Prisma } from "@/src/generated/prisma";

export type InviteEmailKind = "TEACHER" | "PARENT" | "BURSAR" | "COLLECTOR" | "ADMIN";
export type InviteEmailStatus = "PENDING" | "ACCEPTED" | "SENT" | "DELIVERED" | "DELAYED" | "FAILED" | "BOUNCED" | "COMPLAINED" | "NOT_SENT" | "UNKNOWN";
type Metadata = Record<string, Prisma.InputJsonValue | undefined>;
const marker = "INVITE_EMAIL_ATTEMPT_V1";

// All invite audit models share these operations. School-admin audits use the
// existing onboarding log; no invitation tokens or email bodies are persisted.
type AuditWhere = { schoolId?: string; inviteId?: string; action?: "INVITE_SENT"; metadata?: Prisma.JsonFilter; AND?: AuditWhere[]; OR?: AuditWhere[] };
const selection = { schoolId: true, inviteId: true, metadata: true, createdAt: true } as const;
function auditRead(kind: InviteEmailKind, where: AuditWhere) {
  const args = { where, select: selection };
  switch (kind) {
    case "TEACHER": return prisma.teacherInviteAuditLog.findFirst(args);
    case "PARENT": return prisma.parentInviteAuditLog.findFirst(args);
    case "BURSAR": return prisma.bursarInviteAuditLog.findFirst(args);
    case "COLLECTOR": return prisma.collectorInviteAuditLog.findFirst(args);
    case "ADMIN": return prisma.onboardingAuditLog.findFirst(args);
  }
}
function auditList(kind: InviteEmailKind, where: AuditWhere) {
  const args = { where, select: selection, orderBy: { createdAt: "desc" as const }, take: 100 };
  switch (kind) {
    case "TEACHER": return prisma.teacherInviteAuditLog.findMany(args);
    case "PARENT": return prisma.parentInviteAuditLog.findMany(args);
    case "BURSAR": return prisma.bursarInviteAuditLog.findMany(args);
    case "COLLECTOR": return prisma.collectorInviteAuditLog.findMany(args);
    case "ADMIN": return prisma.onboardingAuditLog.findMany(args);
  }
}
function auditCreate(kind: InviteEmailKind, data: { schoolId: string; inviteId: string; action: "INVITE_SENT"; performedBy: string; metadata: Prisma.InputJsonValue }) {
  switch (kind) {
    case "TEACHER": return prisma.teacherInviteAuditLog.create({ data });
    case "PARENT": return prisma.parentInviteAuditLog.create({ data });
    case "BURSAR": return prisma.bursarInviteAuditLog.create({ data });
    case "COLLECTOR": return prisma.collectorInviteAuditLog.create({ data });
    case "ADMIN": return prisma.onboardingAuditLog.create({ data });
  }
}
function auditUpdate(kind: InviteEmailKind, where: AuditWhere, metadata: Prisma.InputJsonValue) {
  const args = { where, data: { metadata } };
  switch (kind) {
    case "TEACHER": return prisma.teacherInviteAuditLog.updateMany(args);
    case "PARENT": return prisma.parentInviteAuditLog.updateMany(args);
    case "BURSAR": return prisma.bursarInviteAuditLog.updateMany(args);
    case "COLLECTOR": return prisma.collectorInviteAuditLog.updateMany(args);
    case "ADMIN": return prisma.onboardingAuditLog.updateMany(args);
  }
}
async function findInvite(kind: InviteEmailKind, tokenHash: string) {
  const args = { where: { tokenHash }, select: { id: true, schoolId: true, email: true, acceptedAt: true, revokedAt: true, expiresAt: true } } as const;
  switch (kind) {
    case "TEACHER": return prisma.teacherInvite.findUnique(args);
    case "PARENT": return prisma.parentInvite.findUnique(args);
    case "BURSAR": return prisma.bursarInvite.findUnique(args);
    case "COLLECTOR": return prisma.collectorInvite.findUnique(args);
    case "ADMIN": return prisma.schoolInvite.findUnique(args);
  }
}
export type InviteEmailAttempt = { kind: InviteEmailKind; schoolId: string; inviteId: string; attemptId: string; email: string };

export async function beginInviteEmail(kind: InviteEmailKind, inviteUrl: string, email: string): Promise<InviteEmailAttempt> {
  const token = new URL(inviteUrl).searchParams.get("token");
  if (!token) throw new Error("Invitation token is missing.");
  const invite = await findInvite(kind, createHash("sha256").update(token).digest("hex"));
  if (!invite || invite.email.toLowerCase() !== email.toLowerCase()) throw new Error("Invitation email does not match its recipient.");
  if (invite.acceptedAt || invite.revokedAt || invite.expiresAt <= new Date()) throw new Error("This invitation is no longer available to send.");
  const attempt = { kind, schoolId: invite.schoolId, inviteId: invite.id, attemptId: randomUUID(), email };
  await auditCreate(kind, {
    schoolId: invite.schoolId, inviteId: invite.id, action: "INVITE_SENT", performedBy: "system:invite-email",
    metadata: { recordType: marker, attemptId: attempt.attemptId, kind, email, status: "PENDING" },
  });
  return attempt;
}

const ranks: Record<InviteEmailStatus, number> = { PENDING: 0, UNKNOWN: 1, NOT_SENT: 2, ACCEPTED: 2, SENT: 3, DELAYED: 4, DELIVERED: 5, FAILED: 6, BOUNCED: 7, COMPLAINED: 8 };
export function nextInviteEmailStatus(current: InviteEmailStatus, incoming: InviteEmailStatus) {
  return ranks[incoming] > ranks[current] ? incoming : current;
}
export async function updateInviteEmail(attempt: InviteEmailAttempt, status: InviteEmailStatus, providerMessageId?: string, eventAt?: string) {
  const log = await auditRead(attempt.kind, { schoolId: attempt.schoolId, inviteId: attempt.inviteId, metadata: { path: ["attemptId"], equals: attempt.attemptId } });
  if (!log) throw new Error("Invitation email attempt not found.");
  const metadata = log.metadata as Metadata;
  if (metadata.recordType !== marker) throw new Error("Invalid invitation email attempt.");
  if (metadata.providerMessageId && providerMessageId && metadata.providerMessageId !== providerMessageId) throw new Error("Invitation provider message does not match.");
  const current = metadata.status as InviteEmailStatus;
  const next = nextInviteEmailStatus(current, status);
  // Compare-and-swap prevents concurrent or out-of-order callbacks overwriting
  // a terminal outcome. Retrying the signed webhook re-reads the new state.
  const changed = await auditUpdate(attempt.kind,
    { schoolId: attempt.schoolId, inviteId: attempt.inviteId, AND: [
      { metadata: { path: ["attemptId"], equals: attempt.attemptId } },
      { metadata: { equals: metadata as Prisma.InputJsonValue } },
    ] },
    { ...metadata, status: next, providerMessageId: providerMessageId || metadata.providerMessageId,
      events: [...(Array.isArray(metadata.events) ? metadata.events : []),
        ...(next !== current ? [{ status: next, at: eventAt || new Date().toISOString() }] : []),
      ].slice(-20),
      ...(next !== current ? { statusAt: eventAt || new Date().toISOString() } : {}),
    } as Prisma.InputJsonValue);
  if (changed.count !== 1) throw new Error("Invitation email changed concurrently. Retry this event.");
}

const eventStatuses: Record<string, InviteEmailStatus> = {
  "email.sent": "SENT", "email.delivered": "DELIVERED", "email.delivery_delayed": "DELAYED",
  "email.bounced": "BOUNCED", "email.complained": "COMPLAINED", "email.failed": "FAILED", "email.suppressed": "FAILED",
};
const kinds: InviteEmailKind[] = ["TEACHER", "PARENT", "BURSAR", "COLLECTOR", "ADMIN"];
export async function handleInviteEmailWebhook(payload: { type?: unknown; data?: unknown; created_at?: unknown }) {
  const data = payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : {};
  const messageId = typeof data.email_id === "string" ? data.email_id : null;
  if (!messageId) return null;
  const tags = data.tags && typeof data.tags === "object" && !Array.isArray(data.tags) ? data.tags as Record<string, unknown> : {};
  const attemptTag = typeof tags.edujay_invite_attempt === "string" ? tags.edujay_invite_attempt : null;
  for (const kind of kinds) {
    const log = await auditRead(kind, { action: "INVITE_SENT", AND: [
      { metadata: { path: ["recordType"], equals: marker } },
      { OR: [ { metadata: { path: ["providerMessageId"], equals: messageId } },
        ...(attemptTag ? [{ metadata: { path: ["attemptId"], equals: attemptTag } }] : []),
      ] },
    ] });
    if (!log?.schoolId || !log.inviteId) continue;
    const meta = log.metadata as Metadata;
    if (attemptTag && meta.attemptId !== attemptTag) throw new Error("Invitation attempt does not match.");
    if (!Array.isArray(data.to) || !data.to.some((email) => typeof email === "string" && email.toLowerCase() === String(meta.email).toLowerCase())) throw new Error("Invitation recipient does not match.");
    const status = typeof payload.type === "string" ? eventStatuses[payload.type] : undefined;
    if (status) await updateInviteEmail({ kind, schoolId: log.schoolId, inviteId: log.inviteId, attemptId: String(meta.attemptId), email: String(meta.email) }, status, messageId,
      typeof payload.created_at === "string" && Number.isFinite(Date.parse(payload.created_at)) ? payload.created_at : undefined);
    return { ok: true, status: status === "DELIVERED" ? "DELIVERED" as const : status === "SENT" ? "SENT" as const : status && ["FAILED", "BOUNCED", "COMPLAINED"].includes(status) ? "FAILED" as const : "IGNORED" as const,
      message: "Invitation email status updated.", providerMessageId: messageId };
  }
  if (attemptTag) throw new Error("Invitation email tracking is not yet available. Retry this event.");
  return null;
}

export async function listInviteEmailAttempts(schoolId: string) {
  const groups = await Promise.all(kinds.map(async (kind) => {
    const rows = await auditList(kind, { schoolId, action: "INVITE_SENT", metadata: { path: ["recordType"], equals: marker } });
    const args = { where: { schoolId, id: { in: rows.flatMap((row) => row.inviteId ? [row.inviteId] : []) } },
      select: { id: true, acceptedAt: true, revokedAt: true, expiresAt: true } } as const;
    const invites = await (kind === "TEACHER" ? prisma.teacherInvite.findMany(args)
      : kind === "PARENT" ? prisma.parentInvite.findMany(args)
        : kind === "BURSAR" ? prisma.bursarInvite.findMany(args)
          : kind === "COLLECTOR" ? prisma.collectorInvite.findMany(args) : prisma.schoolInvite.findMany(args));
    const lifecycle = new Map(invites.map((invite) => [invite.id, invite.acceptedAt ? "Accepted" : invite.revokedAt ? "Revoked" : invite.expiresAt < new Date() ? "Expired" : "Pending acceptance"]));
    return rows.map((row) => ({ kind, inviteId: row.inviteId, createdAt: row.createdAt, metadata: row.metadata as Metadata,
      invitationState: row.inviteId ? lifecycle.get(row.inviteId) || "Unavailable" : "Unavailable" }));
  }));
  return groups.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 100);
}
