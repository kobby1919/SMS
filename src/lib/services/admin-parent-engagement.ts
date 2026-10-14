import "server-only";
import prisma from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/authz";
import { z } from "zod";
import { countParentSummaryRoutes } from "@/src/lib/parent-engagement-rules";
import { notificationProviderAvailability } from "@/src/lib/services/notification-provider-adapters";
import { countWeeklyParentSummaryStates, eligibleEngagementGuardian, parentContactPosition, parentMessagingPosition, parentResponsePosition, parentWeeklySchedule, studentParentContactPosition, type EngagementGuardian } from "@/src/lib/parent-engagement-rules";

const budgets = { students: 5000, parents: 6000, relationships: 20000, invites: 12000, requests: 10000, summaries: 6000, notifications: 12000, deliveries: 24000 };
const inconsistent = () => Object.assign(new Error("Parent engagement evidence requires review."), { code: "PARENT_ENGAGEMENT_INCONSISTENT" });
const knownDatabaseErrors = new Set(["P1001", "P1002", "P1017", "P2024", "P2028", "P2034"]);
type ContactTotals = { missingEmails: number; invalidEmails: number; missingPhones: number; invalidPhones: number; parentsWithoutExternalContact: number; studentsWithoutActiveGuardian: number; studentsWithoutExternalContact: number; studentsWithRecordedActivation: number; studentsWithUnknownActivation: number; portalAccessVerified: false };
const relationshipSchema = z.object({ schoolId: z.string().min(1), parentId: z.string().min(1), studentId: z.string().min(1), status: z.enum(["ACTIVE", "REMOVED", "TRANSFERRED", "REVOKED", "GRADUATED"]), canViewFees: z.boolean(), canViewReports: z.boolean(), canMessageSchool: z.boolean() });
const parentSchema = z.object({ id: z.string().min(1), schoolId: z.string().min(1), email: z.string().nullable(), phone: z.string().nullable(), _count: z.object({ studentRelationships: z.number().int().nonnegative() }), notificationPreference: z.object({ schoolId: z.string().min(1), parentId: z.string().min(1), weeklySummaryEnabled: z.boolean(), emailEnabled: z.boolean() }).nullable() });

/** No caller-provided tenant, sending, preference writes or provider network calls. */
export async function getAdminParentEngagementSnapshot() {
  const { schoolId } = await requireRole(["admin"]);
  if (!schoolId?.trim()) throw new Error("An authenticated school scope is required.");
  const empty = (code: string) => ({ state: "UNAVAILABLE" as const, code, evaluatedAt: new Date().toISOString(), schedule: null as ReturnType<typeof parentWeeklySchedule> | null, newMessagingState: "UNAVAILABLE" as string, summaryTrackingState: "UNAVAILABLE" as string, requestsTrackingState: "UNAVAILABLE" as string, deliverySettingsState: "UNAVAILABLE" as string, cohort: null as { students: number; parents: number } | null, summaries: null as ReturnType<typeof countWeeklyParentSummaryStates> | null, requests: null as { awaitingResponse: number; overdue: number; highPriority: number; escalated: number; missingDeadlines: number; unavailable: number } | null, contacts: null as ContactTotals | null, preferences: null as { weeklyOptOut: number; emailOptOut: number; schoolEmailEnabled: boolean | null } | null });
  try {
    return await prisma.$transaction(async (db) => {
      const now = new Date();
      const parentWhere = { schoolId, OR: [{ studentRelationships: { some: { schoolId, student: { schoolId, status: "ACTIVE" as const } } } }, { students: { some: { schoolId, status: "ACTIVE" as const } } }] };
      const [setting, appSetting, policy, studentCount, parentCount, relationshipCount, requestCount] = await Promise.all([
        db.schoolNotificationSetting.findUnique({ where: { schoolId } }),
        db.appNotificationSetting.findUnique({ where: { schoolId }, select: { emailEnabled: true, sendParentSummariesByEmail: true, smsEnabled: true, whatsappEnabled: true, sendParentSummariesBySms: true, sendParentSummariesByWhatsapp: true } }),
        db.schoolCommunicationPolicy.findUnique({ where: { schoolId }, select: { enabled: true, allowParentTeacherMessaging: true } }),
        db.student.count({ where: { schoolId, status: "ACTIVE" } }),
        db.parent.count({ where: parentWhere }),
        db.parentStudentRelationship.count({ where: { schoolId, student: { schoolId, status: "ACTIVE" } } }),
        db.parentTeacherContactRequest.count({ where: { schoolId, status: { notIn: ["CLOSED", "CANCELLED"] }, student: { schoolId, status: "ACTIVE" }, parent: { schoolId }, teacher: { schoolId } } }),
      ]);
      if (studentCount > budgets.students || parentCount > budgets.parents || relationshipCount > budgets.relationships || requestCount > budgets.requests) return empty("EVALUATION_LIMIT");
      const [students, parents, relationships] = await Promise.all([
        db.student.findMany({ where: { schoolId, status: "ACTIVE", class: { schoolId } }, select: { id: true, parentId: true }, orderBy: { id: "asc" } }),
        db.parent.findMany({ where: parentWhere, select: { id: true, schoolId: true, email: true, phone: true, notificationPreference: true, _count: { select: { studentRelationships: { where: { schoolId } } } } } }),
        db.parentStudentRelationship.findMany({ where: { schoolId, student: { schoolId, status: "ACTIVE" } }, select: { schoolId: true, parentId: true, studentId: true, status: true, canViewFees: true, canViewReports: true, canMessageSchool: true } }),
      ]);
      if (students.length !== studentCount || parents.length !== parentCount || relationships.length !== relationshipCount) throw inconsistent();
      if (!z.array(relationshipSchema).safeParse(relationships).success || !z.array(parentSchema).safeParse(parents).success) throw inconsistent();
      const parentMap = new Map(parents.map((row) => [row.id, row]));
      const studentIds = new Set(students.map((row) => row.id));
      if (parentMap.size !== parents.length || studentIds.size !== students.length || parents.some((row) => row.schoolId !== schoolId || row.notificationPreference && (row.notificationPreference.schoolId !== schoolId || row.notificationPreference.parentId !== row.id))) throw inconsistent();
      if (setting && !z.object({ emailEnabled: z.boolean() }).safeParse(setting).success || appSetting && !z.object({ emailEnabled: z.boolean(), sendParentSummariesByEmail: z.boolean() }).safeParse(appSetting).success) throw inconsistent();
      const inviteWhere = { schoolId, status: "ACCEPTED" as const, acceptedAt: { not: null, lte: now }, acceptedParentId: { in: parents.map((row) => row.id) } };
      const inviteCount = await db.parentInvite.count({ where: inviteWhere });
      if (inviteCount > budgets.invites) return empty("EVALUATION_LIMIT");
      const accepted = await db.parentInvite.findMany({ where: inviteWhere, select: { schoolId: true, status: true, acceptedAt: true, acceptedParentId: true, acceptedBy: true } });
      if (accepted.length !== inviteCount) throw inconsistent();
      if (accepted.some((row) => row.schoolId !== schoolId || row.status !== "ACCEPTED" || !row.acceptedAt || !Number.isFinite(row.acceptedAt.getTime()) || row.acceptedAt > now || !row.acceptedParentId || !parentMap.has(row.acceptedParentId))) throw inconsistent();
      const activated = new Set(accepted.filter((row) => row.acceptedParentId !== null && row.acceptedBy === row.acceptedParentId).map((row) => row.acceptedParentId!));
      const byStudent = new Map<string, EngagementGuardian[]>();
      const add = (studentId: string, parentId: string, relationship?: typeof relationships[number]) => {
        const parent = parentMap.get(parentId);
        if (!parent || !studentIds.has(studentId)) throw inconsistent();
        const row: EngagementGuardian = { parentId, parentSchoolId: parent.schoolId, studentId, studentSchoolId: schoolId, studentStatus: "ACTIVE", hasRelationshipRows: parent._count.studentRelationships > 0, relationshipStatus: relationship?.status, legacyParentMatches: !relationship, canViewFees: relationship ? relationship.canViewFees : true, canViewReports: relationship ? relationship.canViewReports : true, canMessageSchool: relationship ? relationship.canMessageSchool : true, email: parent.email, phone: parent.phone, portalState: activated.has(parent.id) ? "ACTIVE" : "UNAVAILABLE" };
        const rows = byStudent.get(studentId) ?? [];
        rows.push(row);
        byStudent.set(studentId, rows);
      };
      for (const row of relationships) {
        if (row.schoolId !== schoolId) throw inconsistent();
        add(row.studentId, row.parentId, row);
      }
      for (const student of students) {
        if (student.parentId && !(byStudent.get(student.id) ?? []).some((row) => row.parentId === student.parentId)) {
          const parent = parentMap.get(student.parentId);
          if (!parent) throw inconsistent();
          if (parent._count.studentRelationships === 0) add(student.id, parent.id);
        }
      }
      const eligibleParents = new Set<string>();
      const eligibleRequestPairs = new Map<string, Set<string>>();
      const contacts: ContactTotals = { missingEmails: 0, invalidEmails: 0, missingPhones: 0, invalidPhones: 0, parentsWithoutExternalContact: 0, studentsWithoutActiveGuardian: 0, studentsWithoutExternalContact: 0, studentsWithRecordedActivation: 0, studentsWithUnknownActivation: 0, portalAccessVerified: false };
      for (const student of students) {
        const guardians = byStudent.get(student.id) ?? [];
        const position = studentParentContactPosition(schoolId, student.id, guardians);
        contacts.studentsWithoutActiveGuardian += Number(position.noActiveGuardian === true);
        contacts.studentsWithoutExternalContact += Number(position.noExternalContact === true);
        contacts.studentsWithRecordedActivation += Number(position.portalState === "AVAILABLE");
        contacts.studentsWithUnknownActivation += Number(position.portalState === "UNAVAILABLE");
        for (const guardian of guardians) {
          if (!eligibleEngagementGuardian(schoolId, student.id, guardian)) continue;
          eligibleParents.add(guardian.parentId);
          const ids = eligibleRequestPairs.get(student.id) ?? new Set<string>();
          ids.add(guardian.parentId);
          eligibleRequestPairs.set(student.id, ids);
        }
      }
      const preferences = { weeklyOptOut: 0, emailOptOut: 0, schoolEmailEnabled: setting && appSetting ? setting.emailEnabled && appSetting.emailEnabled && appSetting.sendParentSummariesByEmail : null };
      const appPreferences = await db.appNotificationPreference.findMany({ where: { schoolId, recipientType: "PARENT", recipientId: { in: [...eligibleParents] } }, select: { schoolId: true, recipientType: true, recipientId: true, emailEnabled: true, smsEnabled: true, whatsappEnabled: true } });
      const appPreferenceMap = new Map(appPreferences.map((row) => [row.recipientId, row]));
      if (appPreferenceMap.size !== appPreferences.length || appPreferences.some((row) => row.schoolId !== schoolId || row.recipientType !== "PARENT" || typeof row.emailEnabled !== "boolean" || !eligibleParents.has(row.recipientId))) throw inconsistent();
      for (const id of eligibleParents) {
        const parent = parentMap.get(id)!;
        const contact = parentContactPosition(parent);
        if (contact.state !== "AVAILABLE") throw inconsistent();
        contacts.missingEmails += Number(contact.missingEmail);
        contacts.invalidEmails += Number(contact.invalidEmail);
        contacts.missingPhones += Number(contact.missingPhone);
        contacts.invalidPhones += Number(contact.invalidPhone);
        contacts.parentsWithoutExternalContact += Number(contact.noExternalContact);
        preferences.weeklyOptOut += Number(parent.notificationPreference?.weeklySummaryEnabled === false);
        preferences.emailOptOut += Number(parent.notificationPreference?.emailEnabled === false || appPreferenceMap.get(id)?.emailEnabled === false);
      }
      const requests = { awaitingResponse: 0, overdue: 0, highPriority: 0, escalated: 0, missingDeadlines: 0, unavailable: 0 };
      const requestRows = await db.parentTeacherContactRequest.findMany({ where: { schoolId, status: { notIn: ["CLOSED", "CANCELLED"] }, student: { schoolId, status: "ACTIVE" }, parent: { schoolId }, teacher: { schoolId } }, select: { parentId: true, studentId: true, status: true, priority: true, lastParentMessageAt: true, lastTeacherResponseAt: true, respondedAt: true, responseDueAt: true } });
      if (requestRows.length !== requestCount) throw inconsistent();
      for (const row of requestRows) {
        if (!eligibleRequestPairs.get(row.studentId)?.has(row.parentId)) continue;
        const position = parentResponsePosition(row, now);
        if (position.state === "UNAVAILABLE") { requests.unavailable++; continue; }
        requests.awaitingResponse += Number(position.awaitingResponse);
        requests.overdue += Number(position.overdue);
        requests.highPriority += Number(position.highPriority);
        requests.escalated += Number(position.escalated);
        requests.missingDeadlines += Number(position.awaitingResponse && !position.deadlineConfigured);
      }
      const schedule = parentWeeklySchedule(setting, now);
      const channelRoutes = Object.fromEntries((["EMAIL", "SMS", "WHATSAPP"] as const).map((channel) => {
        const field = channel === "EMAIL" ? "emailEnabled" : channel === "SMS" ? "smsEnabled" : "whatsappEnabled";
        const summaryField = channel === "EMAIL" ? "sendParentSummariesByEmail" : channel === "SMS" ? "sendParentSummariesBySms" : "sendParentSummariesByWhatsapp";
        const providerState = notificationProviderAvailability(channel);
        return [channel, countParentSummaryRoutes([...eligibleParents].map((id) => {
          const parent = parentMap.get(id)!;
          const contact = parentContactPosition(parent);
          const preference = appPreferenceMap.get(id);
          const schoolFlags = [setting?.[field], appSetting?.[field], appSetting?.[summaryField]];
          const parentFlag = parent.notificationPreference ? parent.notificationPreference[field] : true;
          const appFlag = preference ? preference[field] : channel === "EMAIL";
          return { weeklyEnabled: schedule.state === "SETUP_REQUIRED" ? undefined : schedule.state === "AVAILABLE", parentWeeklyEnabled: parent.notificationPreference?.weeklySummaryEnabled ?? true, schoolChannelEnabled: schoolFlags.every((flag) => typeof flag === "boolean") ? schoolFlags.every(Boolean) : undefined, parentChannelEnabled: typeof parentFlag === "boolean" && typeof appFlag === "boolean" ? parentFlag && appFlag : undefined, destinationUsable: channel === "EMAIL" ? contact.usableEmail : contact.usablePhone, providerState };
        }))];
      }));
      let summaries: ReturnType<typeof countWeeklyParentSummaryStates> | null = null;
      if (schedule.state === "AVAILABLE" && schedule.period) {
        const sourceKeys = [...eligibleParents].map((id) => `weekly-summary:${id}:${schedule.period!.rangeKey}`);
        const where = { schoolId, parent: { schoolId }, parentId: { in: [...eligibleParents] }, sourceModel: "ParentWeeklySummary", sourceKey: { in: sourceKeys } };
        const summaryCount = await db.parentNotification.count({ where });
        if (summaryCount > budgets.summaries) return empty("EVALUATION_LIMIT");
        const records = await db.parentNotification.findMany({ where, select: { id: true, schoolId: true, parentId: true, sourceModel: true, sourceKey: true } });
        if (records.length !== summaryCount || records.some((row) => row.schoolId !== schoolId || !eligibleParents.has(row.parentId) || row.sourceModel !== "ParentWeeklySummary" || row.sourceKey !== `weekly-summary:${row.parentId}:${schedule.period!.rangeKey}`)) throw inconsistent();
        const centralWhere = { schoolId, recipientType: "PARENT" as const, recipientId: { in: [...eligibleParents] }, sourceModel: "ParentNotification", sourceId: { in: records.map((row) => row.id) } };
        const notificationCount = await db.appNotification.count({ where: centralWhere });
        const deliveryCount = await db.appNotificationDelivery.count({ where: { schoolId, channel: "EMAIL", notification: centralWhere } });
        if (notificationCount > budgets.notifications || deliveryCount > budgets.deliveries) return empty("EVALUATION_LIMIT");
        const notifications = await db.appNotification.findMany({ where: centralWhere, select: { schoolId: true, sourceId: true, recipientId: true, deliveries: { where: { schoolId, channel: "EMAIL" }, select: { id: true, schoolId: true, channel: true, status: true, provider: true, updatedAt: true, sentAt: true, deliveredAt: true, providerMessageId: true } } } });
        if (notifications.length !== notificationCount || notifications.reduce((sum, row) => sum + row.deliveries.length, 0) !== deliveryCount) throw inconsistent();
        const recordMap = new Map(records.map((row) => [row.id, row]));
        if (recordMap.size !== records.length) throw inconsistent();
        const deliveries = new Map<string, typeof notifications[number]["deliveries"]>();
        for (const notification of notifications) {
          const record = notification.sourceId ? recordMap.get(notification.sourceId) : null;
          if (!record || notification.schoolId !== schoolId || notification.recipientId !== record.parentId || notification.deliveries.some((row) => row.schoolId !== schoolId || row.channel !== "EMAIL")) throw inconsistent();
          const rows = deliveries.get(record.id) ?? [];
          rows.push(...notification.deliveries);
          deliveries.set(record.id, rows);
        }
        summaries = countWeeklyParentSummaryStates({ schoolId, rangeKey: schedule.period.rangeKey, eligibleParentIds: eligibleParents, now, summaries: records.map((row) => ({ ...row, centralTracked: deliveries.has(row.id), deliveries: deliveries.get(row.id) ?? [] })) });
      }
      return { state: "AVAILABLE" as const, code: "EVALUATED", evaluatedAt: now.toISOString(), schedule, newMessagingState: parentMessagingPosition(policy), summaryTrackingState: schedule.state === "AVAILABLE" && summaries?.unavailable ? "UNAVAILABLE" : schedule.state, requestsTrackingState: requests.unavailable ? "UNAVAILABLE" : "AVAILABLE", deliverySettingsState: setting && appSetting ? "AVAILABLE" : "SETUP_REQUIRED", cohort: { students: students.length, parents: eligibleParents.size }, summaries, requests, contacts, preferences, channelRoutes };
    }, { isolationLevel: "RepeatableRead", maxWait: 15000, timeout: 30000 });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "PARENT_ENGAGEMENT_INCONSISTENT") return empty("EVIDENCE_INCONSISTENT");
    if (knownDatabaseErrors.has(code)) return empty("DATABASE_UNAVAILABLE");
    throw error;
  }
}
