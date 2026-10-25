import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function render(name) {
  const loaded = { exports: {} };
  const source = ts.transpileModule(readFileSync(`src/components/pricing/${name}.tsx`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", source)(require, loaded, loaded.exports);
  return renderToStaticMarkup(React.createElement(loaded.exports.default));
}

test("pricing presents a quoted annual package without a calculator or unapproved tiers", () => {
  const html = render("PricingPlans");
  for (const text of ["Annual school package", "MiqraTech Consult", "Agreed in writing", "Request a School Quote"]) assert.ok(html.includes(text));
  assert.match(html, /href="\/waitlist"/);
  assert.doesNotMatch(html, /type="range"|Growth|Enterprise|14-day|20%|GH₵|\/sign-up/);
});

test("scope explains additional costs, acceptance, and separate school-fee collections", () => {
  const html = render("PricingComparison");
  for (const text of ["Optional &amp; provider costs", "Written quotation", "School acceptance", "School to MiqraTech Consult", "Parent to school", "not Edujay subscription revenue"]) assert.ok(html.includes(text));
  assert.doesNotMatch(html, /<table|Free plan|Unlimited students/);
});

test("pricing FAQ has eight accessible questions without upgrade or trial promises", () => {
  const html = render("PricingFAQ");
  assert.equal((html.match(/aria-expanded="false"/g) ?? []).length, 8);
  assert.match(html, /Are setup and migration included\?/);
  assert.match(html, /Do parent fee payments go to MiqraTech Consult\?/);
  assert.doesNotMatch(html, /Can I upgrade|exceed the Free plan|14-day free trial|\/sign-up/);
});
