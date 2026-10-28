import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

const require = createRequire(import.meta.url);
test("the homepage opts into Clash Display without changing other marketing pages", () => {
  assert.match(readFileSync("src/app/(marketing)/page.tsx", "utf8"), /<HomepageNavbar clashWordmark/);
  for (const route of ["about", "features", "pricing", "howItWorks"]) {
    assert.doesNotMatch(readFileSync(`src/app/(marketing)/${route}/page.tsx`, "utf8"), /<HomepageNavbar[^>]*clashWordmark/);
  }
});

test("the shared logo keeps Nunito by default and changes only the requested wordmark", () => {
  const loaded = { exports: {} };
  const source = ts.transpileModule(readFileSync("src/components/EdujayBrandLogo.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  new Function("require", "exports", source)((id) => id === "next/image" ? { __esModule: true, default: (props) => { const attrs = { ...props }; delete attrs.priority; delete attrs.unoptimized; return React.createElement("img", attrs); } } : require(id), loaded.exports);
  const normal = renderToStaticMarkup(React.createElement(loaded.exports.default));
  const clash = renderToStaticMarkup(React.createElement(loaded.exports.default, { wordmarkFont: "clash" }));
  assert.match(normal, /font-nunito/);
  assert.doesNotMatch(normal, /font-clashDisplay/);
  assert.match(clash, /font-clashDisplay font-bold tracking-normal/);
  assert.doesNotMatch(clash, /font-nunito/);
  for (const html of [normal, clash]) assert.match(html, /src="\/edujay-logo.png"/);
});
