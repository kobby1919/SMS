import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

const require = createRequire(import.meta.url);
test("marketing pages use the same shared brand typography without per-page switches", () => {
  const navbar = readFileSync("src/components/HomepageNavbar.tsx", "utf8");
  assert.doesNotMatch(navbar, /clashWordmark|wordmarkFont/);
  assert.match(navbar, /<EdujayBrandLogo/);
});

test("shared branding uses Clash Display and preserves the logo artwork", () => {
  const loaded = { exports: {} };
  const source = ts.transpileModule(readFileSync("src/components/EdujayBrandLogo.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  new Function("require", "exports", source)((id) => id === "next/image" ? { __esModule: true, default: (props) => { const attrs = { ...props }; delete attrs.priority; delete attrs.unoptimized; return React.createElement("img", attrs); } } : require(id), loaded.exports);
  const normal = renderToStaticMarkup(React.createElement(loaded.exports.default));
  assert.match(normal, /font-clashDisplay font-bold/);
  assert.doesNotMatch(normal, /font-nunito/);
  assert.match(normal, /src="\/edujay-logo.png"/);
});

test("global typography separates display headings from readable body and data text", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  assert.match(css, /--font-body: var\(--font-manrope\)/);
  assert.match(css, /--font-inter: var\(--font-body\)/);
  assert.match(css, /--font-heading: "Clash Display", "Manrope"/);
  assert.match(css, /font-family: "Manrope";[\s\S]*?manrope-variable\.ttf[\s\S]*?font-weight: 200 800/);
  assert.match(css, /h1, h2, h3, h4, h5, h6, \[role="heading"\]/);
  assert.match(css, /font-synthesis: none/);
  assert.doesNotMatch(css, /fonts.googleapis.com|font-family: "Nunito"/);
  assert.match(readFileSync("src/app/layout.tsx", "utf8"), /flex-col font-body/);
});

test("scoped marketing headings and component font imports follow the shared system", () => {
  const features = readFileSync("src/components/FeaturesSection.tsx", "utf8");
  for (const selector of [".ej-feat h3", ".ej-feat-step h4"]) {
    const rule = features.slice(features.indexOf(selector)).split("}")[0];
    assert.match(rule, /font-family: var\(--font-heading\)/);
  }
  for (const file of ["FeaturesSection", "SchoolAccessRequest", "about-page/AboutHero", "features-page/FeaturesHero", "howItWorks/HowItWorksHero", "pricing/PricingHero"]) {
    assert.doesNotMatch(readFileSync(`src/components/${file}.tsx`, "utf8"), /@import.*fonts.googleapis.com/);
  }
});
