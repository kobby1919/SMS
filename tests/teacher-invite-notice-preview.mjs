import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

const require = createRequire(import.meta.url);
const source = readFileSync("src/components/TeacherInviteResult.tsx", "utf8");
const activitySource = readFileSync("src/components/InviteEmailActivity.tsx", "utf8");
function compile(source) {
  const exports = {};
  new Function("exports", "require", ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText)(exports, require);
  return exports.default;
}
const Notice = compile(source);
const Activity = compile(activitySource);
const config = compile(readFileSync("tailwind.config.ts", "utf8"));
const css = (await postcss([tailwindcss({ ...config, content: [{ raw: source + activitySource, extension: "tsx" }] })])
  .process(readFileSync("src/app/globals.css", "utf8"), { from: undefined })).css;
const { chromium } = require(process.env.EDUJAY_PLAYWRIGHT_PATH ?? "C:/Users/KWABENA JUNIOR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
mkdirSync("tmp/teacher-invite-notice", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  for (const width of [320, 390, 1440]) {
    for (const emailStatus of ["SENT", "FAILED", "NOT_SENT"]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.route("http://typography.test/fonts/**", (route) => route.fulfill({
        body: readFileSync(path.join("public", new URL(route.request().url()).pathname)),
        contentType: "font/ttf",
      }));
      const html = renderToStaticMarkup(React.createElement(Notice, {
        invite: { email: "teacher.long-address@example.com", emailStatus, inviteUrl: "https://example.com/onboarding/teacher/accept?token=" + "synthetic".repeat(12) },
        copied: false, onCopy() {},
      }));
      await page.setContent(`<html><head><base href="http://typography.test/"><style>${css}</style></head><body><main style="max-width:720px;margin:auto;padding:16px">${html}</main></body></html>`);
      assert.equal(await page.locator("code").isVisible(), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `tmp/teacher-invite-notice/${emailStatus}-${width}.png` });
      await page.getByText("Share invitation manually", { exact: true }).click();
      assert.equal(await page.locator("code").isVisible(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.close();
    }
  }
  for (const width of [320, 390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const rows = ["ACCEPTED", "DELIVERED", "BOUNCED", "COMPLAINED", "FAILED", "NOT_SENT", "UNKNOWN", "DELAYED"].map((status, index) => ({
      kind: "TEACHER", inviteId: "synthetic-" + index, createdAt: new Date("2026-10-29T12:00:00Z"), invitationState: "Pending acceptance",
      metadata: { email: "teacher.long-address@example.com", attemptId: "synthetic-attempt-" + index, status, providerMessageId: "synthetic-provider-id", events: [{ status, at: "2026-10-29T12:00:00Z" }] },
    }));
    const html = renderToStaticMarkup(React.createElement(Activity, { rows }));
    await page.setContent(`<html><head><style>${css}</style></head><body><main style="max-width:1200px;margin:auto;padding:16px">${html}</main></body></html>`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator("summary:visible").first().click();
    await page.screenshot({ path: `tmp/teacher-invite-notice/activity-${width}.png` });
    await page.close();
  }
  console.log("12 notice/activity viewport checks passed; manual links stay collapsed by default and activity tables scroll within their container. No emails sent.");
} finally { await browser.close(); }
