// Opt-in authenticated browser rehearsal against synthetic disposable fixtures only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { validateLoadTarget } from './safety.mjs';

const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production', { info() {}, error() {} });
let manifest;
let target;
try {
  manifest = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  target = validateLoadTarget(manifest, process.env);
} catch {
  console.error('Preflight refused. Check the isolated target, private manifest, fixture values and explicit acknowledgement. No requests were made.');
  process.exit(1);
}
if (!process.argv.includes('--execute')) {
  console.log('Configuration validated. No requests or writes performed. Add --execute only after isolated-app preflight.');
  process.exit(0);
}
const { chromium } = require(process.env.EDUJAY_PLAYWRIGHT_MODULE || 'playwright');
const pool = new pg.Pool({ connectionString: process.env.DASHBOARD_TEST_DATABASE_URL, max: 2, options: '-c default_transaction_read_only=on -c statement_timeout=5000' });
const browser = await chromium.launch({ ...(process.env.EDUJAY_BROWSER_PATH ? { executablePath: process.env.EDUJAY_BROWSER_PATH } : {}) });
const samples = [];
const errors = [];
const contexts = [];
const runTag = `dashboard-load-${randomUUID()}`;
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * p) - 1)];
const cents = (value) => Math.round(Number(value) * 100);
const moneyText = (value) => Number(value.replace(/[^\d.-]/g, ''));
let passed = false;
try {
  // Deliberately narrow fixture: one active student, one unpaid non-daily bill, no discounts.
  // This makes reconciliation exact; it is a correctness rehearsal, not a large-school benchmark.
  const bills = await pool.query('SELECT b.*, s.name, s.surname, s.status AS "studentStatus" FROM "StudentBill" b JOIN "Student" s ON s.id=b."studentId" AND s."schoolId"=b."schoolId" WHERE b."schoolId"=$1', [manifest.schoolId]);
  assert.equal(bills.rows.length, 1, 'Use a dedicated one-bill synthetic fixture.');
  const bill = bills.rows[0];
  assert.equal(bill.id, manifest.billId);
  assert.equal(bill.studentId, manifest.studentId);
  assert.equal(bill.studentStatus, 'ACTIVE');
  assert.ok(`${bill.name} ${bill.surname}`.includes(manifest.fixtureToken));
  assert.equal(cents(bill.discountAmount), 0);
  assert.equal(cents(bill.amountPaid), 0);
  assert.equal(bill.status, 'UNPAID');
  assert.ok(cents(bill.balance) >= cents(manifest.paymentAmount));
  const lines = await pool.query('SELECT l.*, f."billingFrequency" FROM "BillLineItem" l JOIN "FeeItem" f ON f.id=l."feeItemId" WHERE l."studentBillId"=$1', [manifest.billId]);
  assert.ok(lines.rows.length > 0 && lines.rows.every((line) => line.billingFrequency !== 'DAILY' && cents(line.amountPaid) === 0));
  const expected = lines.rows.reduce((sum, line) => sum + cents(line.amount), 0);
  assert.equal(expected, cents(bill.balance));
  const activity = await pool.query('SELECT * FROM "CAActivity" WHERE id=$1 AND "schoolId"=$2 AND "teacherId"=$3', [manifest.activityId, manifest.schoolId, manifest.teacherId]);
  assert.equal(activity.rows.length, 1);
  assert.ok(activity.rows[0].title.includes(manifest.fixtureToken));
  assert.equal(activity.rows[0].isLocked, false);
  assert.ok(manifest.rawScore <= Number(activity.rows[0].rawMaxScore));
  const existingScores = await pool.query('SELECT count(*)::int AS n FROM "CAActivityScore" WHERE "activityId"=$1', [manifest.activityId]);
  assert.equal(existingScores.rows[0].n, 0);

  async function pageFor(storageState) {
    const context = await browser.newContext({ storageState: resolve(storageState), viewport: { width: 1440, height: 1000 } });
    contexts.push(context);
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror', () => errors.push('BROWSER_RUNTIME_ERROR'));
    return page;
  }
  const admins = await Promise.all(manifest.adminStates.map(pageFor));
  const bursar = await pageFor(manifest.bursarState);
  const teacher = await pageFor(manifest.teacherState);
  async function open(page, path) {
    const result = await page.goto(new URL(path, target.origin).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    assert.ok(result?.ok());
    assert.equal(new URL(page.url()).pathname, new URL(path, target.origin).pathname, 'Login/role/setup redirect is not a passed load request.');
  }
  async function dashboard(page, final = false) {
    const start = performance.now();
    await open(page, '/admin');
    await page.getByRole('heading', { name: 'Finance Snapshot', exact: true }).waitFor();
    await page.waitForFunction(() => !document.body.innerText.includes('Loading school records'));
    const text = await page.locator('body').innerText();
    assert.ok(!/temporarily unavailable|No totals can be confirmed|Application error/.test(text));
    const cardValue = async (label) => moneyText(await page.getByText(label, { exact: true }).locator('..').locator('..').locator('p').first().innerText());
    const total = cents(await cardValue('Bill expected'));
    const paid = cents(await cardValue('Bill collected'));
    const balance = cents(await cardValue('Bill outstanding'));
    assert.equal(total, expected);
    assert.equal(total, paid + balance);
    assert.ok([0, cents(manifest.paymentAmount)].includes(paid));
    if (final) assert.equal(paid, cents(manifest.paymentAmount));
    samples.push({ operation: 'dashboard', ms: Math.round(performance.now() - start) });
  }
  // Check every identity/fixture before the first mutation; never bypass login or role guards.
  for (const admin of admins) await dashboard(admin);
  await open(bursar, `/list/finance/bills/${manifest.billId}/record-payment`);
  assert.ok((await bursar.locator('body').innerText()).includes(manifest.fixtureToken));
  await open(teacher, manifest.assessmentPath);
  await teacher.locator('select').first().selectOption(String(activity.rows[0].subjectId));
  await teacher.getByRole('button').filter({ hasText: manifest.bucketTitle }).click();
  await teacher.getByRole('button').filter({ hasText: activity.rows[0].title }).click();
  const score = teacher.getByText(manifest.studentId, { exact: true }).locator('..').locator('..').locator('input[type="number"]:visible');
  assert.equal(await score.count(), 1);
  assert.ok(await score.isEnabled(), 'CA entry window and eligibility must genuinely allow recording.');

  const jobs = admins.map(async (page) => {
    for (let i = 0; i < manifest.rounds; i++) await dashboard(page);
  });
  jobs.push((async () => {
    const start = performance.now();
    await bursar.getByRole('spinbutton').fill(String(manifest.paymentAmount));
    await bursar.getByPlaceholder('Full name of the person making the payment').fill(runTag);
    await bursar.getByRole('button', { name: /^Record Payment/ }).click();
    await bursar.getByRole('heading', { name: 'Payment Recorded', exact: true }).waitFor();
    samples.push({ operation: 'payment', ms: Math.round(performance.now() - start) });
  })());
  jobs.push((async () => {
    const start = performance.now();
    await score.fill(String(manifest.rawScore));
    await teacher.getByRole('button', { name: 'Save Scores', exact: true }).click();
    await teacher.getByText(/Scores saved successfully/).waitFor();
    samples.push({ operation: 'score', ms: Math.round(performance.now() - start) });
  })());
  const outcomes = await Promise.allSettled(jobs);
  assert.ok(outcomes.every((result) => result.status === 'fulfilled'), 'At least one concurrent operation failed. Inspect the isolated application logs.');
  const payments = await pool.query('SELECT * FROM "Payment" WHERE "schoolId"=$1 AND "paidBy"=$2', [manifest.schoolId, runTag]);
  assert.equal(payments.rows.length, 1);
  assert.equal(payments.rows[0].status, 'CONFIRMED');
  assert.ok(payments.rows[0].receiptNumber);
  assert.equal(cents(payments.rows[0].amount), cents(manifest.paymentAmount));
  const updatedBill = await pool.query('SELECT "amountPaid", balance FROM "StudentBill" WHERE id=$1 AND "schoolId"=$2', [manifest.billId, manifest.schoolId]);
  assert.equal(cents(updatedBill.rows[0].amountPaid), cents(manifest.paymentAmount));
  assert.equal(cents(updatedBill.rows[0].balance), expected - cents(manifest.paymentAmount));
  const updatedLines = await pool.query('SELECT "amountPaid", balance FROM "BillLineItem" WHERE "studentBillId"=$1', [manifest.billId]);
  assert.equal(updatedLines.rows.reduce((sum, line) => sum + cents(line.amountPaid), 0), cents(manifest.paymentAmount));
  assert.equal(updatedLines.rows.reduce((sum, line) => sum + cents(line.balance), 0), expected - cents(manifest.paymentAmount));
  const scores = await pool.query('SELECT "rawScore", "recordedBy" FROM "CAActivityScore" WHERE "schoolId"=$1 AND "activityId"=$2 AND "studentId"=$3', [manifest.schoolId, manifest.activityId, manifest.studentId]);
  assert.equal(scores.rows.length, 1);
  assert.equal(Number(scores.rows[0].rawScore), manifest.rawScore);
  assert.equal(scores.rows[0].recordedBy, manifest.teacherId);
  for (const admin of admins) await dashboard(admin, true);
  assert.equal(errors.length, 0);
  const latencies = samples.filter((sample) => sample.operation === 'dashboard').map((sample) => sample.ms);
  assert.ok(percentile(latencies, 0.95) <= manifest.maxDashboardP95Ms, 'Dashboard p95 exceeded the agreed test budget.');
  passed = true;
} catch (error) {
  errors.push(error.name || 'TEST_FAILED');
  process.exitCode = 1;
} finally {
  for (const context of contexts) await context.close();
  await browser.close(); await pool.end();
  const out = resolve('.private/dashboard-load-result.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ passed, samples, errors, note: 'Synthetic fixture only. No browser traces, cookies, SQL, contacts or payment records are exported.' }, null, 2));
  console.log(`Mixed-load ${passed ? 'PASS' : 'FAIL'}; sanitized result: ${out}`);
}
