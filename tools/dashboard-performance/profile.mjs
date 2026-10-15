// Local read-only profiling. Never exposed through an application route.
import { createRequire } from 'node:module';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production', { info() {}, error() {} });
const { PrismaClient } = require('../../src/generated/prisma');
const args = process.argv.slice(2);
const option = (name, fallback) => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const concurrency = Number(option('concurrency', '1'));
const rounds = Number(option('rounds', '1'));
if (![concurrency, rounds].every((n) => Number.isInteger(n) && n >= 1 && n <= 3)) throw new Error('Read-only profiling is limited to 1-3 clients and rounds.');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4, connectionTimeoutMillis: 15000, options: '-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=2000', application_name: 'edujay-readonly-profile' });
const client = new PrismaClient({ adapter: new PrismaPg(pool), log: [{ emit: 'event', level: 'query' }] });
const captured = [];
client.$on('query', (event) => captured.push(event));
const output = resolve(option('out', '.private/dashboard-performance.json'));
const fixedNow = new Date();
const samples = [];
try {
  const schools = await client.school.findMany({ select: { id: true }, take: 2 });
  const schoolId = option('school', schools.length === 1 ? schools[0].id : undefined);
  if (!schoolId || !await client.school.findUnique({ where: { id: schoolId }, select: { id: true } })) throw new Error('Choose an existing school explicitly with --school=ID when there is more than one.');
  const cache = new Map();
  class AuthorizationError extends Error {}
  const mocks = {
    'server-only': {},
    '@/src/lib/prisma': client,
    '@/src/generated/prisma': require('../../src/generated/prisma'),
    '@/src/lib/authz': { AuthorizationError, requireRole: async () => ({ role: 'admin', schoolId }) },
    'next/navigation': { unstable_rethrow: (error) => { if (error?.digest?.startsWith('NEXT_')) throw error; } },
  };
  function load(file) {
    file = resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const compiled = { exports: {} }; cache.set(file, compiled);
    const js = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const scopedRequire = createRequire(file);
    new Function('require', 'module', 'exports', js)((id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith('@/')) return /\.js$/.test(id) ? require(resolve(id.slice(2))) : load(`${id.slice(2)}.ts`);
      if (id.startsWith('.') && existsSync(resolve(dirname(file), `${id}.ts`))) return load(resolve(dirname(file), `${id}.ts`));
      return scopedRequire(id);
    }, compiled, compiled.exports);
    return compiled.exports;
  }
  const available = {
    finance: () => load('src/lib/services/admin-finance-snapshot.ts').getAdminFinanceSnapshot(schoolId, fixedNow),
    pulse: () => load('src/lib/services/admin-school-pulse.ts').getAdminSchoolPulse(schoolId, fixedNow),
    accountability: () => load('src/lib/services/admin-teacher-accountability.ts').getAdminTeacherAccountability(schoolId, fixedNow, undefined, false, { dashboard: true }),
    academics: () => load('src/lib/services/admin-academic-readiness.ts').getAdminAcademicReadinessSnapshot(),
    parents: () => load('src/lib/services/admin-parent-engagement.ts').getAdminParentEngagementSnapshot(),
  };
  const selected = option('sections', 'finance,pulse,accountability,academics,parents').split(',');
  if (selected.some((section) => !available[section])) throw new Error('Unknown dashboard section.');
  // Do not serialize names, contacts, amounts, query parameters or raw SQL into artifacts.
  const stable = (value) => JSON.stringify(value, (key, item) => ['generatedAt', 'evaluatedAt'].includes(key) ? undefined : item);
  const checks = {};
  if (args.includes('--compare-full')) {
    const daily = load('src/lib/services/daily-collection-report.ts');
    const receipts = load('src/lib/services/receipt-integrity-report.ts');
    await client.$transaction(async (db) => {
      const fullDaily = await daily.getDailyCollectionReport(schoolId, fixedNow, db);
      const slimDaily = await daily.getDailyCollectionDashboardSummary(schoolId, fixedNow, db);
      assert.deepEqual(slimDaily.confirmationStatus, fullDaily.confirmationStatus);
      assert.equal(slimDaily.summary.confirmedAmount, fullDaily.summary.confirmedAmount);
      const fullReceipts = await receipts.getReceiptIntegrityReport(schoolId, db);
      const slimReceipts = await receipts.getReceiptIntegrityDashboardSummary(schoolId, db);
      assert.deepEqual(slimReceipts, { voidedReceipts: fullReceipts.voidedReceipts, duplicateReferenceCount: fullReceipts.duplicateReferenceCount });
    }, { isolationLevel: 'RepeatableRead', timeout: 45000 });
    checks.fullReportParity = 'PASS';
  }
  if (args.includes('--fault-check')) {
    const reader = load('src/lib/services/admin-dashboard-section.ts').createDashboardReader();
    const baseline = await available.finance();
    const failed = await reader('finance', () => client.$transaction(async (db) => {
      await db.$executeRawUnsafe("SET LOCAL statement_timeout = '100ms'");
      await db.$queryRawUnsafe('SELECT pg_sleep(1)');
    }, { timeout: 5000 }));
    assert.equal(failed.state, 'UNAVAILABLE');
    assert.equal(Object.hasOwn(failed, 'data'), false);
    const recovered = await reader('finance', available.finance);
    assert.equal(recovered.state, 'READY');
    assert.equal(stable(recovered.data), stable(baseline), 'Records changed during the probe; repeat on a quiescent fixture.');
    checks.statementTimeoutAndRecovery = 'PASS';
    const constrainedPool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000, options: '-c default_transaction_read_only=on -c statement_timeout=1000', application_name: 'edujay-readonly-pool-probe' });
    try {
      const held = await constrainedPool.connect();
      try {
        await assert.rejects(constrainedPool.query('SELECT 1 AS ok'), /timeout/i);
      } finally { held.release(); }
      assert.equal((await constrainedPool.query('SELECT 1 AS ok')).rows[0].ok, 1);
      checks.isolatedPoolExhaustionAndRecovery = 'PASS';
    } finally { await constrainedPool.end(); }
  }
  for (let round = 0; round < rounds; round++) {
    for (const section of selected) {
      const startIndex = captured.length;
      const results = await Promise.all(Array.from({ length: concurrency }, async () => {
        const started = performance.now();
        try {
          const value = await available[section]();
          return { ms: Math.round(performance.now() - started), state: value.state ?? 'READY', digest: createHash('sha256').update(stable(value)).digest('hex') };
        } catch (error) {
          return { ms: Math.round(performance.now() - started), state: 'ERROR', code: /^P\d{4}$/.test(error.code ?? '') ? error.code : error.name };
        }
      }));
      samples.push({ section, round, queries: captured.length - startIndex, results });
      console.log(JSON.stringify(samples.at(-1)));
    }
  }
  const grouped = new Map();
  for (const query of captured) {
    if (!/^\s*SELECT\b/i.test(query.query)) continue;
    const key = createHash('sha256').update(query.query).digest('hex').slice(0, 16);
    const existing = grouped.get(key) ?? { key, count: 0, totalMs: 0, maxMs: 0, sample: query };
    existing.count++; existing.totalMs += query.duration; existing.maxMs = Math.max(existing.maxMs, query.duration);
    grouped.set(key, existing);
  }
  const plans = [];
  // EXPLAIN ANALYZE executes only Prisma-generated SELECTs, under the same read-only limits.
  for (const item of [...grouped.values()].sort((a, b) => b.totalMs - a.totalMs).slice(0, 12)) {
    const entry = { fingerprint: item.key, count: item.count, totalMs: item.totalMs, maxMs: item.maxMs };
    try {
      const result = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${item.sample.query}`, JSON.parse(item.sample.params));
      const plan = result.rows[0]['QUERY PLAN'][0];
      const nodes = [];
      function visit(node) {
        nodes.push({ type: node['Node Type'], relation: node['Relation Name'], index: node['Index Name'], actualRows: node['Actual Rows'], estimatedRows: node['Plan Rows'], loops: node['Actual Loops'], ms: node['Actual Total Time'], sharedHits: node['Shared Hit Blocks'], sharedReads: node['Shared Read Blocks'] });
        for (const child of node.Plans ?? []) visit(child);
      }
      visit(plan.Plan); Object.assign(entry, { planningMs: plan['Planning Time'], executionMs: plan['Execution Time'], nodes });
    } catch { entry.explain = 'UNAVAILABLE'; }
    plans.push(entry);
  }
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify({ capturedAt: new Date().toISOString(), mode: 'READ_ONLY_EXISTING_DATA_NOT_CAPACITY_CERTIFICATION', concurrency, rounds, checks, samples, plans }, null, 2));
  console.log(`Sanitized measurements: ${output}`);
  if (samples.some((sample) => sample.results.some((result) => result.state === 'ERROR' || result.state === 'UNAVAILABLE'))) process.exitCode = 1;
} catch (error) {
  console.error(`Profiling stopped: ${/^P\d{4}$/.test(error.code ?? '') ? error.code : error.name}. Check local configuration; no credentials are printed.`);
  process.exitCode = 1;
} finally {
  await client.$disconnect();
  await pool.end();
}
