import { z } from "zod";
import { canUseParentWardRelationship } from "@/src/lib/services/parent-onboarding-policy.js";

const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
const scheduleSchema = z.object({ timezone: z.string().min(1).max(80), summaryCadence: z.enum(["OFF", "DAILY", "WEEKLY", "BOTH"]), weeklySummarySendDay: z.enum(days), weeklySummarySendTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) });
const isoDay = (calendar: Date) => calendar.toISOString().slice(0, 10);
const shift = (calendar: Date, count: number) => new Date(calendar.getTime() + count * 86400000);
const inconsistent = (message: string) => Object.assign(new Error(message), { code: "PARENT_ENGAGEMENT_INCONSISTENT" });

function localParts(date: Date, timezone: string) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

function scheduledInstant(calendar: Date, time: string, timezone: string) {
  const [hour, minute] = time.split(":").map(Number);
  const desired = Date.UTC(calendar.getUTCFullYear(), calendar.getUTCMonth(), calendar.getUTCDate(), hour, minute);
  let candidate = desired;
  for (let i = 0; i < 4; i++) {
    const p = localParts(new Date(candidate), timezone);
    const difference = desired - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    if (difference === 0) {
      for (const offset of [-7200000, -3600000, -1800000, 1800000, 3600000, 7200000]) {
        const other = localParts(new Date(candidate + offset), timezone);
        if (Date.UTC(other.year, other.month - 1, other.day, other.hour, other.minute) === desired) throw new Error("The configured send time is ambiguous in the school timezone.");
      }
      return new Date(candidate);
    }
    candidate += difference;
  }
  throw new Error("The configured send time does not exist in the school timezone.");
}

/** Calendar keys match Monday-Sunday parent summaries; due time is school-local. */
export function parentWeeklySchedule(settings: unknown, now = new Date()) {
  const parsed = scheduleSchema.safeParse(settings);
  if (!parsed.success || !Number.isFinite(now.getTime())) return { state: "SETUP_REQUIRED" as const, period: null, nextSendAt: null };
  if (!["WEEKLY", "BOTH"].includes(parsed.data.summaryCadence)) return { state: "DISABLED" as const, period: null, nextSendAt: null };
  try {
    const { timezone, weeklySummarySendDay, weeklySummarySendTime } = parsed.data;
    const p = localParts(now, timezone);
    const today = new Date(Date.UTC(p.year, p.month - 1, p.day));
    const monday = shift(today, -((today.getUTCDay() + 6) % 7));
    const sendOffset = days.indexOf(weeklySummarySendDay);
    const thisSend = scheduledInstant(shift(monday, sendOffset), weeklySummarySendTime, timezone);
    const due = now >= thisSend;
    const start = due ? monday : shift(monday, -7);
    const nextSend = due ? scheduledInstant(shift(monday, sendOffset + 7), weeklySummarySendTime, timezone) : thisSend;
    return { state: "AVAILABLE" as const, period: { startDate: isoDay(start), endDateExclusive: isoDay(shift(start, 7)), rangeKey: `${isoDay(start)}:${isoDay(shift(start, 6))}`, dueAt: scheduledInstant(shift(start, sendOffset), weeklySummarySendTime, timezone).toISOString() }, nextSendAt: nextSend.toISOString() };
  } catch { return { state: "SETUP_REQUIRED" as const, period: null, nextSendAt: null }; }
}

/** Legacy generators use host-local week boundaries. Refuse competing calendars. */
export function parentSummaryCalendarCompatible(timezone: string, period: { startDate: string; endDateExclusive: string }) {
  try {
    return [period.startDate, period.endDateExclusive].every((key) => {
      const calendar = new Date(`${key}T00:00:00Z`);
      const host = new Date(`${key}T00:00:00`);
      return Number.isFinite(host.getTime()) && host.getTime() === scheduledInstant(calendar, "00:00", timezone).getTime() && host.getTime() === calendar.getTime();
    });
  } catch { return false; }
}

const requestSchema = z.object({ status: z.enum(["PENDING", "ACKNOWLEDGED", "RESPONDED", "ESCALATED", "CLOSED", "CANCELLED"]), priority: z.enum(["LOW", "NORMAL", "HIGH"]), lastParentMessageAt: z.date(), lastTeacherResponseAt: z.date().nullable(), respondedAt: z.date().nullable(), responseDueAt: z.date().nullable() });
export function parentResponsePosition(request: unknown, now = new Date()) {
  const parsed = requestSchema.safeParse(request);
  if (!parsed.success || !Number.isFinite(now.getTime())) return { state: "UNAVAILABLE" as const, awaitingResponse: null, overdue: null, highPriority: null, escalated: null };
  const row = parsed.data;
  const timestamps = [row.lastParentMessageAt, row.lastTeacherResponseAt, row.respondedAt].filter((date): date is Date => date !== null);
  if (timestamps.some((date) => date > now)) return { state: "UNAVAILABLE" as const, awaitingResponse: null, overdue: null, highPriority: null, escalated: null };
  const closed = ["CLOSED", "CANCELLED"].includes(row.status);
  const lastReply = Math.max(row.lastTeacherResponseAt?.getTime() ?? -Infinity, row.respondedAt?.getTime() ?? -Infinity);
  const awaitingResponse = !closed && lastReply < row.lastParentMessageAt.getTime();
  // A deadline for an earlier message cannot establish an SLA for a later reply.
  const deadlineConfigured = row.responseDueAt !== null && row.responseDueAt >= row.lastParentMessageAt;
  return { state: "AVAILABLE" as const, awaitingResponse, overdue: awaitingResponse && deadlineConfigured && row.responseDueAt! < now, deadlineConfigured, highPriority: awaitingResponse && row.priority === "HIGH", escalated: !closed && row.status === "ESCALATED" };
}

/** Import placeholders are replaced with the Clerk user ID on invite acceptance. */
export function parentRecordedPortalState(parentId: string, hasAcceptedInvite: boolean) {
  if (!parentId?.trim() || typeof hasAcceptedInvite !== "boolean") throw inconsistent("Portal activation evidence requires review.");
  const imported = /^par_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parentId);
  if (imported && hasAcceptedInvite) throw inconsistent("Imported profile conflicts with recorded account activation.");
  if (hasAcceptedInvite) return "ACTIVE" as const;
  return imported ? "NEEDS_INVITE" as const : "UNAVAILABLE" as const;
}

export function parentContactPosition(parent: unknown) {
  const parsed = z.object({ email: z.string().nullable(), phone: z.string().nullable() }).safeParse(parent);
  if (!parsed.success) return { state: "UNAVAILABLE" as const, missingEmail: null, invalidEmail: null, missingPhone: null, invalidPhone: null, usableEmail: null, usablePhone: null, noExternalContact: null };
  const email = parsed.data.email?.trim() ?? "";
  const phone = parsed.data.phone?.trim() ?? "";
  const usableEmail = z.string().email().safeParse(email).success;
  const digits = phone.replace(/\D/g, "");
  const usablePhone = /^\+?[\d\s()-]+$/.test(phone) && digits.length >= 7 && digits.length <= 15;
  return { state: "AVAILABLE" as const, missingEmail: email === "", invalidEmail: email !== "" && !usableEmail, missingPhone: phone === "", invalidPhone: phone !== "" && !usablePhone, usableEmail, usablePhone, noExternalContact: !usableEmail && !usablePhone };
}

const studentStatusSchema = z.enum(["ACTIVE", "INCOMPLETE_SETUP", "TRANSFERRED", "GRADUATED", "WITHDRAWN"]);
const guardianSchema = z.object({ parentId: z.string().trim().min(1), parentSchoolId: z.string().min(1), studentId: z.string().trim().min(1), studentSchoolId: z.string().min(1), studentStatus: studentStatusSchema, hasRelationshipRows: z.boolean(), relationshipStatus: z.enum(["ACTIVE", "REMOVED", "TRANSFERRED", "REVOKED", "GRADUATED"]).optional(), legacyParentMatches: z.boolean(), canViewFees: z.boolean(), canViewReports: z.boolean(), canMessageSchool: z.boolean(), email: z.string().nullable(), phone: z.string().nullable(), portalState: z.enum(["ACTIVE", "NEEDS_INVITE", "INVITED", "UNAVAILABLE"]) }).refine((row) => row.hasRelationshipRows || row.relationshipStatus === undefined);

export type EngagementGuardian = {
  parentId: string; parentSchoolId: string; studentId: string; studentSchoolId: string; studentStatus: string;
  hasRelationshipRows: boolean; relationshipStatus?: string; legacyParentMatches: boolean;
  canViewFees: boolean; canViewReports: boolean; canMessageSchool: boolean;
  email: string | null; phone: string | null; portalState: "ACTIVE" | "NEEDS_INVITE" | "INVITED" | "UNAVAILABLE";
};

export function eligibleEngagementGuardian(schoolId: string, studentId: string, guardian: EngagementGuardian, permission?: "fees" | "reports" | "messages") {
  if (!guardianSchema.safeParse(guardian).success) return false;
  return Boolean(schoolId.trim()) && guardian.parentSchoolId === schoolId && guardian.studentSchoolId === schoolId && guardian.studentId === studentId && guardian.studentStatus === "ACTIVE" && canUseParentWardRelationship({ hasRelationshipRows: guardian.hasRelationshipRows, status: guardian.relationshipStatus, permission, legacyParentMatches: guardian.legacyParentMatches, canViewFees: guardian.canViewFees, canViewReports: guardian.canViewReports, canMessageSchool: guardian.canMessageSchool });
}

export function studentParentContactPosition(schoolId: string, studentId: string, guardians: EngagementGuardian[], studentStatus = "ACTIVE") {
  if (!schoolId.trim() || !studentId.trim()) throw inconsistent("School and student scope are required.");
  if (!studentStatusSchema.safeParse(studentStatus).success) throw inconsistent("Student status requires review.");
  if (studentStatus !== "ACTIVE") return { state: "NOT_APPLICABLE" as const, activeGuardians: 0, noActiveGuardian: null, noExternalContact: null, noUsableEmail: null, noUsablePhone: null, portalState: "NOT_APPLICABLE" };
  const parsed = z.array(guardianSchema).safeParse(guardians);
  if (!parsed.success) throw inconsistent("Guardian evidence requires review.");
  const unique = new Map<string, EngagementGuardian>();
  for (const row of parsed.data) {
    if (row.parentSchoolId !== schoolId || row.studentSchoolId !== schoolId || row.studentId !== studentId) continue;
    if (row.studentStatus !== studentStatus) throw inconsistent("Guardian and student status evidence disagree.");
    const previous = unique.get(row.parentId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row)) throw inconsistent("Conflicting guardian evidence requires review.");
    unique.set(row.parentId, row);
  }
  const eligible = [...unique.values()].filter((row) => eligibleEngagementGuardian(schoolId, studentId, row));
  const noActiveGuardian = eligible.length === 0;
  const contacts = eligible.map(parentContactPosition);
  return { state: "AVAILABLE" as const, activeGuardians: eligible.length, noActiveGuardian, noExternalContact: !noActiveGuardian && contacts.every((row) => row.noExternalContact), noUsableEmail: !noActiveGuardian && contacts.every((row) => !row.usableEmail), noUsablePhone: !noActiveGuardian && contacts.every((row) => !row.usablePhone), portalState: noActiveGuardian ? "NO_GUARDIAN" : eligible.some((row) => row.portalState === "ACTIVE") ? "AVAILABLE" : eligible.some((row) => row.portalState === "UNAVAILABLE") ? "UNAVAILABLE" : "NOT_ACTIVATED" };
}

export function summaryChannelPosition(input: { weeklyEnabled: boolean; parentWeeklyEnabled: boolean; schoolChannelEnabled: boolean; parentChannelEnabled: boolean; providerConfigured: boolean; destinationUsable: boolean }) {
  if (!z.object({ weeklyEnabled: z.boolean(), parentWeeklyEnabled: z.boolean(), schoolChannelEnabled: z.boolean(), parentChannelEnabled: z.boolean(), providerConfigured: z.boolean(), destinationUsable: z.boolean() }).safeParse(input).success) return "UNAVAILABLE";
  if (!input.weeklyEnabled || !input.schoolChannelEnabled) return "DISABLED";
  if (!input.parentWeeklyEnabled || !input.parentChannelEnabled) return "OPTED_OUT";
  if (!input.providerConfigured) return "NOT_CONFIGURED";
  if (!input.destinationUsable) return "MISSING_CONTACT";
  return "AVAILABLE";
}

export function parentMessagingPosition(policy: unknown) {
  const parsed = z.object({ enabled: z.boolean(), allowParentTeacherMessaging: z.boolean() }).safeParse(policy);
  if (!parsed.success) return "SETUP_REQUIRED";
  return parsed.data.enabled && parsed.data.allowParentTeacherMessaging ? "AVAILABLE" : "DISABLED";
}

const deliverySchema = z.object({ id: z.string().min(1), channel: z.enum(["IN_APP", "EMAIL", "SMS", "WHATSAPP"]), status: z.enum(["PENDING", "SENT", "DELIVERED", "FAILED", "RETRYING", "CANCELLED"]), updatedAt: z.date(), sentAt: z.date().nullable(), deliveredAt: z.date().nullable(), providerMessageId: z.string().nullable() });
export type EngagementDelivery = z.infer<typeof deliverySchema> & { provider?: string | null; createdAt?: Date };
export function emailDeliveryPosition(deliveries: EngagementDelivery[], now = new Date()) {
  if (!Array.isArray(deliveries)) return "UNAVAILABLE";
  const parsed = z.array(deliverySchema.extend({ provider: z.string().nullable().optional(), createdAt: z.date().optional() })).safeParse(deliveries.filter((row) => row?.channel === "EMAIL"));
  if (!parsed.success || !Number.isFinite(now.getTime())) return "UNAVAILABLE";
  const unique = new Map<string, typeof parsed.data[number]>();
  for (const entry of parsed.data) {
    const previous = unique.get(entry.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(entry)) return "UNAVAILABLE";
    unique.set(entry.id, entry);
  }
  const emails = [...unique.values()];
  if (emails.some((entry) => entry.createdAt !== undefined) && emails.some((entry) => entry.createdAt === undefined)) return "UNAVAILABLE";
  const orderTime = (entry: typeof emails[number]) => (entry.createdAt ?? entry.updatedAt).getTime();
  emails.sort((a, b) => orderTime(b) - orderTime(a) || a.id.localeCompare(b.id));
  if (!emails.length) return "NOT_QUEUED";
  const row = emails[0];
  const simulated = (entry: typeof row) => entry.provider === "console" || Boolean(entry.providerMessageId?.startsWith("console:"));
  if (emails.some((entry) => orderTime(entry) === orderTime(row) && simulated(entry) !== simulated(row))) return "UNAVAILABLE";
  if (emails.some((candidate) => orderTime(candidate) === orderTime(row) && candidate.status !== row.status)) return "UNAVAILABLE";
  for (const candidate of emails.filter((entry) => orderTime(entry) === orderTime(row))) {
    if (candidate.updatedAt > now || candidate.sentAt && candidate.sentAt > now || candidate.deliveredAt && candidate.deliveredAt > now) return "UNAVAILABLE";
    if (candidate.createdAt && (candidate.createdAt > candidate.updatedAt || candidate.sentAt && candidate.sentAt < candidate.createdAt || candidate.deliveredAt && candidate.deliveredAt < candidate.createdAt)) return "UNAVAILABLE";
    if (candidate.sentAt && candidate.sentAt > candidate.updatedAt || candidate.deliveredAt && candidate.deliveredAt > candidate.updatedAt || candidate.sentAt && candidate.deliveredAt && candidate.deliveredAt < candidate.sentAt) return "UNAVAILABLE";
    if (candidate.status === "DELIVERED" && (!candidate.deliveredAt || !candidate.providerMessageId?.trim())) return "UNAVAILABLE";
    if (candidate.status === "SENT" && (!candidate.sentAt || !candidate.providerMessageId?.trim())) return "UNAVAILABLE";
  }
  if (simulated(row)) return "SIMULATED";
  return row.status;
}

/** Use canonical ParentNotification rows and central deliveries only, not legacy attempt logs. */
export function countWeeklyParentSummaryStates(input: { schoolId: string; rangeKey: string; eligibleParentIds: ReadonlySet<string>; summaries: { id: string; schoolId: string; parentId: string; sourceModel: string; sourceKey: string; centralTracked?: boolean; deliveries: EngagementDelivery[] }[]; now: Date }) {
  const range = /^\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2}$/.test(input.rangeKey) ? input.rangeKey.split(":") : [];
  const start = new Date(`${range[0]}T00:00:00Z`);
  if (!input.schoolId.trim() || !Number.isFinite(input.now.getTime()) || !Number.isFinite(start.getTime()) || isoDay(start) !== range[0] || start.getUTCDay() !== 1 || isoDay(shift(start, 6)) !== range[1]) throw inconsistent("A valid school, evaluation time and Monday-Sunday summary period are required.");
  const unique = new Map<string, { id: string; centralTracked: boolean; deliveries: EngagementDelivery[] }>();
  for (const row of input.summaries) {
    if (row.schoolId !== input.schoolId || !input.eligibleParentIds.has(row.parentId) || row.sourceModel !== "ParentWeeklySummary" || row.sourceKey !== `weekly-summary:${row.parentId}:${input.rangeKey}`) continue;
    const previous = unique.get(row.parentId);
    if (!row.id.trim() || !row.parentId.trim()) throw inconsistent("Parent summary identity requires review.");
    if (previous && previous.id !== row.id) throw inconsistent("Conflicting parent summaries require review.");
    const centralTracked = row.centralTracked ?? true;
    if (typeof centralTracked !== "boolean" || previous && previous.centralTracked !== centralTracked) throw inconsistent("Conflicting central tracking evidence requires review.");
    unique.set(row.parentId, { id: row.id, centralTracked, deliveries: [...(previous?.deliveries ?? []), ...row.deliveries] });
  }
  const states = [...unique.values()].map((row) => row.centralTracked ? emailDeliveryPosition(row.deliveries, input.now) : "UNAVAILABLE");
  return { summariesAvailable: unique.size, queuedOrRetrying: states.filter((state) => state === "PENDING" || state === "RETRYING").length, sent: states.filter((state) => state === "SENT").length, delivered: states.filter((state) => state === "DELIVERED").length, failed: states.filter((state) => state === "FAILED").length, cancelled: states.filter((state) => state === "CANCELLED").length, notQueued: states.filter((state) => state === "NOT_QUEUED").length, simulated: states.filter((state) => state === "SIMULATED").length, unavailable: states.filter((state) => state === "UNAVAILABLE").length };
}

const routeSchema = z.object({ weeklyEnabled: z.boolean(), parentWeeklyEnabled: z.boolean(), schoolChannelEnabled: z.boolean(), parentChannelEnabled: z.boolean(), destinationUsable: z.boolean(), providerState: z.enum(["AVAILABLE", "NOT_CONFIGURED", "UNSUPPORTED", "SIMULATED"]) });
export type ParentSummaryRoute = z.infer<typeof routeSchema>;
/** Future routing eligibility, not evidence of a past send or human reachability. */
export function parentSummaryRoutePosition(input: unknown) {
  const parsed = routeSchema.safeParse(input);
  if (!parsed.success) return "UNAVAILABLE";
  const row = parsed.data;
  if (!row.weeklyEnabled || !row.schoolChannelEnabled) return "DISABLED";
  if (!row.parentWeeklyEnabled || !row.parentChannelEnabled) return "OPTED_OUT";
  if (row.providerState !== "AVAILABLE") return row.providerState;
  return row.destinationUsable ? "AVAILABLE" : "MISSING_CONTACT";
}

export function countParentSummaryRoutes(inputs: unknown[]) {
  const totals = { available: 0, disabled: 0, optedOut: 0, notConfigured: 0, unsupported: 0, simulated: 0, missingContact: 0, unavailable: 0 };
  const keys = { AVAILABLE: "available", DISABLED: "disabled", OPTED_OUT: "optedOut", NOT_CONFIGURED: "notConfigured", UNSUPPORTED: "unsupported", SIMULATED: "simulated", MISSING_CONTACT: "missingContact", UNAVAILABLE: "unavailable" } as const;
  for (const input of inputs) totals[keys[parentSummaryRoutePosition(input)]]++;
  return totals;
}
