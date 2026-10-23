import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.EDUJAY_PLAYWRIGHT_PATH);
const loaded = { exports: {} };
let configured = true;
const mocks = {
  "@sentry/nextjs": { captureMessage() {}, flush: async () => true },
  "@/src/lib/authz": { requirePageSession: async (roles) => assert.deepEqual(roles, ["platform_admin"]), requireRole: async () => {} },
  "@/src/lib/monitoring/privacy": { MONITORING_TEST_MESSAGE: "Edujay monitoring verification", monitoringOptions: () => ({ enabled: configured, environment: configured ? "production" : "unconfigured" }) },
  "next/navigation": { redirect() {} },
};
const source = ts.transpileModule(readFileSync("src/app/(dashboard)/platform/monitoring/page.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
new Function("require", "module", "exports", source)((id) => id in mocks ? mocks[id] : require(id), loaded, loaded.exports);
const css = readFileSync("tmp/error-monitoring/preview.css", "utf8");
mkdirSync("tmp/error-monitoring", { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
try {
  for (const state of ["configured", "unconfigured", "submitted", "unconfirmed"]) {
    configured = state !== "unconfigured";
    const content = await loaded.exports.default({ searchParams: Promise.resolve({ result: ["submitted", "unconfirmed"].includes(state) ? state : undefined }) });
    const markup = renderToStaticMarkup(React.createElement("div", { className: "min-h-screen bg-white text-gray-900" }, content));
    for (const width of [320, 390, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.setContent(`<html><head><style>${css}</style></head><body>${markup}</body></html>`);
      assert.equal(await page.locator("h1").textContent(), "Error monitoring");
      assert.equal(await page.getByRole("button", { name: "Send test alert" }).isDisabled(), !configured);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${state} overflow at ${width}`);
      assert.equal(await page.locator("button,dt,dd,h1,[role=status]").evaluateAll(nodes => nodes.some(node => {
        const rect = node.getBoundingClientRect();
        return rect.left < 0 || rect.right > innerWidth + 1 || node.scrollWidth > node.clientWidth + 1;
      })), false, `${state} clipped content at ${width}`);
      await page.screenshot({ path: resolve(`tmp/error-monitoring/${state}-${width}.png`), fullPage: true });
      await page.close();
      console.log(`PASS monitoring ${state} ${width}px`);
    }
  }
} finally { await browser.close(); }
