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
  const source = ts.transpileModule(readFileSync(`src/components/about-page/${name}.tsx`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", source)(require, loaded, loaded.exports);
  return renderToStaticMarkup(React.createElement(loaded.exports.default));
}

test("About names the four confirmed team members and the company", () => {
  const html = render("AboutTeam");
  for (const name of ["Samuel Kwabena Assan", "Robert Ankrah", "Yevgene Mawugbe", "Harriet", "MiqraTech Consult"]) assert.ok(html.includes(name));
  assert.match(html, /Creator &amp; Lead Software Engineer/);
  assert.match(html, /Founder, MiqraTech Consult/);
  assert.match(html, /Creator &amp; Lead Software Engineer, Edujay · MiqraTech Consult/);
  assert.match(html, /Designed and built Edujay in its entirety/);
  assert.match(html, /Software Engineer, Edujay/);
  assert.match(html, /supporting future development and improvements/);
  assert.doesNotMatch(html, /Co-Creator &amp; Software Engineering Collaborator/);
  assert.match(html, /Administration Coordinator, MiqraTech Consult/);
  assert.doesNotMatch(html, /\b(?:Mr\.?|Miss|Mrs\.?|Ms\.?)\s+(?:Robert|Samuel|Yevgene|Harriet)/);
  assert.doesNotMatch(html, /Software Engineer, Edujay · MiqraTech Consult<\/div><p[^>]*>Helped shape/);
  assert.doesNotMatch(html, /Jay Mensah|Ama Boateng|Kweku Asante|Efua Darko|Founder &amp; CEO|We&#x27;re growing/);
});

test("purpose uses product priorities instead of unverified adoption statistics", () => {
  const html = render("AboutMission");
  for (const text of ["Connected records", "Clear responsibilities", "Reviewed information", "Guided setup"]) assert.ok(html.includes(text));
  assert.doesNotMatch(html, /50\+|500\+|98%|Schools onboarded|Satisfaction rate/);
});

test("approach has no invented launch history or school deployments", () => {
  const html = render("AboutStory");
  for (const text of ["Understand", "Prepare", "Review", "Improve"]) assert.ok(html.includes(text));
  assert.doesNotMatch(html, /2024|2025|First schools go live|Growing across Ghana|Accra and Kumasi/);
});

test("principles describe accuracy, boundaries, clarity, and adoption", () => {
  const html = render("AboutValues");
  for (const text of ["Accuracy matters", "Access has boundaries", "Clarity over promises", "Support adoption"]) assert.ok(html.includes(text));
  assert.doesNotMatch(html, /shouldn&#x27;t need training|Schools depend on Edujay every single day/);
});
