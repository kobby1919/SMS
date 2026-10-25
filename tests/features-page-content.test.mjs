import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const loaded = { exports: {} };
const source = ts.transpileModule(readFileSync("src/components/features-page/FeatureVisuals.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
new Function("require", "module", "exports", source)(require, loaded, loaded.exports);
const render = name => renderToStaticMarkup(React.createElement(loaded.exports[name]));

test("attendance example counts its three present students", () => {
  const html = render("AttendanceVisual");
  assert.match(html, />3<\/div><div[^>]*>Present</);
  for (const status of ["Absent", "Late", "Excused"]) {
    assert.match(html, new RegExp(`>1</div><div[^>]*>${status}<`));
  }
  assert.doesNotMatch(html, />Live</);
});

test("assessment and report examples share the correct subject average", () => {
  assert.match(render("GradingVisual"), /81\.2%/);
  assert.match(render("ResultsVisual"), /81\.2%/);
});

test("finance and bursar examples use the same five-bill scope", () => {
  assert.match(render("FinanceVisual"), /GH₵ 2,550/);
  const bursar = render("BursarVisual");
  for (const text of ["GH₵ 4,250 billed", "GH₵ 1,700", "GH₵ 2,550", "3 payments"]) assert.ok(bursar.includes(text));
  assert.doesNotMatch(bursar, /Auto-reconciled|Updated now|Export Excel/);
});

test("records and roles examples reflect guardian links and finance permissions", () => {
  assert.match(render("RecordsVisual"), /3 students · 2 classes · 3 guardian links/);
  const roles = render("RolesVisual");
  for (const role of ["Admin", "Teacher", "Bursar", "Parent"]) assert.ok(roles.includes(role));
  assert.match(roles, /Linked children only/);
  assert.doesNotMatch(roles, /Full school control|>Student</);
});
