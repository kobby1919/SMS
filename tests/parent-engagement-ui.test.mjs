import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const nodeRequire = createRequire(import.meta.url);
function load(path) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)((id) => id === "next/link" ? { __esModule: true, default: ({ children, prefetch, ...props }) => { void prefetch; return React.createElement("a", props, children); } } : nodeRequire(id), loaded, loaded.exports);
  return loaded.exports;
}
const component = load("src/components/AdminParentEngagement.tsx").default;
const { prioritiseParentEngagementIssues } = load("src/lib/services/parent-engagement-attention.ts");
const render = (snapshot) => renderToStaticMarkup(React.createElement(component, { snapshot }));
export function parentEngagementFixture() {
  return { state: "AVAILABLE", summaryTrackingState: "AVAILABLE", requestsTrackingState: "AVAILABLE", newMessagingState: "AVAILABLE", schedule: { state: "AVAILABLE", period: { startDate: "2026-10-12", rangeKey: "2026-10-12:2026-10-18" }, nextSendAt: "2026-10-23T15:15:00Z" }, cohort: { students: 500, parents: 300 }, summaries: { summariesAvailable: 240, queuedOrRetrying: 12, sent: 60, delivered: 165, failed: 3, notQueued: 0, cancelled: 0, simulated: 0 }, requests: { awaitingResponse: 8, overdue: 3, highPriority: 2, escalated: 1, missingDeadlines: 0 }, contacts: { missingEmails: 3, missingPhones: 5, studentsWithoutExternalContact: 2, studentsWithoutActiveGuardian: 4, studentsNeedingPortalSetup: 3, invalidEmails: 1, invalidPhones: 0, studentsWithUnknownActivation: 2 }, channelRoutes: { EMAIL: { optedOut: 4, disabled: 0, unsupported: 0, notConfigured: 0, simulated: 0 } }, attention: prioritiseParentEngagementIssues(Array.from({ length: 7 }, (_, i) => ({ key: `request:${i}`, title: "High-priority parent request overdue", detail: `Student ${i} with a deliberately long school name and guardian relationship needing careful follow-up`, action: "Review request", href: `/admin/communications?requestId=request-${i}`, rank: i, sortAt: i }))) };
}

test("parent section renders three lanes and at most five one-action issues", () => {
  const html = render(parentEngagementFixture());
  for (const label of ["Parent Updates", "Requests Needing Response", "Parent Contact Readiness", "font-nunito", "queued / retrying", "Provider-confirmed", "5 of 7 issues"]) assert.ok(html.includes(label));
  assert.equal((html.match(/<li /g) ?? []).length, 5);
  assert.equal((html.match(/<a /g) ?? []).length, 5);
  assert.equal(html.includes("unread"), false);
  assert.ok(html.includes("does not mean the update was read"));
});

test("unavailable and disabled lanes do not invent healthy zeroes", () => {
  const data = parentEngagementFixture();
  Object.assign(data, { state: "UNAVAILABLE", summaryTrackingState: "UNAVAILABLE", requestsTrackingState: "UNAVAILABLE", summaries: null, requests: null, contacts: null, attention: null, channelRoutes: null, schedule: null });
  const html = render(data);
  assert.ok(html.includes("no totals can be confirmed"));
  assert.ok(html.includes("cannot be evaluated"));
  assert.equal((html.match(/<dd /g) ?? []).length, 0);
  data.state = "AVAILABLE"; data.summaryTrackingState = "DISABLED"; data.newMessagingState = "DISABLED";
  assert.ok(render(data).includes("Weekly summaries are switched off"));
  assert.ok(render(data).includes("Existing requests still need follow-up"));
});

test("empty state and missing portal evidence never become false all-clear or inactive claims", () => {
  const data = parentEngagementFixture();
  data.attention = { rows: [], total: 0 }; data.cohort.students = 0; data.summaries.summariesAvailable = 0;
  const html = render(data);
  assert.ok(html.includes("No active students"));
  assert.ok(html.includes("No summaries recorded"));
  assert.ok(html.includes("Live portal access is not verified"));
  assert.equal(html.includes("parents inactive"), false);
});

test("priority is stable, deduplicated and capped without operational actions", () => {
  const base = { key: "a", title: "Follow-up", detail: "Needs review", action: "Review request", href: "/admin/communications?requestId=a", rank: 2, sortAt: 10 };
  const data = [base, { ...base, key: "b", rank: 0 }, base];
  const result = prioritiseParentEngagementIssues(data);
  assert.equal(result.total, 2);
  assert.equal(result.rows[0].key, "b");
  assert.equal(Object.hasOwn(result.rows[0], "rank"), false);
});

test("calendar mismatch does not promise an unverified scheduled send date", () => {
  const data = parentEngagementFixture();
  data.summaryCalendarState = "CALENDAR_MISMATCH";
  data.summaryTrackingState = "UNAVAILABLE";
  data.summaries = null;
  const html = render(data);
  assert.ok(html.includes("summary calendar needs review"));
  assert.equal(html.includes("Next weekly summary due"), false);
});

test("untrusted student names are escaped and never become dashboard markup", () => {
  const data = parentEngagementFixture();
  data.attention.rows[0].detail = '<script>alert("name")</script>';
  const html = render(data);
  assert.equal(html.includes("<script>"), false);
  assert.ok(html.includes("&lt;script&gt;"));
});

test("attention destinations are exact guarded routes with a real guardian anchor", () => {
  const communications = readFileSync("src/app/(dashboard)/admin/communications/page.tsx", "utf8");
  assert.match(communications, /requirePageSession\(\["admin"\]\)/);
  assert.match(communications, /requestId \? \{ id: requestId \}/);
  assert.match(communications, /parentResponsePosition\(request, now\)/);
  assert.match(communications, /responseDueAt: \{ lt: now, gte:/);
  assert.match(readFileSync("src/app/(dashboard)/list/students/[id]/page.tsx", "utf8"), /id="guardian-links"/);
  const source = readFileSync("src/lib/services/admin-parent-engagement.ts", "utf8");
  assert.match(source, /new URLSearchParams\(\{ deliveryId: latest.id \}\)/);
  assert.match(source, /new URLSearchParams\(\{ requestId: row.id \}\)/);
  assert.match(readFileSync("src/app/(dashboard)/admin/page.tsx", "utf8"), /getAdminParentEngagementSnapshot\(\)/);
});
