import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path, dependencies, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
    Date,
    crypto: { randomUUID: () => "test-worker" },
    ...globals,
  });
  return exports;
}

function workerRoute(env = {}, run = async () => null, now = () => Date.now()) {
  const errors = [];
  const route = load("src/app/api/internal/finance/jobs/run/route.ts", {
    "@sentry/nextjs": { captureException: () => {} },
    "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
    "@/src/lib/services/finance-job-runner": { runNextFinanceJob: run },
  }, { process: { env }, Date: { now }, console: { error: (message) => errors.push(message) } });
  return { ...route, errors };
}

const request = (secret, method = "GET") => new Request("https://example.invalid/api/internal/finance/jobs/run", {
  method,
  headers: secret ? { authorization: `Bearer ${secret}` } : {},
});

test("Vercel schedule calls the existing worker route each minute", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.deepEqual(config.crons, [{ path: "/api/internal/finance/jobs/run", schedule: "* * * * *" }]);
});

test("scheduled worker is disabled by default and never touches the queue", async () => {
  const route = workerRoute({}, () => assert.fail("Disabled cron must not claim jobs"));
  const response = await route.GET(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { skipped: true });
});

test("enabled cron fails closed when CRON_SECRET is missing", async () => {
  const route = workerRoute({ FINANCE_SCHEDULE_ENABLED: "true" }, () => assert.fail("No secret"));
  assert.equal((await route.GET(request())).status, 503);
});

test("cron rejects missing/wrong tokens, including the manual worker token", async () => {
  const route = workerRoute({ FINANCE_SCHEDULE_ENABLED: "true", CRON_SECRET: "cron-only", FINANCE_WORKER_SECRET: "manual-only" },
    () => assert.fail("Unauthorized cron must not claim jobs"));
  for (const secret of [undefined, "wrong", "manual-only"]) {
    assert.equal((await route.GET(request(secret))).status, 401);
  }
});

test("authorized cron stops at an empty queue", async () => {
  let calls = 0;
  const route = workerRoute({ FINANCE_SCHEDULE_ENABLED: "true", CRON_SECRET: "cron-only" }, async () => { calls += 1; return null; });
  const response = await route.GET(request("cron-only"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { completed: 0, failed: 0 });
  assert.equal(calls, 1);
});

test("cron bounds a busy queue to five jobs per invocation", async () => {
  let calls = 0;
  const route = workerRoute({ FINANCE_SCHEDULE_ENABLED: "true", CRON_SECRET: "cron-only" }, async () => {
    calls += 1;
    return { jobId: "private-job", status: "COMPLETED" };
  });
  const response = await route.GET(request("cron-only"));
  assert.deepEqual(await response.json(), { completed: 5, failed: 0 });
  assert.equal(calls, 5);
});

test("cron stops starting new jobs after its processing budget", async () => {
  let clock = 0;
  let calls = 0;
  const route = workerRoute({ FINANCE_SCHEDULE_ENABLED: "true", CRON_SECRET: "cron-only" }, async () => {
    calls += 1;
    clock += 41_000;
    return { status: "COMPLETED" };
  }, () => clock);
  assert.equal((await route.GET(request("cron-only"))).status, 200);
  assert.equal(calls, 1);
});

test("cron reports failures without exposing provider secrets and can process later jobs", async () => {
  let calls = 0;
  const route = workerRoute({ FINANCE_SCHEDULE_ENABLED: "true", CRON_SECRET: "cron-only" }, async () => {
    calls += 1;
    if (calls === 1) throw new Error("sensitive-provider-payload");
    return calls === 2 ? { status: "COMPLETED" } : null;
  });
  const response = await route.GET(request("cron-only"));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { completed: 1, failed: 1 });
  assert.equal(route.errors.length, 1);
  assert.doesNotMatch(route.errors.join(" "), /sensitive-provider-payload/);
});

test("manual POST still requires FINANCE_WORKER_SECRET, not the cron token", async () => {
  let calls = 0;
  const route = workerRoute({ FINANCE_WORKER_SECRET: "manual-only", CRON_SECRET: "cron-only" }, async () => {
    calls += 1;
    return { jobId: "job", status: "COMPLETED" };
  });
  assert.equal((await route.POST(request("cron-only", "POST"))).status, 401);
  const response = await route.POST(request("manual-only", "POST"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).processed, true);
  assert.equal(calls, 1);
});

test("overlapping workers cannot claim the same pending job twice", async () => {
  let status = "PENDING";
  let reads = 0;
  const prisma = { financeJob: {
    findFirst: async () => ({ id: "job" }),
    updateMany: async ({ where, data }) => {
      assert.equal(where.id, "job");
      assert.equal(where.status, "PENDING");
      assert.ok(where.runAfter.lte instanceof Date);
      assert.equal(data.attempts.increment, 1);
      if (status !== "PENDING") return { count: 0 };
      status = data.status;
      return { count: 1 };
    },
    findUnique: async () => { reads += 1; return { id: "job", status }; },
  } };
  const queue = load("src/lib/services/finance-queue.ts", {
    "@/src/lib/prisma": { __esModule: true, default: prisma },
    "@/src/generated/prisma": { Prisma: {} },
  });
  const results = await Promise.all([queue.claimNextFinanceJob("worker-a"), queue.claimNextFinanceJob("worker-b")]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(reads, 1);
});

test("an empty queue does not attempt a claim", async () => {
  const queue = load("src/lib/services/finance-queue.ts", {
    "@/src/lib/prisma": { __esModule: true, default: { financeJob: {
      findFirst: async () => null,
      updateMany: () => assert.fail("No pending job"),
    } } },
    "@/src/generated/prisma": { Prisma: {} },
  });
  assert.equal(await queue.claimNextFinanceJob("worker-a"), null);
});

test("Paystack verification is bounded by a 15-second abort signal", async () => {
  const signal = {};
  const providers = load("src/lib/services/payment-checkout-providers.ts", {}, {
    AbortSignal: { timeout: (ms) => { assert.equal(ms, 15_000); return signal; } },
    fetch: async (url, options) => {
      assert.equal(url, "https://api.paystack.co/transaction/verify/test-reference");
      assert.equal(options.signal, signal);
      return Response.json({ status: true, data: { reference: "test-reference", amount: 50000, currency: "GHS", status: "success" } });
    },
  });
  const result = await providers.verifyProviderPayment({ provider: "PAYSTACK", reference: "test-reference", secretKey: "test-only" });
  assert.equal(result.amount, 500);
  assert.equal(result.status, "SUCCESS");
});

test("a verification timeout propagates to the worker retry path", async () => {
  const providers = load("src/lib/services/payment-checkout-providers.ts", {}, {
    AbortSignal: { timeout: () => ({}) },
    fetch: async () => { throw new Error("verification timeout"); },
  });
  await assert.rejects(providers.verifyProviderPayment({ provider: "PAYSTACK", reference: "test-reference", secretKey: "test-only" }), /verification timeout/);
});
