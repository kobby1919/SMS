import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";

const nativeRequire = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)((id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith("@/")) return load(existsSync(id.slice(2)) ? id.slice(2) : `${id.slice(2)}.ts`, mocks);
    return nativeRequire(id);
  }, loaded, loaded.exports);
  return loaded.exports;
}

function communicationFixture({ denied = false, missing = false } = {}) {
  const calls = [];
  const row = { id: "request-1", status: "RESPONDED", priority: "HIGH", category: "ACADEMIC", preferredChannel: "IN_APP", subject: "Schoolwork", message: "Please follow up", student: { name: "Student", surname: "One", class: { name: "P6" } }, parent: { name: "Parent", surname: "One" }, teacher: { name: "Teacher", surname: "One" }, messages: [], lastParentMessageAt: new Date("2020-01-03"), lastTeacherResponseAt: new Date("2020-01-01"), respondedAt: new Date("2020-01-01"), responseDueAt: new Date("2020-01-02") };
  const db = { parentTeacherContactRequest: {
    fields: { lastParentMessageAt: "lastParentMessageAt" },
    count: async (query) => { calls.push(query); return missing || query.where.id?.in ? 0 : 1; },
    findMany: async (query) => { calls.push(query); return missing || query.where.id?.in ? [] : [row]; },
  } };
  const page = load("src/app/(dashboard)/admin/communications/page.tsx", {
    "@/src/lib/authz": { requirePageSession: async (roles) => { assert.deepEqual(roles, ["admin"]); if (denied) throw new Error("Forbidden"); return { schoolId: "school-a" }; } },
    "@/src/lib/prisma": db,
    "@/src/components/AdminContactRequestActions": { __esModule: true, default: () => null },
  }).default;
  return { calls, row, render: async (params = { requestId: "request-1" }) => renderToStaticMarkup(await page({ searchParams: Promise.resolve(params) })) };
}

test("request review agrees with dashboard after a parent reopens the conversation", async () => {
  const f = communicationFixture();
  const html = await f.render();
  assert.ok(html.includes("Awaiting school response"));
  assert.ok(html.includes("Current response deadline needs review"));
  assert.equal(html.includes(">responded<"), false);
  assert.equal(html.includes("Overdue</span>"), false);
  for (const query of f.calls) {
    assert.equal(query.where.schoolId, "school-a");
    assert.equal(query.where.id, "request-1");
    assert.equal(query.where.student.class.schoolId, "school-a");
    assert.equal(query.where.parent.schoolId, "school-a");
    assert.equal(query.where.teacher.schoolId, "school-a");
  }
});

test("future or invalid response evidence is not displayed as a healthy answered request", async () => {
  const f = communicationFixture(); f.row.lastParentMessageAt = new Date("2099-01-01");
  const html = await f.render();
  assert.ok(html.includes("Response tracking unavailable"));
  assert.ok(html.includes("Response deadline cannot be confirmed"));
  assert.equal(html.includes("School response recorded"), false);
});

test("invalid selected request never broadens into every request and stale links are explicit", async () => {
  for (const requestId of ["", " ", "x".repeat(192), ["first", "second"]]) {
    const f = communicationFixture();
    assert.ok((await f.render({ requestId })).includes("This request is unavailable in your school"));
    assert.ok(f.calls.every((query) => query.where.id.in.length === 0));
  }
  assert.ok((await communicationFixture({ missing: true }).render()).includes("This request is unavailable in your school"));
  const denied = communicationFixture({ denied: true });
  await assert.rejects(denied.render(), /Forbidden/);
  assert.equal(denied.calls.length, 0);
});

test("exact delivery review scopes both the notification and its audit history to the school", async () => {
  let selectedQuery;
  const db = {
    appNotification: { count: async () => 0, findMany: async () => [] },
    appNotificationDelivery: { groupBy: async () => [], count: async () => 0, findMany: async () => [], findFirst: async (query) => { selectedQuery = query; return null; } },
  };
  const monitor = load("src/lib/queries/notification-monitor.ts", { "@/src/lib/prisma": db });
  await monitor.getNotificationMonitorData("school-a", { deliveryId: "delivery-123" });
  assert.deepEqual(selectedQuery.where, { id: "delivery-123", schoolId: "school-a", notification: { schoolId: "school-a" } });
  assert.deepEqual(selectedQuery.select.auditLogs.where, { schoolId: "school-a" });
  selectedQuery = undefined;
  await monitor.getNotificationMonitorData("school-a", { deliveryId: ["delivery-123"] });
  assert.equal(selectedQuery, undefined);
});
