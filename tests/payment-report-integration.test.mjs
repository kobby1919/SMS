import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assertContains(source, needle, message) {
  assert.ok(
    source.includes(needle),
    `${message}\nMissing source text: ${needle}`,
  );
}

function assertMatches(source, pattern, message) {
  assert.match(source, pattern, message);
}

const moneyPulse = read("src/lib/services/bursar-money-pulse.ts");
const classCollection = read("src/lib/services/class-collection-report.ts");
const studentFeeStatus = read("src/app/(dashboard)/list/finance/bills/page.tsx");
const dailyReport = read("src/lib/services/daily-finance-report.ts");
const dailyReportPdf = read("src/app/api/finance/reports/daily/route.tsx");
const weeklyReport = read("src/lib/services/weekly-finance-report.ts");
const receiptsPage = read("src/app/(dashboard)/list/finance/receipts/page.tsx");
const correctionReport = read("src/lib/services/correction-reversal-report.ts");

test("today money pulse uses confirmed payments for received money and payment intents only for attempts", () => {
  assertContains(moneyPulse, "prisma.payment.groupBy", "Today Money Pulse must calculate received money from the canonical Payment table.");
  assertContains(moneyPulse, 'status: "CONFIRMED"', "Today Money Pulse must count only confirmed payments as received money.");
  assertContains(moneyPulse, "prisma.paymentIntent", "Today Money Pulse may show provider attempts as operational pending/failed signals.");
  assertContains(moneyPulse, "onlineAttemptCounts", "Provider attempts must remain operational counts, not a separate online-money ledger.");
});

test("class collection and student fee status use student bills as source of truth", () => {
  assertContains(classCollection, "prisma.studentBill.findMany", "Class collection must use StudentBill so online payments affect class totals only after bill allocation.");
  assertContains(classCollection, "amountPaid", "Class collection must read allocated paid amount from bills.");
  assertContains(classCollection, "balance", "Class collection must read remaining balance from bills.");
  assertContains(studentFeeStatus, "prisma.studentBill.findMany", "Student fee status must use StudentBill, not provider attempts.");
  assertContains(studentFeeStatus, "amountPaid", "Student fee status must include online money after it is applied to bills.");
});

test("daily money report includes online verified payments inside normal payment totals and register", () => {
  assertContains(dailyReport, "prisma.payment.findMany", "Daily report must read confirmed payments from the Payment table.");
  assertContains(dailyReport, "externalProvider: true", "Daily report must select provider information for online verified money.");
  assertContains(dailyReport, "externalReference: true", "Daily report must select provider references for reconciliation.");
  assertContains(dailyReport, 'recordedBy === "system:webhook"', "Daily report must distinguish provider-confirmed records from manual records.");
  assertContains(dailyReport, "Online verified -", "Daily report must label provider-confirmed payments clearly.");
  assertContains(dailyReportPdf, "paymentRegisterMethod(payment)", "Daily PDF payment register must show online verified methods.");
  assertContains(dailyReportPdf, "paymentRegisterReference(payment)", "Daily PDF payment register must show provider references.");
});

test("weekly owner summary counts confirmed payments and checks provider references for receipt trust", () => {
  assertContains(weeklyReport, "prisma.payment.findMany", "Weekly summary must use Payment for weekly collection totals.");
  assertContains(weeklyReport, 'status: "CONFIRMED"', "Weekly summary must count only confirmed collections.");
  assertContains(weeklyReport, "getClassCollectionReport(schoolId)", "Weekly class performance must use the canonical class collection report.");
  assertContains(weeklyReport, "getBursarArrearsFollowUp", "Weekly arrears pressure must use the canonical arrears service.");
  assertContains(weeklyReport, "externalProvider: true", "Weekly receipt trust must inspect provider references.");
  assertContains(weeklyReport, "externalReference: true", "Weekly receipt trust must include online provider references.");
  assertContains(weeklyReport, "ONLINE:", "Weekly duplicate-reference checks must keep online provider references separate from manual methods.");
});

test("receipts and corrections show online verified history without deleting original money records", () => {
  assertContains(receiptsPage, "externalReference", "Receipt register must search/show external provider references.");
  assertContains(receiptsPage, "Online verified", "Receipt register must clearly label provider-confirmed receipts.");
  assertContains(receiptsPage, 'recordedBy === "system:webhook"', "Receipt register must only call provider records online verified when webhook-created.");
  assertContains(correctionReport, "paymentReversal", "Correction/reversal report must include payment reversals.");
  assertContains(correctionReport, "paymentCorrectionRequest", "Correction/reversal report must include correction requests.");
  assertMatches(correctionReport, /schoolId/g, "Correction/reversal report must be school-scoped.");
});
