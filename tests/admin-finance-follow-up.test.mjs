import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync("src/lib/services/admin-finance-snapshot.ts", "utf8");
const compiled = ts.transpileModule(`${source}\nexport { buildBillMoneyPosition };`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports, require: () => ({}), Date, Map, Set });
const decimal = (value) => ({ toNumber: () => value });
function bill(id, studentId, amount, overdueDays = 0) {
  return {
    id, studentId, schoolId: "school-a", status: "UNPAID",
    dueDate: new Date(Date.UTC(2026, 9, 8 - overdueDays)), discountAmount: decimal(0),
    student: { name: studentId, surname: "Test", class: { id: 1, name: "KG1" }, parent: { email: "revoked@example.org", schoolId: "school-a" }, parentRelationships: [] },
    lineItems: [{ id, amount: decimal(amount), amountPaid: decimal(0), balance: decimal(amount), feeItem: { name: "Tuition", category: "TUITION", billingFrequency: "TERM" } }],
  };
}
test("top owing students aggregate balances, rank distinct students and retain a bill link", () => {
  const rows = [bill(1, "a", 600, 2), bill(2, "a", 600, 20), ...Array.from({ length: 6 }, (_, i) => bill(i + 3, `b${i}`, 100 + i))];
  const result = exports.buildBillMoneyPosition(rows, new Date("2026-10-08T12:00:00Z"));
  assert.equal(result.highRiskOwingStudents.length, 5);
  assert.equal(new Set(result.highRiskOwingStudents.map((row) => row.studentId)).size, 5);
  const first = result.highRiskOwingStudents[0];
  assert.equal(first.studentId, "a");
  assert.equal(first.amountOwed, 1200);
  assert.equal(first.daysOverdue, 20);
  assert.equal(first.href, "/list/finance/bills/2");
  assert.equal(first.parentContactStatus, "No contact saved");
});
test("paid and waived bills do not enter follow-up; active contacts are considered across guardians", () => {
  const paid = bill(1, "paid", 100); paid.status = "PAID";
  const waived = bill(2, "waived", 100); waived.status = "WAIVED";
  const owing = bill(3, "owing", 100);
  owing.student.parentRelationships = [{ parent: { email: null, phone: null } }, { parent: { email: "active@example.org", phone: null } }];
  const result = exports.buildBillMoneyPosition([paid, waived, owing], new Date("2026-10-08T12:00:00Z"));
  assert.equal(result.highRiskOwingStudents.length, 1);
  assert.equal(result.highRiskOwingStudents[0].parentContactStatus, "Contact saved");
});
