import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const loaded = { exports: {} };
const source = ts.transpileModule(readFileSync("src/components/howItWorks/StepVisuals.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
new Function("require", "module", "exports", source)(require, loaded, loaded.exports);
const render = name => renderToStaticMarkup(React.createElement(loaded.exports[name]));

test("access example distinguishes request, review, and invitation", () => {
  const html = render("AccessVisual");
  for (const text of ["School request", "Needs and scope review", "Administrator invitation", "does not activate a school"]) assert.ok(html.includes(text));
});

test("setup example separates fresh entry from reviewed migration", () => {
  const html = render("SetupPathsVisual");
  for (const text of ["Start Fresh", "Bring Existing Records", "reconcile before approval"]) assert.ok(html.includes(text));
});

test("readiness example does not claim providers are already live", () => {
  const html = render("ReviewVisual");
  for (const text of ["Staff permissions", "Opening balances", "External services are separate", "configuration and verification"]) assert.ok(html.includes(text));
  assert.doesNotMatch(html, /All systems live|No conflicts|94%/);
});
