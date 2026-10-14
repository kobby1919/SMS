import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { academicReadinessFixture } from "./academic-readiness-fixture.mjs";
const nodeRequire = createRequire(import.meta.url);
const { chromium } = nodeRequire(process.env.EDUJAY_PLAYWRIGHT_PATH ?? process.argv[2]);
const loaded = { exports: {} };
const code = ts.transpileModule(readFileSync("src/components/AdminAcademicReadiness.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
new Function("require", "module", "exports", code)((id) => id === "next/link" ? { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) } : nodeRequire(id), loaded, loaded.exports);
const css = readFileSync("tmp/academic-readiness-preview.css", "utf8").replace(/url\("(\/fonts\/[^"\s]+)"\)/g, (_, path) => `url("data:font/ttf;base64,${readFileSync(resolve(`public${path}`)).toString("base64")}")`);
mkdirSync("tmp/academic-readiness", { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
try {
  for (const state of ["ACTIVE", "INVALID_EXAM", "EMPTY", "SETUP_REQUIRED", "UNAVAILABLE", "CA_ONLY"]) for (const width of [320, 390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.route("https://**", (route) => route.abort());
    const html = renderToStaticMarkup(React.createElement(loaded.exports.default, { snapshot: academicReadinessFixture(state) }));
    await page.setContent(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body class="font-nunito"><div class="flex min-w-0"><aside class="w-14 md:w-56 lg:w-60 xl:w-64 shrink-0"></aside><div class="min-w-0 flex-1 p-4 md:p-6">${html}</div></div></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${state} overflow at ${width}px`);
    assert.equal(await page.locator("a,h2,h3,h4,p").evaluateAll((nodes) => nodes.filter((node) => { const b = node.getBoundingClientRect(); return b.left < 0 || b.right > innerWidth || node.scrollWidth > node.clientWidth + 1; }).length), 0, `${state} clipped text at ${width}px`);
    assert.equal(await page.evaluate(() => document.fonts.check('600 14px "Nunito"')), true);
    await page.screenshot({ path: resolve(`tmp/academic-readiness/${state}-${width}.png`), fullPage: true });
    console.log(`PASS academic readiness ${state} ${width}px`);
    await page.close();
  }
} finally { await browser.close(); }
