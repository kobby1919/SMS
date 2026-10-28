import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.EDUJAY_PLAYWRIGHT_PATH ?? "C:/Users/KWABENA JUNIOR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const code = ts.transpileModule(readFileSync("src/components/PostImportInvitePanel.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const css = readFileSync("tmp/admin-assessment-review/preview.css", "utf8");
mkdirSync("tmp/post-import-invites", { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
try {
  for (const mode of ["success", "partial", "console"]) {
    const result = { role: "teachers", created: 2, skipped: 0, failed: 0,
      emailsAccepted: mode === "success" ? 2 : mode === "partial" ? 1 : 0,
      emailsFailed: mode === "partial" ? 1 : 0, emailsNotSent: mode === "console" ? 2 : 0,
      warnings: mode === "partial" ? ["a-long-recipient-address-for-layout-checking@example.com: Email sending failed. Check the recipient address before retrying the existing invitation."] : mode === "console" ? ["Email delivery is not configured. The invitation was prepared but no email was sent."] : [],
    };
    let index = 0;
    const loaded = { exports: {} };
    new Function("require", "exports", code)((id) => id === "react" ? {
      useMemo: (work) => work(), useState: (initial) => [index++ === 1 ? result : initial, () => {}],
    } : require(id), loaded.exports);
    const summary = { items: ["teachers", "parents", "bursars"].map((role) => ({ role, label: role[0].toUpperCase() + role.slice(1), importedNeedsInvite: 2, invited: 0, active: 0, blocked: 0, blockedReason: "" })) };
    const html = renderToStaticMarkup(React.createElement(loaded.exports.default, { summary }));
    assert.ok(html.includes("Provider acceptance does not confirm delivery."));
    assert.ok(html.includes(mode === "success" ? "border-emerald-100" : "border-amber-200"));
    for (const width of [320, 390, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      await page.setContent(`<html><head><style>${css}</style></head><body style="margin:0"><main style="max-width:1200px;margin:auto;padding:12px">${html}</main></body></html>`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${mode} overflow at ${width}`);
      assert.equal(await page.locator('[role="status"]').count(), 1);
      await page.screenshot({ path: `tmp/post-import-invites/${mode}-${width}.png`, fullPage: true });
      await page.close();
    }
  }
  console.log("12 responsive invitation-result previews passed; no external email or database calls.");
} finally { await browser.close(); }
