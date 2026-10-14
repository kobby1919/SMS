import "server-only";
import prisma from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/authz";
import { countWeeklyParentSummaryStates, eligibleEngagementGuardian, parentContactPosition, parentMessagingPosition, parentResponsePosition, parentWeeklySchedule, studentParentContactPosition, type EngagementGuardian } from "@/src/lib/parent-engagement-rules";

const budgets = { students: 5000, parents: 6000, relationships: 20000, invites: 12000, requests: 10000, summaries: 6000, notifications: 12000, deliveries: 24000 };
const inconsistent = () => Object.assign(new Error("Parent engagement evidence requires review."), { code: "PARENT_ENGAGEMENT_INCONSISTENT" });
const knownDatabaseErrors = new Set(["P1001", "P1002", "P1017", "P2024", "P2028", "P2034"]);

/** No caller-provided tenant, sending, preference writes or provider network calls. */
export async function getAdminParentEngagementSnapshot() {
  const { schoolId } = await requireRole(["admin"]);
  if (!schoolId?.trim()) throw new Error("An authenticated school scope is required.");
  const empty = (code: string) => ({ state: "UNAVAILABLE" as const, code, evaluatedAt: new Date().toISOString(), schedule: null as ReturnType<typeof parentWeeklySchedule> | null, newMessagingState: "UNAVAILABLE" as string, deliverySettingsState: "UNAVAILABLE" as string, cohort: null as { students: number; parents: number } | null, summaries: null as ReturnType<typeof countWeeklyParentSummaryStates> | null, requests: null as { awaitingResponse: number; overdue: number; highPriority: number; escalated: number; missingDeadlines: number; unavailable: number } | null, contacts: null as { missingEmails: number; invalidEmails: number; missingPhones: number; invalidPhones: number; parentsWithoutExternalContact: number; studentsWithoutActiveGuardian: number; studentsWithoutExternalContact: number; studentsWithoutActivatedPortal: number; studentsWithUnknownPortal: number } | null, preferences: null as { weeklyOptOut: number; emailOptOut: number; schoolEmailEnabled: boolean | null } | null });
  try {
    return await prisma.$transaction(async (db) => {
      const now = new Date();
      const [setting, appSetting, policy, studentCount, parentCount, relationshipCount, requestCount] = await Promise.all([
        db.schoolNotificationSetting.findUnique({ where: { schoolId } }),
        db.appNotificationSetting.findUnique({ where: { schoolId }, select: { emailEnabled: true, sendParentSummariesByEmail: true } }),
        db.schoolCommunicationPolicy.findUnique({ where: { schoolId }, select: { enabled: true, allowParentTeacherMessaging: true } }),
        db.student.count({ where: { schoolId, status: "ACTIVE" } }),
        db.parent.count({ where: { schoolId } }),
        db.parentStudentRelationship.count({ where: { schoolId, student: { schoolId, status: "ACTIVE" } } }),
        db.parentTeacherContactRequest.count({ where: { schoolId, status: { notIn: ["CLOSED", "CANCELLED"] }, student: { schoolId, status: "ACTIVE" }, parent: { schoolId }, teacher: { schoolId } } }),
      ]);
      if (studentCount > budgets.students || parentCount > budgets.parents || relationshipCount > budgets.relationships || requestCount > budgets.requests) return empty("EVALUATION_LIMIT");
      const [students, parents, relationships] = await Promise.all([
        db.student.findMany({ where: { schoolId, status: "ACTIVE", class: { schoolId } }, select: { id: true, parentId: true }, orderBy: { id: "asc" } }),
        db.parent.findMany({ where: { schoolId }, select: { id: true, schoolId: true, email: true, phone: true, notificationPreference: true, _count: { select: { studentRelationships: { where: { schoolId } } } } } }),
        db.parentStudentRelationship.findMany({ where: { schoolId, student: { schoolId, status: "ACTIVE" } }, select: { schoolId: true, parentId: true, studentId: true, status: true, canViewFees: true, canViewReports: true, canMessageSchool: true } }),
      ]);
      if (students.length !== studentCount || parents.length !== parentCount || relationships.length !== relationshipCount) throw inconsistent();
      const parentMap = new Map(parents.map((row) => [row.id, row]));
      const studentIds = new Set(students.map((row) => row.id));
      if (parentMap.size !== parents.length || studentIds.size !== students.length || parents.some((row) => row.schoolId !== schoolId || row.notificationPreference && row.notificationPreference.schoolId !== schoolId)) throw inconsistent();
      const inviteWhere = { schoolId, status: "ACCEPTED" as const, acceptedAt: { not: null, lte: now }, acceptedParentId: { in: parents.map((row) => row.id) } };
      const inviteCount = await db.parentInvite.count({ where: inviteWhere });
      if (inviteCount > budgets.invites) return empty("EVALUATION_LIMIT");
      const accepted = await db.parentInvite.findMany({ where: inviteWhere, select: { acceptedParentId: true, acceptedBy: true } });
      if (accepted.length !== inviteCount) throw inconsistent();
      const activated = new Set(accepted.filter((row) => row.acceptedParentId !== null && row.acceptedBy === row.acceptedParentId).map((row) => row.acceptedParentId!));
      const byStudent = new Map<string, EngagementGuardian[]>();
      const add = (studentId: string, parentId: string, relationship?: typeof relationships[number]) => {
        const parent = parentMap.get(parentId);
        if (!parent || !studentIds.has(studentId)) throw inconsistent();
        const row: EngagementGuardian = { parentId, parentSchoolId: parent.schoolId, studentId, studentSchoolId: schoolId, studentStatus: "ACTIVE", hasRelationshipRows: parent._count.studentRelationships > 0, relationshipStatus: relationship?.status, legacyParentMatches: !relationship, canViewFees: relationship?.canViewFees ?? true, canViewReports: relationship?.canViewReports ?? true, canMessageSchool: relationship?.canMessageSchool ?? true, email: parent.email, phone: parent.phone, portalState: activated.has(parent.id) ? "ACTIVE" : "UNAVAILABLE" };
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
      const permittedRequests = new Set<string>();
      const contacts = { missingEmails: 0, invalidEmails: 0, missingPhones: 0, invalidPhones: 0, parentsWithoutExternalContact: 0, studentsWithoutActiveGuardian: 0, studentsWithoutExternalContact: 0, studentsWithoutActivatedPortal: 0, studentsWithUnknownPortal: 0 };
      for (const student of students) {
        const guardians = byStudent.get(student.id) ?? [];
        const position = studentParentContactPosition(schoolId, student.id, guardians);
        contacts.studentsWithoutActiveGuardian += Number(position.noActiveGuardian === true);
        contacts.studentsWithoutExternalContact += Number(position.noExternalContact === true);
        contacts.studentsWithoutActivatedPortal += Number(position.portalState === "NOT_ACTIVATED");
        contacts.studentsWithUnknownPortal += Number(position.portalState === "UNAVAILABLE");
        for (const guardian of guardians) {
          if (eligibleEngagementGuardian(schoolId, student.id, guardian)) eligibleParents.add(guardian.parentId);
          if (eligibleEngagementGuardian(schoolId, student.id, guardian, "messages")) permittedRequests.add(`${student.id}:${guardian.parentId}`);
        }
      }
      const preferences = { weeklyOptOut: 0, emailOptOut: 0, schoolEmailEnabled: setting && appSetting ? setting.emailEnabled && appSetting.emailEnabled && appSetting.sendParentSummariesByEmail : null };
      const appPreferences = await db.appNotificationPreference.findMany({ where: { schoolId, recipientType: "PARENT", recipientId: { in: [...eligibleParents] } }, select: { schoolId: true, recipientId: true, emailEnabled: true } });
      const appPreferenceMap = new Map(appPreferences.map((row) => [row.recipientId, row]));
      if (appPreferenceMap.size !== appPreferences.length || appPreferences.some((row) => row.schoolId !== schoolId || !eligibleParents.has(row.recipientId))) throw inconsistent();
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
        if (!permittedRequests.has(`${row.studentId}:${row.parentId}`)) continue;
        const position = parentResponsePosition(row, now);
        if (position.state === "UNAVAILABLE") { requests.unavailable++; continue; }
        requests.awaitingResponse += Number(position.awaitingResponse);
        requests.overdue += Number(position.overdue);
        requests.highPriority += Number(position.highPriority);
        requests.escalated += Number(position.escalated);
        requests.missingDeadlines += Number(position.awaitingResponse && !position.deadlineConfigured);
      }
      const schedule = parentWeeklySchedule(setting, now);
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
        const notifications = await db.appNotification.findMany({ where: centralWhere, select: { schoolId: true, sourceId: true, recipientId: true, deliveries: { where: { schoolId, channel: "EMAIL" }, select: { id: true, schoolId: true, channel: true, status: true, updatedAt: true, sentAt: true, deliveredAt: true, providerMessageId: true } } } });
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
      return { state: "AVAILABLE" as const, code: "EVALUATED", evaluatedAt: now.toISOString(), schedule, newMessagingState: parentMessagingPosition(policy), deliverySettingsState: setting && appSetting ? "AVAILABLE" : "SETUP_REQUIRED", cohort: { students: students.length, parents: eligibleParents.size }, summaries, requests, contacts, preferences };
    }, { isolationLevel: "RepeatableRead", maxWait: 15000, timeout: 30000 });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "PARENT_ENGAGEMENT_INCONSISTENT") return empty("EVIDENCE_INCONSISTENT");
    if (knownDatabaseErrors.has(code)) return empty("DATABASE_UNAVAILABLE");
    throw error;
  }
}
