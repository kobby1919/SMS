import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
import { createRequire } from "node:module";

function loadPrivacy(env = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync("src/lib/monitoring/privacy.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, process: { env }, Set, Number });
  return exports;
}

test("monitoring is disabled unless both DSN and an explicit known environment exist", () => {
  for (const env of [{}, { NEXT_PUBLIC_SENTRY_DSN: "test-dsn" }, { NEXT_PUBLIC_SENTRY_ENVIRONMENT: "production" }, { NEXT_PUBLIC_SENTRY_DSN: "test-dsn", NEXT_PUBLIC_SENTRY_ENVIRONMENT: "unknown" }]) {
    assert.equal(loadPrivacy(env).monitoringOptions().enabled, false);
  }
  for (const environment of ["staging", "production", "preview", "development"]) {
    const options = loadPrivacy({ NEXT_PUBLIC_SENTRY_DSN: "test-dsn", NEXT_PUBLIC_SENTRY_ENVIRONMENT: environment }).monitoringOptions();
    assert.equal(options.enabled, true);
    assert.equal(options.environment, environment);
  }
});

test("monitoring does not collect request payloads, credentials, database values or session replay", () => {
  const options = loadPrivacy().monitoringOptions();
  for (const key of ["userInfo", "cookies", "httpHeaders", "urlQueryParams", "databaseQueryData", "queues", "stackFrameVariables"]) {
    assert.equal(options.dataCollection[key], false);
  }
  assert.equal(options.dataCollection.httpBodies.length, 0);
  assert.equal(options.dataCollection.frameContextLines, 0);
  assert.equal(options.replaysSessionSampleRate, 0);
  assert.equal(options.replaysOnErrorSampleRate, 0);
  assert.equal(options.tracesSampleRate, 0);
  assert.equal(options.beforeBreadcrumb({ message: "secret" }), null);
  assert.equal(options.beforeSendLog({ body: "secret" }), null);
  assert.equal(options.beforeSendMetric({ value: "secret" }), null);
  assert.deepEqual(Array.from(options.integrations([{ name: "BrowserSession" }, { name: "ProcessSession" }, { name: "GlobalHandlers" }]), (item) => item.name), ["GlobalHandlers"]);
});

test("outgoing events are rebuilt without arbitrary fields or sensitive details", () => {
  const source = {
    type: undefined, event_id: "a".repeat(32), environment: "production", release: "b".repeat(40), timestamp: 123,
    message: "Student Samuel Assan owes 500, token sk_live_example", user: { email: "guardian@example.invalid", ip_address: "1.2.3.4" },
    request: { url: "https://edujay.app/student/secret?invite=secret", headers: { authorization: "Bearer secret" }, cookies: "session-secret", data: { password: "secret" } },
    extra: { student: "Samuel Assan", secret: "secret" }, breadcrumbs: [{ message: "secret" }], contexts: { private: { secret: "secret" } },
    tags: { school: "Samuel Assan", component: "finance-cron" }, transaction: "/student/SamuelAssan", server_name: "private-server",
    logentry: { message: "secret" }, threads: { values: [{ secret: "secret" }] }, debug_meta: { secret: "secret" },
    exception: { values: [{ type: "TypeError", value: "private student and provider credentials", mechanism: { data: { secret: "secret" } }, stacktrace: { frames: [{ filename: "https://edujay.app/_next/static/abcdef123456.js?secret=token", lineno: 45, colno: 9, function: "private_student", vars: { secret: "secret" }, context_line: "secret" }] } }] },
  };
  const clean = loadPrivacy().sanitizeMonitoringEvent(source);
  const output = JSON.stringify(clean);
  assert.doesNotMatch(output, /Samuel|guardian|sk_live_|1\.2\.3\.4|private_student|Bearer|session-secret|edujay\.app|secret/);
  assert.equal(clean.exception.values[0].type, "TypeError");
  assert.equal(clean.exception.values[0].stacktrace.frames[0].filename, "abcdef123456.js");
  assert.equal(clean.exception.values[0].stacktrace.frames[0].lineno, 45);
  assert.equal(clean.tags.component, "finance-cron");
  assert.equal(source.request.headers.authorization, "Bearer secret");
});

test("unknown event fields and malformed identifiers cannot bypass the allowlist", () => {
  const clean = loadPrivacy().sanitizeMonitoringEvent({ event_id: "parent@example.invalid", timestamp: "secret", environment: "private-school", release: "private-host", message: "private-school", tags: { component: "private-school" }, arbitrary: "secret" });
  assert.equal(clean.event_id, undefined);
  assert.equal(clean.timestamp, undefined);
  assert.equal(clean.environment, "unconfigured");
  assert.equal(clean.release, undefined);
  assert.equal(clean.tags.component, undefined);
  assert.doesNotMatch(JSON.stringify(clean), /parent@|private-school|private-host|secret/);
});

test("exception chains are bounded and arbitrary types, filenames and variables are withheld", () => {
  const clean = loadPrivacy().sanitizeMonitoringEvent({ exception: { values: Array.from({ length: 20 }, () => ({ type: "SamuelAssan", value: "private", stacktrace: { frames: Array.from({ length: 100 }, () => ({ filename: "C:\\Users\\private\\SamuelAssan.js", vars: { password: "secret" } })) } })) } });
  assert.equal(clean.exception.values.length, 5);
  assert.equal(clean.exception.values[0].stacktrace.frames.length, 40);
  assert.equal(clean.exception.values[0].type, "Error");
  assert.doesNotMatch(JSON.stringify(clean), /Samuel|Users|password|secret/);
});

test("synthetic verification retains only its fixed non-customer message", () => {
  const privacy = loadPrivacy();
  const clean = privacy.sanitizeMonitoringEvent({ message: privacy.MONITORING_TEST_MESSAGE, level: "error", tags: { component: "monitoring-test", secret: "private" }, extra: { payload: "private" } });
  assert.equal(clean.message, "Edujay monitoring verification");
  assert.equal(clean.tags.component, "monitoring-test");
  assert.doesNotMatch(JSON.stringify(clean), /private/);
});

test("server, edge and browser initialization share the privacy policy", () => {
  for (const file of ["src/instrumentation-client.ts", "src/sentry.server.config.ts", "src/sentry.edge.config.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /monitoringOptions\(\)/);
    assert.match(source, /Sentry\.init/);
    assert.doesNotMatch(source, /replayIntegration|consoleLoggingIntegration/);
  }
  assert.match(readFileSync("src/instrumentation.ts", "utf8"), /onRequestError = Sentry\.captureRequestError/);
});

test("platform verification guards both page and action and never accepts a customer payload", () => {
  const source = readFileSync("src/app/(dashboard)/platform/monitoring/page.tsx", "utf8");
  assert.match(source, /requirePageSession\(\["platform_admin"\]\)/);
  assert.match(source, /requireRole\(\["platform_admin"\]\)/);
  assert.match(source, /Sentry\.captureMessage\(MONITORING_TEST_MESSAGE/);
  assert.match(source, /Sentry\.flush\(5000\)/);
  assert.doesNotMatch(source, /throw new Error|formData|searchParams.*captureMessage/);
});

test("existing error-recovery boundaries report errors without exposing them on screen", () => {
  for (const file of ["src/app/error.tsx", "src/app/(dashboard)/error.tsx", "src/app/global-error.tsx"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /Sentry\.captureException\(error/);
    assert.match(source, /PageRecoveryError reset=\{unstable_retry\}/);
    assert.doesNotMatch(source, /\{error\.message\}|console\.error/);
  }
});

function verificationPage(role, enabled, flushed = true) {
  const sent = [];
  const guard = async (roles) => { if (!roles.includes(role)) throw new Error("Forbidden"); };
  const dependencies = {
    "lucide-react": { Send: () => null },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    "next/navigation": { redirect: (url) => { throw new Error(`REDIRECT:${url}`); } },
    "@sentry/nextjs": { captureMessage: (...args) => sent.push(args), flush: async (timeout) => { assert.equal(timeout, 5000); return flushed; } },
    "@/src/lib/authz": { requireRole: guard, requirePageSession: guard },
    "@/src/lib/monitoring/privacy": { monitoringOptions: () => ({ enabled, environment: "staging" }), MONITORING_TEST_MESSAGE: "Edujay monitoring verification" },
  };
  const exports = {};
  const source = readFileSync("src/app/(dashboard)/platform/monitoring/page.tsx", "utf8") + "\nexport { sendMonitoringTest };";
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => { assert.ok(name in dependencies, `Unexpected import ${name}`); return dependencies[name]; } });
  return { ...exports, sent };
}

test("ordinary school roles cannot render verification or send test events", async () => {
  for (const role of [undefined, "admin", "teacher", "parent", "bursar", "collector"]) {
    const page = verificationPage(role, true);
    await assert.rejects(page.default({ searchParams: Promise.resolve({}) }), /Forbidden/);
    await assert.rejects(page.sendMonitoringTest(), /Forbidden/);
    assert.equal(page.sent.length, 0);
  }
});

test("unconfigured monitoring cannot send even as platform admin", async () => {
  const page = verificationPage("platform_admin", false);
  await assert.rejects(page.sendMonitoringTest(), /result=unconfigured/);
  assert.equal(page.sent.length, 0);
});

test("authorized verification sends one fixed synthetic event, not customer data", async () => {
  const page = verificationPage("platform_admin", true);
  await assert.rejects(page.sendMonitoringTest(), /result=submitted/);
  assert.equal(page.sent.length, 1);
  assert.equal(page.sent[0][0], "Edujay monitoring verification");
  assert.equal(page.sent[0][1].tags.component, "monitoring-test");
});

test("an unconfirmed SDK flush does not claim alert delivery", async () => {
  const page = verificationPage("platform_admin", true, false);
  await assert.rejects(page.sendMonitoringTest(), /result=unconfirmed/);
  assert.equal(page.sent.length, 1);
});

test("the real Sentry SDK transport receives only the sanitized event", async () => {
  const Sentry = createRequire(import.meta.url)("@sentry/nextjs");
  const envelopes = [];
  const options = loadPrivacy({ NEXT_PUBLIC_SENTRY_DSN: "https://public@example.invalid/123", NEXT_PUBLIC_SENTRY_ENVIRONMENT: "staging" }).monitoringOptions();
  Sentry.init({
    ...options,
    defaultIntegrations: false,
    transport: () => ({
      send: async (envelope) => { envelopes.push(envelope); return { statusCode: 200 }; },
      flush: async () => true,
    }),
  });
  try {
    Sentry.captureException(new Error("SENSITIVE_STUDENT_NAME sk_test_PRIVATE_KEY"), {
      user: { email: "private-parent@example.invalid" },
      extra: { password: "PRIVATE_PASSWORD", student: "SENSITIVE_STUDENT_NAME" },
      tags: { component: "finance-cron", school: "PRIVATE_SCHOOL" },
    });
    await Sentry.flush(2000);
    const events = envelopes.flatMap((envelope) => envelope[1]).filter(([header]) => header.type === "event").map(([, event]) => event);
    assert.equal(events.length, 1);
    assert.equal(events[0].tags.privacy, "strict");
    assert.doesNotMatch(JSON.stringify(envelopes), /SENSITIVE_STUDENT_NAME|PRIVATE_KEY|private-parent|PRIVATE_PASSWORD|PRIVATE_SCHOOL/);
  } finally { await Sentry.getClient()?.close(2000); }
});
