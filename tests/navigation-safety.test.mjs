import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function filesAt(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? filesAt(join(dir, entry.name)) : [join(dir, entry.name)]);
}
const sources = filesAt("src").filter((path) => /\.(tsx?|jsx?)$/.test(path) && !path.includes("generated"));
const routes = filesAt("src/app").filter((path) => /[/\\](page|route)\.(tsx?|jsx?)$/.test(path)).map((path) => path.replace(/^src[/\\]app[/\\]/, "").replace(/(?:^|[/\\])(page|route)\.(tsx?|jsx?)$/, "").split(/[/\\]/).filter((part) => part && !part.startsWith("(")));
function matchesRoute(url) {
  const path = url.split(/[?#]/)[0].split("/").filter(Boolean);
  return routes.some((route) => {
    for (let i = 0; i < route.length; i++) {
      if (route[i].startsWith("[[...")) return true;
      if (route[i].startsWith("[...")) return path.length > i;
      if (!path[i] || (!route[i].startsWith("[") && route[i] !== path[i])) return false;
    }
    return path.length === route.length;
  });
}
function destinations(node) {
  if (!node) return [];
  if (ts.isJsxExpression(node)) return destinations(node.expression);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isTemplateExpression(node)) return [node.head.text + node.templateSpans.map((span) => "__record__" + span.literal.text).join("")];
  if (ts.isConditionalExpression(node)) return [...destinations(node.whenTrue), ...destinations(node.whenFalse)];
  return [];
}

test("all statically identifiable in-app links have a real page or API route", () => {
  const broken = [];
  for (const path of sources) {
    const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
    function visit(node) {
      const isHref = ts.isJsxAttribute(node) && node.name.getText(source) === "href";
      const isHrefProperty = ts.isPropertyAssignment(node) && node.name.getText(source).replaceAll('"', "") === "href";
      if (isHref || isHrefProperty) for (const value of destinations(node.initializer)) {
        if (!value.startsWith("/") || value.startsWith("//") || /^\/__record__(?:[?#]|$)/.test(value)) continue;
        if (!matchesRoute(value)) broken.push(`${path}:${source.getLineAndCharacterOfPosition(node.pos).line + 1} ${value}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.deepEqual(broken, [], "Broken internal links must be fixed before release.");
});

test("record ids reject prefixes, overflow and alternate numeric formats", () => {
  const code = ts.transpileModule(readFileSync("src/lib/record-id.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", code)(require, loaded, loaded.exports);
  for (const id of ["26junk", "0", "-1", "1.5", "1e2", "0x1a", " 26", "2147483648", ""]) assert.equal(loaded.exports.parseRecordId(id), null);
  assert.equal(loaded.exports.parseRecordId("26"), 26);
});

test("missing records recover safely and finance review cannot expose operational controls", () => {
  const proxy = readFileSync("src/proxy.ts", "utf8");
  assert.match(proxy.slice(proxy.indexOf("const isPublicRoute"), proxy.indexOf("export default clerkMiddleware")), /"\/contact"/);
  for (const path of ["src/app/not-found.tsx", "src/app/(dashboard)/not-found.tsx"]) assert.match(readFileSync(path, "utf8"), /UnavailablePage/);
  for (const path of ["src/app/error.tsx", "src/app/(dashboard)/error.tsx"]) assert.match(readFileSync(path, "utf8"), /PageRecoveryError/);
  const bill = readFileSync("src/app/(dashboard)/list/finance/bills/[id]/page.tsx", "utf8");
  assert.match(bill, /student: \{ schoolId \}, feeStructure: \{ schoolId \}/);
  assert.match(bill, /canOperatePayments && <BillDiscountPanel/);
  assert.match(bill, /canOperatePayments && bill.status/);
  assert.match(bill, /canOperatePayments \? \([\s\S]*FinanceQueryResolveForm/);
  assert.doesNotMatch(bill, /notFound\(/);
  const actions = readFileSync("src/lib/actions/billActions.ts", "utf8");
  for (const action of ["waiveBill", "applyBillDiscount", "removeBillDiscount"]) assert.match(actions.slice(actions.indexOf(`export async function ${action}`), actions.indexOf(`export async function ${action}`) + 300), /requireFinanceOperationAccess/);
  assert.match(readFileSync("src/lib/actions/parentFinanceActions.ts", "utf8"), /resolveFinanceQuery[\s\S]*requireFinanceOperationAccess/);
  assert.match(readFileSync("src/app/api/report-card/pdf/route.tsx", "utf8"), /\["admin", "teacher", "parent", "student"\]\.includes\(role\)/);
  assert.match(readFileSync("src/app/api/report-card/pdf/route.tsx", "utf8"), /reportReady = readiness\.isReady && readiness\.subjectCount === subjectRows\.length/);
  for (const path of ["src/app/api/report-card/pdf/route.tsx", "src/app/(dashboard)/list/report-cards/[studentId]/page.tsx"]) assert.match(readFileSync(path, "utf8"), /if \(exWeight > 0 && !hasRecordedExam\(r\)\) continue/);
  assert.match(readFileSync("src/app/(dashboard)/list/report-cards/[studentId]/page.tsx", "utf8"), /isComplete:\s+readiness\.issues\.length === 0/);
});
