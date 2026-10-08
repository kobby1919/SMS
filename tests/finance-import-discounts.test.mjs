import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { Decimal } from "@prisma/client/runtime/client";

function load(path, dependencies) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => dependencies[name] ?? {}, Date, Map, Set });
  return exports;
}
const helpers = load("src/lib/services/bill-discounts.ts", { "@/src/generated/prisma": { Prisma: { Decimal } } });
function fixture() {
  const bill = { id: 1, schoolId: "a", totalAmount: new Decimal(1200), amountPaid: new Decimal(500), discountAmount: new Decimal(0), balance: new Decimal(700), status: "PARTIAL", student: { name: "Student", surname: "Test" } };
  const discounts = [];
  const audits = [];
  const tx = {
    $queryRaw: async () => [],
    studentBill: { findFirst: async ({ where }) => where.schoolId === bill.schoolId && where.id === bill.id ? bill : null, update: async ({ data }) => Object.assign(bill, data) },
    discount: { create: async ({ data }) => { const row = { id: discounts.length + 1, status: "ACTIVE", ...data }; discounts.push(row); return row; }, findFirst: async ({ where }) => discounts.find((row) => row.id === where.id && row.schoolId === where.schoolId) ?? null, findFirstOrThrow: async ({ where }) => discounts.find((row) => row.id === where.id), update: async ({ where, data }) => Object.assign(discounts.find((row) => row.id === where.id), data) },
    financeAuditLog: { create: async ({ data }) => { audits.push(data); return data; }, findFirst: async ({ where }) => audits.find((row) => row.action === where.action && (where.metadata ? row.metadata.requestId === where.metadata.equals && row.performedBy === where.performedBy : row.entityId === where.entityId)) ?? null },
  };
  return { tx, bill, discounts, audits };
}
const input = { schoolId: "a", actorId: "admin", billId: 1, type: "SCHOLARSHIP", description: "Approved scholarship" };

test("scholarship reduces balance without becoming collected money", async () => {
  const { tx, bill, audits } = fixture();
  await helpers.applyDiscountInTransaction(tx, { ...input, amount: 200, approvalReference: "sch-001" });
  assert.equal(bill.balance.toString(), "500");
  assert.equal(bill.amountPaid.toString(), "500");
  assert.equal(bill.discountAmount.toString(), "200");
  assert.equal(audits[0].metadata.approvalReference, "sch-001");
});
test("percentage removal uses original amount after bill total changes", async () => {
  const { tx, bill, discounts } = fixture();
  await helpers.applyDiscountInTransaction(tx, { ...input, percentage: 10 });
  assert.equal(discounts[0].amount.toString(), "120");
  bill.totalAmount = new Decimal(2000);
  await helpers.removeDiscountInTransaction(tx, { schoolId: "a", actorId: "admin", discountId: 1, reason: "Approval withdrawn" });
  assert.equal(bill.discountAmount.toString(), "0");
  assert.equal(bill.balance.toString(), "1500");
  await assert.rejects(helpers.removeDiscountInTransaction(tx, { schoolId: "a", actorId: "admin", discountId: 1, reason: "Again" }), /already been removed/);
});
test("combined reductions cannot exceed current unpaid balance", async () => {
  const { tx } = fixture();
  await helpers.applyDiscountInTransaction(tx, { ...input, amount: 600 });
  await assert.rejects(helpers.applyDiscountInTransaction(tx, { ...input, amount: 200 }), /cannot exceed/);
});
test("retrying the same manual discount request does not apply money twice", async () => {
  const { tx, bill, discounts } = fixture();
  const request = { ...input, amount: 200, requestId: "same-request" };
  await helpers.applyDiscountInTransaction(tx, request);
  const retry = await helpers.applyDiscountInTransaction(tx, request);
  assert.equal(retry.replayed, true);
  assert.equal(discounts.length, 1);
  assert.equal(bill.balance.toString(), "500");
  await assert.rejects(helpers.applyDiscountInTransaction(tx, { ...request, amount: 100 }), /different discount details/);
});
test("wrong-school and waived bill reductions are rejected", async () => {
  const { tx, bill } = fixture();
  await assert.rejects(helpers.applyDiscountInTransaction(tx, { ...input, schoolId: "b", amount: 10 }), /not found/);
  bill.status = "WAIVED";
  await assert.rejects(helpers.applyDiscountInTransaction(tx, { ...input, amount: 10 }), /waived/);
});
test("legacy percentage reduction without a verified amount requires review", async () => {
  const { tx, discounts } = fixture();
  discounts.push({ id: 1, schoolId: "a", studentBillId: 1, status: "ACTIVE", amount: null, percentage: new Decimal(10) });
  await assert.rejects(helpers.removeDiscountInTransaction(tx, { schoolId: "a", actorId: "admin", discountId: 1, reason: "Remove" }), /verified applied amount/);
});
test("finance templates distinguish setup, opening money and approved reductions", () => {
  const mapping = load("src/lib/migration/column-mapping.ts", {});
  const structures = mapping.getMigrationAreaDefinition("feeStructures");
  const bills = mapping.getMigrationAreaDefinition("fees");
  const discounts = mapping.getMigrationAreaDefinition("discounts");
  for (const key of ["category", "isOptional", "dueDate"]) assert.ok(structures.fields.some((field) => field.key === key && field.required));
  assert.ok(bills.fields.some((field) => field.key === "amountPaid" && field.required));
  assert.ok(discounts.fields.some((field) => field.key === "approvalReference" && field.required));
  for (const area of [structures, bills, discounts]) for (const row of area.sampleRows) assert.equal(row.length, area.fields.length);
});

test("preview rejects daily term bills, overpaid openings and excessive combined scholarships", async () => {
  const mapping = load("src/lib/migration/column-mapping.ts", {});
  const structure = { id: 1, gradeId: 1, term: "TERM_1", academicYear: "2026/27", title: "KG1", status: "PUBLISHED", dueDate: new Date("2026-10-31"), feeItems: [{ id: 1, name: "Tuition", amount: new Decimal(1200), billingFrequency: "TERM" }] };
  const student = { admissionNumber: "EDJ-2026-0001", gradeId: 1, email: null, phone: null, parentRelationships: [] };
  const bill = { id: 1, student, feeStructure: structure, feeStructureId: 1, totalAmount: new Decimal(1200), amountPaid: new Decimal(500), discountAmount: new Decimal(0), status: "PARTIAL", lineItems: [] };
  const empty = { findMany: async () => [] };
  const prisma = { school: { findUnique: async () => ({ code: "EDJ" }) }, class: empty, subject: empty, parent: empty, teacher: empty, bursar: empty, financeAuditLog: empty, grade: { findMany: async () => [{ id: 1, level: "KG1" }] }, student: { findMany: async () => [student] }, feeStructure: { findMany: async () => [structure] }, studentBill: { findMany: async () => [bill] } };
  const validator = load("src/lib/services/data-migration-validation.ts", { "@/src/lib/prisma": { default: prisma }, "@/src/lib/migration/column-mapping": mapping, "@/src/lib/admission-number": { validateAdmissionNumberForSchool: () => ({ ok: true }) }, "@/src/generated/prisma": { DiscountType: { SCHOLARSHIP: "SCHOLARSHIP" }, FeeCategory: { TUITION: "TUITION" } } });
  async function preview(areaKey, rows) {
    const headers = mapping.getMigrationAreaDefinition(areaKey).fields.map((field) => field.key);
    return validator.validateMigrationRows({ schoolId: "a", areaKey, headers, mapping: Object.fromEntries(headers.map((header) => [header, header])), rows });
  }
  const opening = await preview("fees", [["EDJ-2026-0001", "Tuition", "DAILY", "1200", "1500", "TERM_1", "2026/27"]]);
  assert.equal(opening.correctionRows, 1);
  assert.ok(opening.rows[0].issues.some((issue) => issue.field === "amountPaid" && issue.severity === "ERROR"));
  const reductions = await preview("discounts", [["EDJ-2026-0001", "TERM_1", "2026/27", "SCHOLARSHIP", "400", "", "Approved", "a"], ["EDJ-2026-0001", "TERM_1", "2026/27", "SCHOLARSHIP", "400", "", "Approved", "b"]]);
  assert.equal(reductions.correctionRows, 2);
  assert.ok(reductions.rows.every((row) => row.issues.some((issue) => issue.message.includes("Combined reductions"))));
});

test("migration publication is school-scoped, requires readiness and records its audit", async () => {
  const structure = { id: 1, schoolId: "a", title: "KG1", status: "DRAFT", dueDate: new Date("2026-10-31"), feeItems: [{ name: "Tuition", amount: new Decimal(1200), category: "TUITION", billingFrequency: "TERM", isOptional: false }], _count: { bills: 0 } };
  const audits = [];
  const tx = { $queryRaw: async () => [], feeStructure: { findFirst: async ({ where }) => where.id === structure.id && where.schoolId === structure.schoolId ? structure : null, update: async ({ data }) => Object.assign(structure, data) }, financeAuditLog: { create: async ({ data }) => audits.push(data) } };
  const action = load("src/lib/actions/migrationFinanceActions.ts", {
    "@/src/generated/prisma": { Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } } },
    "@/src/lib/prisma": { default: { $transaction: async (callback) => callback(tx) } },
    "@/src/lib/authz": { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ["admin"]); return { schoolId: "a", userId: "admin" }; } },
    "@/src/lib/rate-limit": { enforceActionRateLimit: async () => {} },
    "@/src/lib/services/finance-policy": { assertCanPublishFeeStructure: ({ mandatoryFeeItemCount }) => { if (!mandatoryFeeItemCount) throw new Error("Missing mandatory charge"); } },
    "@/src/lib/cacheTags": { revalidateDashboard: () => {} },
    zod: { z: { number: () => ({ int: () => ({ positive: () => ({ parse: (value) => value }) }) }) } },
  });
  await assert.rejects(action.publishMigrationFeeStructure(2), /not found/);
  structure.dueDate = null;
  await assert.rejects(action.publishMigrationFeeStructure(1), /due date/);
  structure.dueDate = new Date("2026-10-31");
  await action.publishMigrationFeeStructure(1);
  assert.equal(structure.status, "PUBLISHED");
  assert.equal(audits[0].action, "FEE_STRUCTURE_PUBLISHED");
  await action.publishMigrationFeeStructure(1);
  assert.equal(audits.length, 1);
});
