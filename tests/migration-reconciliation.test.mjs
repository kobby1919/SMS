import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";
import * as crypto from "node:crypto";

function load(path, modules) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: (name) => modules[name] ?? {}, Date, Set, BigInt });
  return exports;
}
const core = load("src/lib/migration/reconciliation.ts", { zod: { z } });
const inventoryCore = load("src/lib/migration/inventory.ts", { zod: { z } });
const inventory = () => ({ version: 3, status: "CONFIRMED", source: "School register", representative: "School admin", acknowledged: true, finance: null, rows: inventoryCore.inventoryDatasets.map(([key]) => ({ key, disposition: key === "subjects" ? "INCLUDE" : "EXCLUDE", expectedRecords: key === "subjects" ? 1 : 0, files: key === "subjects" ? "subjects.csv" : "", reason: "Not supplied", from: "", to: "" })) });

function fixture() {
  const evidence = core.newMigrationEvidence(); evidence.records.subjects = ["1"];
  const state = { school: { code: "EDJ", onboardingStatus: "ACADEMIC_DONE", setupStep: "fresh", _count: { grades: 1, classes: 1, subjects: 1 } }, inventory: inventory(), pending: [], logs: [{ id: 1, schoolId: "a", action: "IMPORT_RECORDED", createdAt: new Date("2026-10-08T10:00:00Z"), performedBy: "admin", metadata: { fileName: "subjects.csv", importedRows: 1, skippedRows: 0, evidence } }], approvals: [], records: Object.fromEntries(core.evidenceKeys.map((key) => [key, []])), bills: [] };
  state.records.subjects = [{ id: 1, schoolId: "a", name: "English" }];
  const tx = {
    $queryRaw: async () => [{ id: "a" }],
    school: { findUnique: async ({ where }) => where.id === "a" ? state.school : null },
    onboardingAuditLog: {
      findMany: async ({ where }) => state.logs.filter((log) => log.schoolId === where.schoolId),
      findFirst: async ({ where }) => [...state.approvals].reverse().find((log) => log.schoolId === where.schoolId) ?? null,
      create: async ({ data }) => { const record = { ...data, id: 2 + state.approvals.length, createdAt: new Date() }; state.approvals.push(record); return record; },
    },
    migrationStagedUpload: { findMany: async ({ where }) => state.pending.filter((upload) => upload.schoolId === where.schoolId) },
    studentBill: { findMany: async ({ where }) => state.bills.filter((bill) => bill.schoolId === where.schoolId && where.id.in.includes(bill.id)) },
  };
  const models = { classes: "class", subjects: "subject", students: "student", parents: "parent", parentLinks: "parentStudentRelationship", teachers: "teacher", bursars: "bursar", feeStructures: "feeItem", fees: "billLineItem", discounts: "discount" };
  for (const [key, model] of Object.entries(models)) tx[model] = { findMany: async ({ where }) => {
    const scope = where.schoolId ?? where.studentBill?.schoolId ?? where.feeStructure?.schoolId;
    assert.equal(typeof scope, "string");
    return state.records[key].filter((record) => record.schoolId === scope && where.id.in.includes(record.id));
  } };
  const service = load("src/lib/services/migration-reconciliation.ts", {
    "node:crypto": crypto, "@/src/lib/prisma": { default: { $transaction: async (work) => work(tx) } },
    "@/src/generated/prisma": { Prisma: { Decimal, TransactionIsolationLevel: { Serializable: "Serializable", RepeatableRead: "RepeatableRead" } } },
    "@/src/lib/services/migration-inventory": { getMigrationInventory: async (schoolId) => schoolId === "a" ? state.inventory : null },
    "@/src/lib/migration/inventory": inventoryCore, "@/src/lib/migration/reconciliation": core,
  });
  return { state, service, evidence };
}
const approval = (fingerprint) => ({ fingerprint, representative: "School representative", reviewNote: "Checked source registers and opening balances.", checkedSamples: true, acknowledged: true });

test("monetary controls use exact minor units without floating-point rounding", () => {
  assert.equal(core.moneyMinor("100.10"), 10010n); assert.equal(core.moneyDisplay(10010n), "100.10");
  assert.equal(core.moneyDisplay(-1n), "-0.01"); assert.throws(() => core.moneyMinor("1.001"));
});
test("approval requires both confirmations and rejects caller school scope", () => {
  const value = approval("a".repeat(64)); assert.equal(core.approvalSchema.safeParse(value).success, true);
  assert.equal(core.approvalSchema.safeParse({ ...value, checkedSamples: false }).success, false);
  assert.equal(core.approvalSchema.safeParse({ ...value, schoolId: "b" }).success, false);
});
test("reconciliation verifies imported identities, not unrelated whole-school totals", async () => {
  const { state, service } = fixture(); state.records.subjects.push({ id: 2, schoolId: "a", name: "Unrelated" });
  const report = await service.getMigrationReconciliation("a"); assert.equal(report.canApprove, true); assert.equal(report.rows[0].present, 1);
});
test("missing or cross-school identities block school approval", async () => {
  const { state, service } = fixture(); state.records.subjects[0].schoolId = "b";
  const report = await service.getMigrationReconciliation("a"); assert.equal(report.canApprove, false); assert.match(report.blockers.join(" "), /missing|scope/);
  const other = await service.getMigrationReconciliation("b"); assert.equal(other.batches.length, 0); assert.equal(other.rows.length, 0);
});
test("legacy evidence and problematic batches cannot be silently approved", async () => {
  const { state, service } = fixture(); delete state.logs[0].metadata.evidence; state.logs[0].metadata.problematic = true;
  const report = await service.getMigrationReconciliation("a"); assert.equal(report.canApprove, false); assert.match(report.blockers.join(" "), /separate verified reconciliation/); assert.match(report.blockers.join(" "), /problematic/);
});
test("pending saved sources block final approval", async () => {
  const { state, service } = fixture(); state.pending.push({ id: "pending", schoolId: "a", checksum: "x", inventoryVersion: 3 });
  assert.equal((await service.getMigrationReconciliation("a")).canApprove, false);
});
test("guardian profiles repeated across files are counted once", async () => {
  const { state, service, evidence } = fixture(); const row = state.inventory.rows.find((row) => row.key === "parents"); Object.assign(row, { disposition: "INCLUDE", expectedRecords: 1, files: "students.csv, parents.csv" });
  evidence.records.parents = ["p1", "p1"]; state.records.parents = [{ id: "p1", schoolId: "a", name: "Guardian" }];
  const report = await service.getMigrationReconciliation("a"); assert.equal(report.rows.find((row) => row.key === "parents").present, 1); assert.equal(report.canApprove, true);
});
test("approval is append-only and repeated approval is idempotent", async () => {
  const { state, service } = fixture(); const report = await service.getMigrationReconciliation("a");
  await service.approveMigrationReconciliation("a", "admin", approval(report.fingerprint));
  await service.approveMigrationReconciliation("a", "admin", approval(report.fingerprint));
  assert.equal(state.approvals.length, 1); assert.equal((await service.getMigrationReconciliation("a")).approval.by, "admin");
});
test("stale previews cannot approve records changed since review", async () => {
  const { state, service } = fixture(); const report = await service.getMigrationReconciliation("a"); state.records.subjects[0].name = "Changed";
  await assert.rejects(service.approveMigrationReconciliation("a", "admin", approval(report.fingerprint)), /changed/); assert.equal(state.approvals.length, 0);
});
test("a new import invalidates an earlier approval", async () => {
  const { state, service } = fixture(); const report = await service.getMigrationReconciliation("a"); await service.approveMigrationReconciliation("a", "admin", approval(report.fingerprint));
  state.logs.push({ ...state.logs[0], id: 9, metadata: { ...state.logs[0].metadata } }); assert.equal((await service.getMigrationReconciliation("a")).approval, null);
});
test("fresh setup is unaffected, while migration cannot bypass approval", async () => {
  const { state, service } = fixture(); await assert.rejects(service.withApprovedMigration("a", async () => "advanced"), /approve/);
  state.inventory = null; assert.equal(await service.withApprovedMigration("a", async () => "advanced"), "advanced");
  await assert.rejects(service.withApprovedMigration("a", async () => "advanced", true), /inventory/);
});

function financeFixture() {
  const value = fixture(); const { state, evidence } = value;
  Object.assign(state.inventory.rows.find((row) => row.key === "fees"), { disposition: "INCLUDE", expectedRecords: 1, files: "bills.csv" });
  state.inventory.finance = { gross: "100.10", discounts: "0", paid: "30.10", outstanding: "70" };
  evidence.records.fees = ["11"]; evidence.finance = { gross: "10010", paid: "3010", discounts: "0" };
  const line = { id: 11, schoolId: "a", studentBillId: 7, feeItemId: 22, amount: new Decimal("100.10"), amountPaid: new Decimal("30.10"), balance: new Decimal(70), isPaid: false };
  evidence.controls.feeLines = [{ id: "11", billId: 7, studentId: "s1", feeItemId: 22, amount: "10010", paid: "3010" }];
  state.records.fees = [line]; state.bills = [{ id: 7, schoolId: "a", studentId: "s1", totalAmount: line.amount, amountPaid: line.amountPaid, discountAmount: new Decimal(0), balance: new Decimal(70), lineItems: [line], discounts: [] }];
  return value;
}
test("opening paid credits reconcile without counting them as new payments", async () => {
  const { service } = financeFixture(); const report = await service.getMigrationReconciliation("a"); assert.equal(report.canApprove, true); assert.equal(report.finance.actual.paid, "30.10"); assert.equal(report.finance.actual.outstanding, "70.00");
});
test("one-cent mismatch and impossible bill balance block approval", async () => {
  const { state, service } = financeFixture(); state.inventory.finance.paid = "30.11"; state.inventory.finance.outstanding = "69.99";
  let report = await service.getMigrationReconciliation("a"); assert.equal(report.canApprove, false); assert.match(report.blockers.join(" "), /control total/);
  state.inventory.finance.paid = "30.10"; state.inventory.finance.outstanding = "70"; state.bills[0].balance = new Decimal(69);
  report = await service.getMigrationReconciliation("a"); assert.match(report.blockers.join(" "), /inconsistent/);
});
test("all setup exit paths use the migration approval gate", () => {
  const source = readFileSync("src/lib/services/onboarding.ts", "utf8");
  for (const name of ["advanceSchoolSetupToReview", "advanceSchoolSetupToCompletion", "completeSchoolOnboarding"]) {
    const body = source.split(`export async function ${name}`)[1].split("export async function")[0]; assert.match(body, /withApprovedMigration/);
  }
});
test("downloaded review preserves differences and neutralizes spreadsheet formulas", async () => {
  const { state, service } = fixture(); state.logs[0].metadata.fileName = "  =HYPERLINK(\"unsafe\")";
  const report = await service.getMigrationReconciliation("a"); const csv = service.reconciliationCsv(report);
  assert.match(csv, /NOT_APPROVED/); assert.match(csv, /'  =HYPERLINK/); assert.match(csv, /Outside approval/);
});
test("changed records invalidate approval at the setup exit gate", async () => {
  const { state, service } = fixture(); const report = await service.getMigrationReconciliation("a");
  await service.approveMigrationReconciliation("a", "admin", approval(report.fingerprint));
  assert.equal(await service.withApprovedMigration("a", async () => "advanced"), "advanced");
  state.records.subjects[0].name = "Changed after approval";
  await assert.rejects(service.withApprovedMigration("a", async () => "advanced"), /approve/);
});
test("student primary guardians must match the committed relationship evidence", async () => {
  const { state, service, evidence } = fixture();
  for (const key of ["students", "parents"]) Object.assign(state.inventory.rows.find((row) => row.key === key), { disposition: "INCLUDE", expectedRecords: 1, files: "students.csv" });
  evidence.records.students = ["s1"]; evidence.records.parents = ["p1"];
  state.records.students = [{ id: "s1", schoolId: "a", admissionNumber: "EDJ-2026-0001", name: "Student", surname: "One", parentId: "p1", class: { name: "Basic 1" } }];
  state.records.parents = [{ id: "p1", schoolId: "a", name: "Guardian" }];
  const report = await service.getMigrationReconciliation("a"); assert.equal(report.canApprove, false); assert.match(report.blockers.join(" "), /primary guardian/);
});
test("compensating paid-credit changes cannot hide behind matching totals", async () => {
  const { state, service, evidence } = financeFixture();
  state.inventory.rows.find((row) => row.key === "fees").expectedRecords = 2;
  state.inventory.finance = { gross: "200.10", discounts: "0", paid: "40.10", outstanding: "160" };
  evidence.records.fees.push("12"); evidence.finance = { gross: "20010", paid: "4010", discounts: "0" };
  evidence.controls.feeLines.push({ id: "12", billId: 8, studentId: "s2", feeItemId: 22, amount: "10000", paid: "1000" });
  const line = { id: 12, schoolId: "a", studentBillId: 8, feeItemId: 22, amount: new Decimal(100), amountPaid: new Decimal(10), balance: new Decimal(90), isPaid: false };
  state.records.fees.push(line); state.bills.push({ id: 8, schoolId: "a", studentId: "s2", totalAmount: line.amount, amountPaid: line.amountPaid, discountAmount: new Decimal(0), balance: line.balance, lineItems: [line], discounts: [] });
  assert.equal((await service.getMigrationReconciliation("a")).canApprove, true);
  state.records.fees[0].amountPaid = new Decimal("35.10"); state.records.fees[0].balance = new Decimal(65);
  line.amountPaid = new Decimal(5); line.balance = new Decimal(95);
  for (const bill of state.bills) { bill.amountPaid = bill.lineItems[0].amountPaid; bill.balance = bill.lineItems[0].balance; }
  const report = await service.getMigrationReconciliation("a"); assert.equal(report.finance.actual.paid, "40.10"); assert.equal(report.canApprove, false); assert.match(report.blockers.join(" "), /individual opening fee line/);
});
test("an opening bill cannot be reassigned to another student", async () => {
  const { state, service } = financeFixture(); state.bills[0].studentId = "other-student";
  const report = await service.getMigrationReconciliation("a"); assert.equal(report.canApprove, false); assert.match(report.blockers.join(" "), /original student/);
});
test("missing per-record finance controls require verified legacy review", async () => {
  const { evidence, service } = financeFixture(); delete evidence.controls;
  const report = await service.getMigrationReconciliation("a"); assert.equal(report.canApprove, false); assert.match(report.blockers.join(" "), /complete per-record controls/);
});
test("invalid line balances block approval even when bill totals balance", async () => {
  const { state, service } = financeFixture(); state.records.fees[0].balance = new Decimal(0);
  const report = await service.getMigrationReconciliation("a"); assert.equal(report.canApprove, false); assert.match(report.blockers.join(" "), /fee-line balance/);
});
test("direct completion cannot jump over setup stages", async () => {
  const { state, service } = fixture(); state.inventory = null;
  await assert.rejects(service.withApprovedMigration("a", async () => "completed", false, ["complete"]), /current setup stage/);
  state.school.setupStep = "migration";
  await assert.rejects(service.withApprovedMigration("a", async () => "completed"), /inventory/);
  state.school.setupStep = "complete"; state.school._count.subjects = 0;
  await assert.rejects(service.withApprovedMigration("a", async () => "completed", false, ["complete"]), /academic foundation/);
});
test("already-completed schools cannot be moved backwards by stale setup actions", async () => {
  const { state, service } = fixture(); state.school.onboardingStatus = "COMPLETED";
  await assert.rejects(service.withApprovedMigration("a", async () => "review"), /already completed/);
});
test("school completion and its audit record share the approval transaction", () => {
  const source = readFileSync("src/lib/services/onboarding.ts", "utf8").split("export async function completeSchoolOnboarding")[1].split("export async function")[0];
  assert.match(source, /tx\.onboardingAuditLog\.create/); assert.doesNotMatch(source, /await writeOnboardingAudit/); assert.match(source, /false, \["complete"\]/);
});
test("guardian ownership changes are detected even when profile counts match", async () => {
  const { state, evidence, service } = fixture();
  Object.assign(state.inventory.rows.find((row) => row.key === "parents"), { disposition: "INCLUDE", expectedRecords: 1, files: "parents.csv" });
  evidence.records.parents = ["p1"]; evidence.records.parentLinks = ["r1"];
  evidence.controls.guardianLinks = [{ id: "r1", parentId: "p1", studentId: "s1", role: "GUARDIAN" }];
  state.records.parents = [{ id: "p1", schoolId: "a" }];
  state.records.parentLinks = [{ id: "r1", schoolId: "a", parentId: "p1", studentId: "s2", role: "GUARDIAN", status: "ACTIVE", parent: { name: "Guardian", surname: "One" }, student: { admissionNumber: "EDJ-2026-0002" } }];
  const report = await service.getMigrationReconciliation("a"); assert.equal(report.rows.find((row) => row.key === "parents").difference, 0); assert.equal(report.canApprove, false); assert.match(report.blockers.join(" "), /original parent, student/);
});
test("student placement changes require reconciliation against original controls", async () => {
  const { state, evidence, service } = fixture();
  for (const key of ["students", "parents"]) Object.assign(state.inventory.rows.find((row) => row.key === key), { disposition: "INCLUDE", expectedRecords: 1, files: "students.csv" });
  evidence.records.students = ["s1"]; evidence.records.parents = ["p1"]; evidence.records.parentLinks = ["r1"];
  evidence.controls.studentPlacements = [{ id: "s1", classId: 1, gradeId: 1, parentId: "p1" }];
  evidence.controls.guardianLinks = [{ id: "r1", parentId: "p1", studentId: "s1", role: "PRIMARY_GUARDIAN" }];
  state.records.parents = [{ id: "p1", schoolId: "a" }];
  state.records.students = [{ id: "s1", schoolId: "a", classId: 2, gradeId: 2, parentId: "p1", name: "Student", surname: "One", admissionNumber: "EDJ-2026-0001", class: { name: "Basic 2" } }];
  state.records.parentLinks = [{ id: "r1", schoolId: "a", parentId: "p1", studentId: "s1", role: "PRIMARY_GUARDIAN", status: "ACTIVE", parent: { name: "Guardian", surname: "One" }, student: { admissionNumber: "EDJ-2026-0001" } }];
  const report = await service.getMigrationReconciliation("a"); assert.equal(report.canApprove, false); assert.match(report.blockers.join(" "), /committed class, grade/);
});
test("conflicting snapshots cannot be resolved by silently taking the latest", async () => {
  const { state, evidence, service } = financeFixture();
  const other = core.newMigrationEvidence(); other.records.fees = ["11"]; other.controls.feeLines = [{ ...evidence.controls.feeLines[0], paid: "0" }];
  state.logs.push({ ...state.logs[0], id: 9, metadata: { evidence: other } });
  const report = await service.getMigrationReconciliation("a"); assert.equal(report.canApprove, false); assert.match(report.blockers.join(" "), /conflicting record-level controls/);
});
test("oversized financial evidence is rejected before BigInt processing", () => {
  const evidence = core.newMigrationEvidence(); evidence.finance.gross = "9".repeat(10000);
  assert.equal(core.evidenceSchema.safeParse(evidence).success, false);
});
