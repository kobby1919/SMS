import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const nodeRequire = createRequire(import.meta.url);
function load(path) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", code)((id) => { if (!id.startsWith("@/")) return nodeRequire(id); const file = id.slice(2); return load(existsSync(file) ? file : `${file}.ts`); }, loaded, loaded.exports);
  return loaded.exports;
}
const rules = load("src/lib/parent-engagement-rules.ts");
const schedule = { timezone: "Africa/Accra", summaryCadence: "WEEKLY", weeklySummarySendDay: "FRIDAY", weeklySummarySendTime: "15:15" };
const now = new Date("2026-10-16T16:00:00Z");
test("weekly dashboard uses latest due period, not this week's not-yet-due summaries", () => {
  const before = rules.parentWeeklySchedule(schedule, new Date("2026-10-16T15:14:59Z"));
  assert.equal(before.period.rangeKey, "2026-10-05:2026-10-11");
  assert.equal(before.nextSendAt, "2026-10-16T15:15:00.000Z");
  const due = rules.parentWeeklySchedule(schedule, new Date("2026-10-16T15:15:00Z"));
  assert.equal(due.period.rangeKey, "2026-10-12:2026-10-18");
  assert.equal(due.period.endDateExclusive, "2026-10-19");
  assert.equal(due.nextSendAt, "2026-10-23T15:15:00.000Z");
});
test("schedule is school-local across UTC/year boundaries and invalid setup is not a healthy zero", () => {
  const local = rules.parentWeeklySchedule({ ...schedule, timezone: "Asia/Tokyo", weeklySummarySendDay: "MONDAY", weeklySummarySendTime: "00:15" }, new Date("2026-10-11T15:15:00Z"));
  assert.equal(local.period.startDate, "2026-10-12");
  assert.equal(local.period.dueAt, "2026-10-11T15:15:00.000Z");
  assert.equal(rules.parentWeeklySchedule(schedule, new Date("2027-01-01T16:00:00Z")).period.startDate, "2026-12-28");
  for (const config of [null, { ...schedule, timezone: "bad/timezone" }, { ...schedule, weeklySummarySendTime: "25:00" }, { ...schedule, weeklySummarySendDay: "nonsense" }]) assert.equal(rules.parentWeeklySchedule(config, now).state, "SETUP_REQUIRED");
  for (const summaryCadence of ["OFF", "DAILY"]) assert.equal(rules.parentWeeklySchedule({ ...schedule, summaryCadence }, now).state, "DISABLED");
  assert.equal(rules.parentWeeklySchedule({ ...schedule, timezone: "America/New_York", weeklySummarySendDay: "SUNDAY", weeklySummarySendTime: "02:30" }, new Date("2026-03-08T06:00:00Z")).state, "SETUP_REQUIRED");
});
const request = { status: "PENDING", priority: "HIGH", lastParentMessageAt: new Date("2026-10-16T12:00:00Z"), lastTeacherResponseAt: null, respondedAt: null, responseDueAt: new Date("2026-10-16T15:00:00Z") };
test("acknowledging/opening is not a response; an exact deadline is not yet overdue", () => {
  for (const status of ["PENDING", "ACKNOWLEDGED", "RESPONDED"]) {
    const result = rules.parentResponsePosition({ ...request, status }, now);
    assert.equal(result.awaitingResponse, true);
    assert.equal(result.overdue, true);
    assert.equal(result.highPriority, true);
  }
  assert.equal(rules.parentResponsePosition(request, request.responseDueAt).overdue, false);
  assert.equal(rules.parentResponsePosition({ ...request, responseDueAt: null }, now).deadlineConfigured, false);
});
test("a later parent message reopens response need; closed/cancelled requests do not become duties", () => {
  const answered = { ...request, status: "RESPONDED", lastTeacherResponseAt: new Date("2026-10-16T13:00:00Z"), respondedAt: new Date("2026-10-16T13:00:00Z") };
  assert.equal(rules.parentResponsePosition(answered, now).awaitingResponse, false);
  assert.equal(rules.parentResponsePosition({ ...answered, lastParentMessageAt: new Date("2026-10-16T14:00:00Z") }, now).awaitingResponse, true);
  assert.equal(rules.parentResponsePosition({ ...request, status: "ESCALATED" }, now).escalated, true);
  for (const status of ["CLOSED", "CANCELLED"]) assert.equal(rules.parentResponsePosition({ ...request, status }, now).awaitingResponse, false);
  assert.equal(rules.parentResponsePosition({ ...request, lastParentMessageAt: new Date("invalid") }, now).state, "UNAVAILABLE");
  assert.equal(rules.parentResponsePosition({ ...request, lastTeacherResponseAt: new Date("2026-10-17") }, now).state, "UNAVAILABLE");
});
const guardian = { parentId: "p1", parentSchoolId: "school-a", studentId: "s1", studentSchoolId: "school-a", studentStatus: "ACTIVE", hasRelationshipRows: true, relationshipStatus: "ACTIVE", legacyParentMatches: true, canViewFees: true, canViewReports: true, canMessageSchool: true, email: null, phone: null, portalState: "INVITED" };
test("guardian eligibility preserves school, active ward, permissions and revoked legacy safeguards", () => {
  assert.equal(rules.eligibleEngagementGuardian("school-a", "s1", guardian), true);
  for (const change of [{ parentSchoolId: "school-b" }, { studentSchoolId: "school-b" }, { studentId: "s2" }, { studentStatus: "TRANSFERRED" }, { studentStatus: "GRADUATED" }, { studentStatus: "WITHDRAWN" }, { relationshipStatus: "REVOKED" }, { relationshipStatus: "REMOVED" }]) assert.equal(rules.eligibleEngagementGuardian("school-a", "s1", { ...guardian, ...change }), false);
  assert.equal(rules.eligibleEngagementGuardian("school-a", "s1", { ...guardian, canMessageSchool: false }, "messages"), false);
  assert.equal(rules.eligibleEngagementGuardian("school-a", "s1", { ...guardian, hasRelationshipRows: false, relationshipStatus: undefined }), true);
});
test("missing email is not unreachable; another authorised guardian can provide contact and portal access", () => {
  const contact = rules.parentContactPosition({ email: "  ", phone: "024 123 4567" });
  assert.equal(contact.missingEmail, true);
  assert.equal(contact.noExternalContact, false);
  assert.equal(rules.parentContactPosition({ email: "bad-email", phone: "call me" }).noExternalContact, true);
  const data = rules.studentParentContactPosition("school-a", "s1", [guardian, { ...guardian, parentId: "p2", email: "parent@gmail.com", portalState: "ACTIVE" }]);
  assert.equal(data.noExternalContact, false);
  assert.equal(data.portalState, "AVAILABLE");
  assert.equal(data.activeGuardians, 2);
  assert.equal(rules.studentParentContactPosition("school-a", "s1", [{ ...guardian, relationshipStatus: "REVOKED" }]).noActiveGuardian, true);
  assert.equal(rules.studentParentContactPosition("school-a", "s1", [{ ...guardian, portalState: "UNAVAILABLE" }]).portalState, "UNAVAILABLE");
});
test("preferences, disabled channels and missing providers never become delivery failures", () => {
  const input = { weeklyEnabled: true, parentWeeklyEnabled: true, schoolChannelEnabled: true, parentChannelEnabled: true, providerConfigured: true, destinationUsable: true };
  assert.equal(rules.summaryChannelPosition(input), "AVAILABLE");
  for (const key of ["weeklyEnabled", "schoolChannelEnabled"]) assert.equal(rules.summaryChannelPosition({ ...input, [key]: false }), "DISABLED");
  for (const key of ["parentWeeklyEnabled", "parentChannelEnabled"]) assert.equal(rules.summaryChannelPosition({ ...input, [key]: false }), "OPTED_OUT");
  assert.equal(rules.summaryChannelPosition({ ...input, providerConfigured: false }), "NOT_CONFIGURED");
  assert.equal(rules.summaryChannelPosition({ ...input, destinationUsable: false }), "MISSING_CONTACT");
  assert.equal(rules.parentMessagingPosition(null), "SETUP_REQUIRED");
  assert.equal(rules.parentMessagingPosition({ enabled: false, allowParentTeacherMessaging: true }), "DISABLED");
  assert.equal(rules.parentMessagingPosition({ enabled: true, allowParentTeacherMessaging: false }), "DISABLED");
  assert.equal(rules.parentMessagingPosition({ enabled: true, allowParentTeacherMessaging: true }), "AVAILABLE");
});
const delivery = (status, extra = {}) => ({ id: "d1", channel: "EMAIL", status, updatedAt: new Date("2026-10-16T15:30:00Z"), sentAt: null, deliveredAt: null, providerMessageId: null, ...extra });

test("route reasons distinguish opt-outs, disabled, unsupported and missing configuration", () => {
  const base = { weeklyEnabled: true, parentWeeklyEnabled: true, schoolChannelEnabled: true, parentChannelEnabled: true, destinationUsable: true, providerState: "AVAILABLE" };
  assert.equal(rules.parentSummaryRoutePosition(base), "AVAILABLE");
  for (const providerState of ["UNSUPPORTED", "NOT_CONFIGURED", "SIMULATED"]) assert.equal(rules.parentSummaryRoutePosition({ ...base, providerState }), providerState);
  assert.equal(rules.parentSummaryRoutePosition({ ...base, parentChannelEnabled: false, providerState: "UNSUPPORTED" }), "OPTED_OUT");
  assert.equal(rules.parentSummaryRoutePosition({ ...base, schoolChannelEnabled: false }), "DISABLED");
  assert.equal(rules.parentSummaryRoutePosition({ ...base, destinationUsable: false }), "MISSING_CONTACT");
  assert.equal(rules.parentSummaryRoutePosition({ ...base, schoolChannelEnabled: undefined }), "UNAVAILABLE");
  assert.deepEqual(rules.countParentSummaryRoutes([base, { ...base, parentWeeklyEnabled: false }]), { available: 1, optedOut: 1, disabled: 0, notConfigured: 0, unsupported: 0, simulated: 0, missingContact: 0, unavailable: 0 });
});

test("console provider and legacy console IDs never establish a real delivery", () => {
  const row = delivery("DELIVERED", { providerMessageId: "console:job", deliveredAt: new Date("2026-10-16T15:25:00Z") });
  assert.equal(rules.emailDeliveryPosition([row], now), "SIMULATED");
  assert.equal(rules.emailDeliveryPosition([{ ...row, provider: "console", providerMessageId: "local-test" }], now), "SIMULATED");
  assert.equal(rules.emailDeliveryPosition([row, { ...row, id: "real", provider: "resend", providerMessageId: "real-id" }], now), "UNAVAILABLE");
});
test("email state needs evidence and latest failure/retry cannot be hidden by an old sent status", () => {
  const sent = delivery("SENT", { sentAt: new Date("2026-10-16T15:20:00Z"), providerMessageId: "provider-id" });
  assert.equal(rules.emailDeliveryPosition([sent], now), "SENT");
  assert.equal(rules.emailDeliveryPosition([{ ...sent, providerMessageId: null }], now), "UNAVAILABLE");
  assert.equal(rules.emailDeliveryPosition([delivery("DELIVERED")], now), "UNAVAILABLE");
  assert.equal(rules.emailDeliveryPosition([delivery("SENT")], now), "UNAVAILABLE");
  const confirmed = delivery("DELIVERED", { providerMessageId: "provider-id", deliveredAt: new Date("2026-10-16T15:25:00Z") });
  assert.equal(rules.emailDeliveryPosition([confirmed], now), "DELIVERED");
  assert.equal(rules.emailDeliveryPosition([sent, delivery("FAILED", { id: "d2", updatedAt: new Date("2026-10-16T15:40:00Z") })], now), "FAILED");
  assert.equal(rules.emailDeliveryPosition([delivery("RETRYING")], now), "RETRYING");
  assert.equal(rules.emailDeliveryPosition([], now), "NOT_QUEUED");
  assert.equal(rules.emailDeliveryPosition([sent, delivery("FAILED", { id: "d2" })], now), "UNAVAILABLE");
});
test("weekly counts deduplicate parent summaries and exclude foreign, ineligible and other-period rows", () => {
  const base = { id: "n1", schoolId: "school-a", parentId: "p1", sourceModel: "ParentWeeklySummary", sourceKey: "weekly-summary:p1:2026-10-12:2026-10-18", deliveries: [delivery("RETRYING")] };
  const input = { schoolId: "school-a", rangeKey: "2026-10-12:2026-10-18", eligibleParentIds: new Set(["p1"]), now, summaries: [base, base, { ...base, schoolId: "school-b" }, { ...base, parentId: "p2" }, { ...base, sourceModel: "ParentDailySummary" }, { ...base, sourceKey: "weekly-summary:p1:2026-10-05:2026-10-11" }] };
  const result = rules.countWeeklyParentSummaryStates(input);
  assert.equal(result.summariesAvailable, 1);
  assert.equal(result.queuedOrRetrying, 1);
  assert.equal(result.sent, 0);
  assert.equal(result.failed, 0);
  assert.throws(() => rules.countWeeklyParentSummaryStates({ ...input, summaries: [base, { ...base, id: "different" }] }), /Conflicting/);
  const newest = { ...base, deliveries: [delivery("FAILED", { updatedAt: new Date("2026-10-16T15:40:00Z") })] };
  for (const summaries of [[base, newest], [newest, base]]) {
    const merged = rules.countWeeklyParentSummaryStates({ ...input, summaries });
    assert.equal(merged.summariesAvailable, 1);
    assert.equal(merged.failed, 1);
    assert.equal(merged.queuedOrRetrying, 0);
  }
});

test("ambiguous daylight-saving send times require setup instead of guessing a due instant", () => {
  assert.equal(rules.parentWeeklySchedule({ ...schedule, timezone: "America/New_York", weeklySummarySendDay: "SUNDAY", weeklySummarySendTime: "01:30" }, new Date("2026-11-01T04:00:00Z")).state, "SETUP_REQUIRED");
});
test("malformed contacts and string booleans cannot become usable contact or enabled delivery", () => {
  assert.equal(rules.parentContactPosition({ email: 123, phone: null }).state, "UNAVAILABLE");
  assert.equal(rules.parentContactPosition({ email: null }).noExternalContact, null);
  assert.equal(rules.summaryChannelPosition({ weeklyEnabled: "false", parentWeeklyEnabled: true, schoolChannelEnabled: true, parentChannelEnabled: true, providerConfigured: true, destinationUsable: true }), "UNAVAILABLE");
  assert.equal(rules.eligibleEngagementGuardian("school-a", "s1", { ...guardian, hasRelationshipRows: "false" }), false);
  assert.equal(rules.eligibleEngagementGuardian("school-a", "s1", { ...guardian, hasRelationshipRows: false, relationshipStatus: "REVOKED" }), false);
});
test("contradictory duplicate guardian rows cannot overwrite revoked access or contact data", () => {
  for (const change of [{ relationshipStatus: "REVOKED" }, { email: "different@gmail.com" }, { portalState: "ACTIVE" }]) for (const rows of [[guardian, { ...guardian, ...change }], [{ ...guardian, ...change }, guardian]]) {
    assert.throws(() => rules.studentParentContactPosition("school-a", "s1", rows), (error) => error.code === "PARENT_ENGAGEMENT_INCONSISTENT");
  }
  assert.equal(rules.studentParentContactPosition("school-a", "s1", [guardian, guardian]).activeGuardians, 1);
  assert.equal(rules.studentParentContactPosition("school-a", "s1", [], "TRANSFERRED").noActiveGuardian, null);
  assert.throws(() => rules.studentParentContactPosition("school-a", "s1", [{ ...guardian, studentStatus: "WITHDRAWN" }]), /disagree/);
});
test("all tied delivery evidence must be valid; unrelated SMS records do not corrupt email counts", () => {
  const valid = delivery("DELIVERED", { providerMessageId: "provider-id", deliveredAt: new Date("2026-10-16T15:25:00Z") });
  const missingProof = { ...valid, providerMessageId: null };
  for (const rows of [[valid, missingProof], [missingProof, valid]]) assert.equal(rules.emailDeliveryPosition(rows, now), "UNAVAILABLE");
  assert.equal(rules.emailDeliveryPosition([valid, delivery("FAILED", { channel: "SMS", updatedAt: new Date("invalid") })], now), "DELIVERED");
});
test("bad summary period or blank scope cannot silently produce healthy zero counts", () => {
  const input = { schoolId: "school-a", rangeKey: "2026-10-12:2026-10-18", eligibleParentIds: new Set(), summaries: [], now };
  for (const change of [{ schoolId: " " }, { rangeKey: "wrong" }, { rangeKey: "2026-02-30:2026-03-08" }, { rangeKey: "2026-10-13:2026-10-19" }, { rangeKey: "2026-10-12:2026-10-20" }, { now: new Date("invalid") }]) assert.throws(() => rules.countWeeklyParentSummaryStates({ ...input, ...change }), (error) => error.code === "PARENT_ENGAGEMENT_INCONSISTENT");
});
