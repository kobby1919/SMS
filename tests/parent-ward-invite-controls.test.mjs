import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
function load(file, mocks) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)((id) => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith("@/") ? load(`${id.slice(2)}.ts`, mocks) : require(id), loaded, loaded.exports);
  return loaded.exports;
}
const input = { parentId: "parent-a", studentId: "child-new", role: "GUARDIAN", canViewFees: false, canViewReports: true, canMessageSchool: false, note: "Added by admin" };
for (const scenario of ["new", "duplicate", "ended", "inactive", "other-school"]) {
  test(`adding a ward from an invite: ${scenario}`, async () => {
    const created = [], audits = [];
    const db = {
      parent: { findFirst: async ({ where }) => { assert.equal(where.schoolId, "school-a"); return { id: "parent-a" }; } },
      student: {
        findFirst: async ({ where }) => { assert.equal(where.schoolId, "school-a"); return scenario === "other-school" ? null : { id: "child-new", status: scenario === "inactive" ? "LEFT_SCHOOL" : "ACTIVE" }; },
        updateMany: async () => ({ count: 1 }),
      },
      parentStudentRelationship: {
        findUnique: async () => ["duplicate", "ended"].includes(scenario) ? { id: "existing", status: scenario === "ended" ? "REMOVED" : "ACTIVE" } : null,
        create: async ({ data }) => { created.push(data); return { id: "new-link", status: "ACTIVE" }; },
      },
    };
    const service = load("src/lib/actions/parentRelationshipActions.ts", {
      "next/cache": { revalidatePath() {} }, "@/src/lib/prisma": { __esModule: true, default: db },
      "@/src/lib/authz": { requireRole: async (roles) => { assert.deepEqual(roles, ["admin"]); return { userId: "admin-a", schoolId: "school-a" }; } },
      "@/src/lib/services/parent-access-audit": { writeParentAccessAudit: async (_db, data) => { audits.push(data); } },
    });
    const result = await service.addParentWardLinkAction(input);
    assert.equal(result.ok, scenario === "new");
    assert.equal(created.length, scenario === "new" ? 1 : 0);
    if (scenario === "new") {
      assert.equal(created[0].canViewFees, false);
      assert.equal(created[0].canMessageSchool, false);
      assert.equal(audits[0].action, "CHILD_LINKED");
    }
  });
}

test("embedded ward manager excludes existing wards, uses the shared action and refreshes links", async () => {
  let state = 0;
  const jobs = [], pending = [], calls = [];
  let refreshed = 0;
  const Component = load("src/components/ParentWardLinkManager.tsx", {
    react: { ...React, useState: () => [[true, null, null][state++], () => {}], useMemo: (fn) => fn(), useTransition: () => [false, (work) => jobs.push(work())] },
    "@/src/lib/actions/parentRelationshipActions": { addParentWardLinkAction: async (data) => { calls.push(data); return { ok: true, message: "Saved" }; } },
  }).default;
  const tree = Component({ parentId: "parent-a", relationships: [], students: [{ id: "existing", name: "Linked", surname: "Child", className: "P1" }, { id: "child-new", name: "New", surname: "Child", className: "P1" }], addOnly: true, linkedStudentIds: ["existing"], onChanged: async () => { refreshed++; }, onPendingChange: (value) => pending.push(value) });
  const html = renderToStaticMarkup(tree);
  assert.doesNotMatch(html, /value="existing"/);
  assert.match(html, /value="child-new"/);
  assert.doesNotMatch(html, /No ward links yet/);
  function findForm(node) {
    if (!node || typeof node !== "object") return null;
    if (node.type === "form") return node;
    for (const child of React.Children.toArray(node.props?.children)) { const found = findForm(child); if (found) return found; }
    return null;
  }
  const form = new FormData();
  form.set("studentId", "child-new"); form.set("role", "GUARDIAN"); form.set("canViewReports", "on");
  findForm(tree).props.action(form);
  await Promise.all(jobs);
  assert.equal(calls[0].parentId, "parent-a");
  assert.equal(calls[0].studentId, "child-new");
  assert.deepEqual(pending, [true, false]);
  assert.equal(refreshed, 1);
});
