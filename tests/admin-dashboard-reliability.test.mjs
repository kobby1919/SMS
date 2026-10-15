import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup, renderToPipeableStream } from "react-dom/server";
import { PassThrough } from "node:stream";

const require = createRequire(import.meta.url);
function loader(mocks = {}) {
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path).exports;
    const module = { exports: {} };
    cache.set(path, module);
    const source = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    new Function("require", "module", "exports", source)((id) => Object.hasOwn(mocks, id) ? mocks[id] : id === "server-only" ? {} : id.startsWith("@/") ? load(`${id.slice(2)}.${existsSync(`${id.slice(2)}.ts`) ? "ts" : "tsx"}`) : require(id), module, module.exports);
    return module.exports;
  }
  return load;
}
class AuthorizationError extends Error {}
const auth = { AuthorizationError };
const nav = { unstable_rethrow(error) { if (error?.digest?.startsWith("NEXT_")) throw error; } };
function readerFixture() {
  const load = loader({ "@/src/lib/authz": auth, "next/navigation": nav });
  return { load, read: load("src/lib/services/admin-dashboard-section.ts").createDashboardReader() };
}
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("a failing section cannot turn successful school data into zeroes or reject its siblings", async (t) => {
  const logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args));
  const { read } = readerFixture();
  const secretError = Object.assign(new Error("email=private@example.test password=secret SQL details"), { code: "P2024" });
  const results = await Promise.all([read("finance", async () => { throw secretError; }), read("parents", async () => ({ parents: 23 }))]);
  assert.deepEqual(results[0], { state: "UNAVAILABLE", reason: "UNAVAILABLE" });
  assert.deepEqual(results[1], { state: "READY", data: { parents: 23 } });
  assert.equal(JSON.stringify(logs).includes("private"), false);
  assert.equal(JSON.stringify(results).includes("password"), false);
  assert.equal(JSON.parse(logs[0][1]).code, "P2024");
});

test("authorization and Next control-flow errors propagate while releasing the read slot", async () => {
  const { read } = readerFixture();
  for (const error of [new AuthorizationError("Forbidden"), { digest: "NEXT_REDIRECT;replace;/sign-in;307;" }, { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }]) {
    await assert.rejects(read("pulse", async () => { throw error; }), (actual) => actual === error);
  }
  assert.equal((await read("finance", async () => 19)).data, 19);
});

test("concurrent heavy reads are limited per request, without blocking a faster sibling", async () => {
  const { read } = readerFixture();
  const slow = deferred(); let started = 0; let active = 0; let peak = 0;
  const run = (work) => async () => { started++; active++; peak = Math.max(peak, active); try { return await work(); } finally { active--; } };
  const first = read("pulse", run(() => slow.promise));
  const fast = read("finance", run(async () => "fast"));
  const third = read("parents", run(async () => "third"));
  assert.equal((await fast).data, "fast");
  assert.equal((await third).data, "third");
  assert.equal(started, 3); assert.equal(peak, 2);
  slow.resolve("slow"); assert.equal((await first).data, "slow");
});

test("all five sections eventually read fresh data even when the first reads exceed ten seconds", async (t) => {
  t.mock.method(console, "warn", () => {});
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { read } = readerFixture(); const gate = deferred(); const queried = []; let settled = false;
  const first = read("pulse", () => gate.promise); const second = read("finance", () => gate.promise);
  let currentRecords = 1;
  const queued = ["accountability", "academics", "parents"].map((section) => read(section, async () => { queried.push(section); return currentRecords; }));
  queued[2].then(() => { settled = true; });
  await Promise.resolve(); t.mock.timers.tick(60000); await flush();
  assert.equal(settled, false); assert.deepEqual(queried, []);
  currentRecords = 25;
  gate.resolve(1); await Promise.all([first, second]);
  assert.deepEqual(await Promise.all(queued), Array.from({ length: 3 }, () => ({ state: "READY", data: 25 })));
  assert.deepEqual(queried, ["accountability", "academics", "parents"]);
});

test("a failed active read releases capacity for both academic and parent sections", async (t) => {
  t.mock.method(console, "error", () => {});
  const { read } = readerFixture(); const gate = deferred();
  const first = read("pulse", async () => { await gate.promise; throw new Error("database timeout"); });
  const second = read("finance", () => gate.promise);
  const academic = read("academics", async () => "academic records");
  const parent = read("parents", async () => "parent records");
  gate.resolve(1);
  assert.equal((await first).state, "UNAVAILABLE"); await second;
  assert.equal((await academic).data, "academic records");
  assert.equal((await parent).data, "parent records");
});

test("readers never share results, queues or failures between school requests", async () => {
  const load = readerFixture().load; const create = load("src/lib/services/admin-dashboard-section.ts").createDashboardReader;
  const a = create(); const b = create(); const gate = deferred();
  const first = a("pulse", () => gate.promise); const second = a("finance", () => gate.promise);
  assert.equal((await b("finance", async () => "school-b")).data, "school-b");
  gate.resolve("school-a"); assert.equal((await first).data, "school-a"); await second;
});

test("oversized or invalid counts fail closed, never clamp or sample totals", async (t) => {
  t.mock.method(console, "error", () => {});
  const { load, read } = readerFixture();
  const budget = load("src/lib/dashboard-read-budget.ts");
  await budget.assertDashboardReadBudget([[Promise.resolve(10), 10]]);
  for (const count of [11, -1, NaN, Infinity, 1.5]) await assert.rejects(budget.assertDashboardReadBudget([[Promise.resolve(count), 10]]), budget.DashboardReadLimitError);
  const result = await read("finance", async () => budget.assertDashboardReadBudget([[Promise.resolve(11), 10]]));
  assert.deepEqual(result, { state: "UNAVAILABLE", reason: "LIMIT" });
  assert.throws(() => budget.assertDashboardWorkBudget(2000001), budget.DashboardReadLimitError);
});

function databaseFixture({ over = false, broken = false, bills = [] } = {}) {
  const calls = []; let inTransaction = false; let transactions = 0;
  const db = new Proxy({}, { get(_, model) { return new Proxy({}, { get(_, method) { return async (query) => {
    assert.ok(inTransaction, "all reads must use the active transaction");
    calls.push({ model, method, query });
    assert.ok(query.where.schoolId === "school-a" || query.where.studentBill?.schoolId === "school-a");
    if (method === "count") return over && model === "studentBill" ? 10001 : 0;
    if (broken) throw new Error("database unavailable");
    if (method === "aggregate") return { _sum: { amount: null }, _count: { _all: 0 } };
    if (method === "findFirst" || method === "findUnique") return null;
    if (model === "studentBill" && method === "findMany") return bills;
    return [];
  }; } }); } });
  const prisma = { $transaction: async (work, options) => { assert.equal(options.isolationLevel, "RepeatableRead"); assert.equal(options.timeout, 30000); transactions++; inTransaction = true; try { return await work(db); } finally { inTransaction = false; } } };
  class Decimal {}
  const load = loader({ "@/src/lib/prisma": prisma, "@/src/generated/prisma": { Prisma: { Decimal } } });
  return { load, calls, run: load("src/lib/services/admin-finance-snapshot.ts").getAdminFinanceSnapshot, transactions: () => transactions };
}

test("finance and its nested receipt and collection helpers share one school-scoped snapshot", async () => {
  const f = databaseFixture(); const data = await f.run("school-a");
  assert.equal(f.transactions(), 1); assert.equal(data.hasFeeRecords, false);
  assert.equal(data.moneyPosition.expectedFees, 0); assert.equal(data.todayActivity.amountCollectedToday, 0);
  assert.ok(f.calls.some((q) => q.model === "dailyCollectionSession" && q.method === "findMany"));
  assert.ok(f.calls.some((q) => q.model === "payment" && q.method === "groupBy"));
});

test("finance budget is checked before expensive rows are loaded and read errors never become empty money", async () => {
  const large = databaseFixture({ over: true }); await assert.rejects(large.run("school-a"), { name: "DashboardReadLimitError" });
  assert.ok(large.calls.every((call) => call.method === "count"));
  await assert.rejects(databaseFixture({ broken: true }).run("school-a"), /database unavailable/);
  const blank = databaseFixture(); await assert.rejects(blank.run("  "), /School scope/); assert.equal(blank.transactions(), 0);
});

test("finance keeps canonical non-daily bill positions and real discounts unchanged", async () => {
  const decimal = (value) => ({ toNumber: () => value });
  const bills = [{ id: 1, schoolId: "school-a", studentId: "s1", status: "PARTIAL", dueDate: null, discountAmount: decimal(0), student: { name: "Ama", surname: "A", class: { id: 1, name: "KG1" }, parent: null, parentRelationships: [] }, lineItems: [
    { id: 1, amount: decimal(100), amountPaid: decimal(40), balance: decimal(60), feeItem: { name: "Tuition", category: "TUITION", billingFrequency: "TERM" } },
    { id: 2, amount: decimal(20), amountPaid: decimal(20), balance: decimal(0), feeItem: { name: "Feeding", category: "FEEDING", billingFrequency: "DAILY" } },
  ] }];
  const data = await databaseFixture({ bills }).run("school-a");
  assert.equal(data.moneyPosition.expectedFees, 100); assert.equal(data.moneyPosition.collectedFees, 40); assert.equal(data.moneyPosition.outstandingBalance, 60);
  assert.equal(data.moneyPosition.owingStudents, 1); assert.equal(data.moneyPosition.dailyLineItemCountExcluded, 1);
  bills[0].student.parentRelationships = Array.from({ length: 21 }, () => ({ parent: { email: null, phone: null } }));
  await assert.rejects(databaseFixture({ bills }).run("school-a"), { name: "DashboardReadLimitError" });
});

test("narrow school pulse reuses canonical attendance, never fabricates an academic period", async () => {
  const review = { schoolId: "school-a", date: "2026-10-15", classes: [{ id: 1 }], error: null, rosterCount: 3, totals: { PRESENT: 1, LATE: 0, ABSENT: 0, EXCUSED: 0, UNKNOWN: 2, NO_LESSONS: 0 }, lessons: [], academicPeriods: [], operatingSettings: { timezone: "Africa/Accra", openingTime: "07:30", closingTime: "15:00", activeDays: ["THURSDAY"] } };
  const calls = [];
  const load = loader({ "@/src/lib/prisma": new Proxy({}, { get(_, key) { if (key === "__esModule") return false; throw new Error("Pulse must not independently query or upsert"); } }), "@/src/lib/queries/admin-attendance-review": { getAdminAttendanceReview: async (...args) => { calls.push(args); return review; } } });
  const run = load("src/lib/services/admin-school-pulse.ts").getAdminSchoolPulse;
  const now = new Date("2026-10-15T12:00:00Z"); const data = await run("school-a", now);
  assert.equal(data.activePeriod, null); assert.equal(data.schoolPulse.present, 1); assert.equal(data.schoolPulse.unknown, 2); assert.equal(data.schoolPulse.absent, 0);
  assert.deepEqual(calls[0][2], { includeHistory: false, dashboard: true, expectedSchoolId: "school-a" });
  review.operatingSettings.activeDays = []; assert.equal((await run("school-a", now)).schoolPulse.operatingStatus.isActiveDay, false);
  review.error = "Invalid snapshot"; await assert.rejects(run("school-a", now), /unavailable/);
});

test("attendance rejects mismatched authenticated schools before a transaction", async () => {
  const load = loader({ "@/src/lib/authz": { ...auth, requireRole: async () => ({ schoolId: "school-b" }) }, "@/src/lib/prisma": { $transaction() { assert.fail("Must not query foreign school"); } }, "@/src/lib/services/teacher-accountability-settings": {} });
  await assert.rejects(load("src/lib/queries/admin-attendance-review.ts").getAdminAttendanceReview({}, new Date(), { dashboard: true, expectedSchoolId: "school-a" }), AuthorizationError);
});

test("admin and completed-setup gates run before any dashboard section can load", async () => {
  const order = [];
  const load = loader({ "@/src/lib/authz": { requirePageSession: async (roles) => { assert.deepEqual(roles, ["admin"]); order.push("auth"); return { schoolId: "school-a" }; }, requireCompletedAdminSchoolSetup: async () => { order.push("setup"); throw new AuthorizationError("Setup incomplete"); } }, "@/src/components/AdminDashboard": { default: () => { assert.fail("No section before auth/setup"); } } });
  await assert.rejects(load("src/app/(dashboard)/admin/page.tsx").default(), AuthorizationError);
  assert.deepEqual(order, ["auth", "setup"]);
});

test("dashboard wiring has five independent reads, no legacy loader or global cached data", () => {
  const source = readFileSync("src/components/AdminDashboard.tsx", "utf8");
  const page = readFileSync("src/app/(dashboard)/admin/page.tsx", "utf8");
  assert.equal((source.match(/<AdminDashboardSection /g) ?? []).length, 5);
  assert.doesNotMatch(page + source, /getAdminOwnerDashboardData|Promise\.all|unstable_cache|use cache/);
  assert.match(source, /getAdminTeacherAccountability\(schoolId, now, undefined, false, \{ dashboard: true \}\)/);
  assert.match(source, /getAdminSchoolPulse\(schoolId, now\)/);
});

test("unavailable, loading and capacity states are readable and never show invented metrics", () => {
  const load = loader({ "@/src/components/AdminDashboardRefresh": { __esModule: true, default: () => React.createElement("button", null, "Refresh dashboard") } });
  const State = load("src/components/AdminDashboardSectionState.tsx").default;
  for (const state of [{}, { loading: true }, { limited: true }]) {
    const html = renderToStaticMarkup(React.createElement(State, { title: "Finance Snapshot", ...state }));
    assert.match(html, /Finance Snapshot/); assert.match(html, /min-w-0/); assert.match(html, /overflow-wrap:anywhere/);
    assert.doesNotMatch(html, /GHS|<dd|>0</); assert.equal(html.includes("<button"), !state.loading);
  }
});

test("React streams the fast section while a slow sibling still displays loading", async () => {
  const load = loader({ "@/src/components/AdminDashboardRefresh": { __esModule: true, default: () => React.createElement("button", null, "Refresh dashboard") } });
  const Section = load("src/components/AdminDashboardSection.tsx").default;
  const { read } = readerFixture(); const gate = deferred(); const output = new PassThrough(); let html = "";
  output.on("data", (chunk) => { html += chunk.toString(); });
  const finished = new Promise((resolve, reject) => { output.on("end", resolve); output.on("error", reject); });
  const tree = React.createElement("main", null,
    React.createElement(Section, { id: "pulse", title: "Slow pulse", read, load: () => gate.promise, children: (value) => React.createElement("p", null, value) }),
    React.createElement(Section, { id: "finance", title: "Fast finance", read, load: async () => "FINANCE_READY", children: (value) => React.createElement("p", null, value) }));
  let stream;
  const shell = deferred();
  stream = renderToPipeableStream(tree, { progressiveChunkSize: 1, onShellReady() { stream.pipe(output); shell.resolve(); }, onError(error) { output.destroy(error); } });
  try {
    await shell.promise;
    for (let attempt = 0; attempt < 20 && !html.includes("FINANCE_READY"); attempt++) await flush();
    assert.match(html, /FINANCE_READY/); assert.match(html, /Loading school records/); assert.doesNotMatch(html, /PULSE_READY/);
  } finally { gate.resolve("PULSE_READY"); await finished; }
  assert.match(html, /PULSE_READY/);
});

test("render recovery contains no error payload and does not intercept framework navigation", () => {
  const load = loader({ "next/navigation": nav, "@/src/components/AdminDashboardRefresh": { __esModule: true, default: () => React.createElement("button", null, "Refresh dashboard") } });
  const Boundary = load("src/components/AdminDashboardRenderBoundary.tsx").default;
  assert.deepEqual(Boundary.getDerivedStateFromError(new Error("Private student data")), { failed: true });
  const redirect = { digest: "NEXT_REDIRECT;replace;/sign-in;307;" };
  assert.throws(() => Boundary.getDerivedStateFromError(redirect), (error) => error === redirect);
  const instance = new Boundary({ id: "finance", title: "Finance Snapshot", children: "Invalid output" });
  instance.state = { failed: true };
  const html = renderToStaticMarkup(instance.render());
  assert.match(html, /temporarily unavailable/); assert.doesNotMatch(html, /Private student|Invalid output/);
  assert.match(readFileSync("src/components/AdminDashboardSection.tsx", "utf8"), /key=\{props.requestKey\}/);
});

test("attendance dashboard budgets run inside the snapshot before roster and history reads", async () => {
  let rowsRead = false;
  const count = async ({ where }) => { assert.equal(where.schoolId, "school-a"); return 50001; };
  const db = {
    schoolNotificationSetting: { findUnique: async () => ({ timezone: "Africa/Accra", activeDays: ["THURSDAY"] }) },
    cAConfig: { findMany: async () => [] }, class: { count, findMany: async () => { rowsRead = true; } },
    student: { count }, publishedTimetableLesson: { count }, timetablePublication: { count }, attendance: { count },
  };
  const load = loader({ "@/src/lib/authz": { ...auth, requireRole: async () => ({ schoolId: "school-a" }) }, "@/src/lib/prisma": { $transaction: async (work, options) => { assert.equal(options.isolationLevel, "RepeatableRead"); return work(db); } }, "@/src/lib/services/teacher-accountability-settings": {} });
  await assert.rejects(load("src/lib/queries/admin-attendance-review.ts").getAdminAttendanceReview({}, new Date("2026-10-15T12:00:00Z"), { dashboard: true, includeHistory: false }), { name: "DashboardReadLimitError" });
  assert.equal(rowsRead, false);
});

test("accountability dashboard rejects oversized histories before evaluating duties", async () => {
  const calls = [];
  const tx = new Proxy({}, { get(_, model) { return { count: async ({ where }) => { calls.push(model); assert.equal(where.schoolId, "school-a"); return 200001; } }; } });
  const load = loader({ "@/src/lib/prisma": { $transaction: async (work, options) => { assert.equal(options.isolationLevel, "RepeatableRead"); assert.equal(options.timeout, 30000); return work(tx); } }, "@/src/generated/prisma": { Prisma: { TransactionIsolationLevel: { RepeatableRead: "RepeatableRead" } } }, "@/src/lib/services/teacher-ca-obligations": {}, "@/src/lib/services/teacher-homework-obligations": {} });
  await assert.rejects(load("src/lib/services/admin-teacher-accountability.ts").getAdminTeacherAccountability("school-a", new Date(), undefined, false, { dashboard: true }), { name: "DashboardReadLimitError" });
  assert.ok(calls.includes("teacherObligation")); assert.ok(calls.includes("cAActivityScore"));
});
