import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const file = "src/components/ParentInviteModal.tsx";
const email = "guardian@example.com";
const wards = ["one", "two"].map((id) => ({ id, name: "Child", surname: id, className: "Primary 1" }));
const profile = { id: "par_imported", name: "Saved", surname: "Guardian", sex: "FEMALE", phone: "0240000000", hasAccount: false, wards };
function render({ formEmail = email, result = { ok: true, profile } } = {}) {
  let state = 0;
  const values = [true, { name: "Saved", surname: "Guardian", sex: "FEMALE", email: formEmail, phone: "0240000000", studentIds: [] }, "", null, false, { email, result }];
  const loaded = { exports: {} };
  const mocks = {
    react: { ...React, useState: () => [values[state++], () => {}], useMemo: (fn) => fn(), useEffect() {}, useTransition: () => [false, () => {}] },
    "next/navigation": { useRouter: () => ({ refresh() {} }) },
    "@/src/lib/actions/parentInviteActions": {},
    "@/src/components/ParentWardLinkManager": { __esModule: true, default: () => React.createElement("button", { type: "button" }, "Add another ward") },
  };
  const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", source)((id) => mocks[id] ?? require(id), loaded, loaded.exports);
  return renderToStaticMarkup(React.createElement(loaded.exports.default, { students: wards }));
}
function createButton(html) {
  return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find((match) => /Create invite/.test(match[2]));
}

test("matched parent shows saved wards without asking for ward selection", async () => {
  const html = render();
  assert.match(html, /Linked wards/);
  assert.match(html, /Child one/);
  assert.match(html, /Child two/);
  assert.doesNotMatch(html, /type="checkbox"/);
  assert.match(html, /Add another ward/);
  assert.doesNotMatch(html.match(/<select[^>]*>/)?.[0] ?? "", /disabled=""/);
  assert.doesNotMatch(html.match(/<input[^>]*placeholder="0240000000"[^>]*>/)?.[0] ?? "", /disabled=""/);
  assert.doesNotMatch(createButton(html)[1], / disabled=""/);
  if (process.env.EDUJAY_PARENT_INVITE_PREVIEW === "1") {
    const postcss = require("postcss"), tailwindcss = require("tailwindcss");
    const config = { exports: {} };
    new Function("module", "exports", ts.transpileModule(readFileSync("tailwind.config.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(config, config.exports);
    const css = (await postcss([tailwindcss({ ...config.exports.default, content: [{ raw: readFileSync(file, "utf8"), extension: "tsx" }] })]).process(readFileSync("src/app/globals.css", "utf8"), { from: undefined })).css;
    const { chromium } = require("C:/Users/KWABENA JUNIOR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
    const browser = await chromium.launch({ headless: true, channel: "msedge" });
    mkdirSync("tmp/parent-invite-wards", { recursive: true });
    try {
      for (const width of [320, 390, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 950 } });
        await page.setContent(`<html><head><style>${css}</style></head><body>${html}</body></html>`);
        assert.equal(await page.getByRole("checkbox").count(), 0);
        assert.equal(await page.getByRole("button", { name: "Create invite", exact: true }).isEnabled(), true);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({ path: `tmp/parent-invite-wards/${width}.png`, fullPage: true });
        await page.close();
      }
    } finally { await browser.close(); }
  }
});

test("new parents retain explicit ward selection", () => {
  const html = render({ result: { ok: true, profile: null } });
  assert.match(html, /type="checkbox"/);
  assert.doesNotMatch(html, />Linked wards</);
});

test("stale lookup results cannot display another email's ward links", () => {
  const html = render({ formEmail: "other@example.com" });
  assert.doesNotMatch(html, />Linked wards</);
  assert.match(html, /Checking existing parent/);
  assert.match(createButton(html)[1], / disabled=""/);
});

test("registered parents, missing links and lookup errors cannot submit a fresh invitation", () => {
  for (const result of [{ ok: true, profile: { ...profile, hasAccount: true } }, { ok: true, profile: { ...profile, wards: [] } }, { ok: false, message: "Lookup failed" }]) {
    assert.match(createButton(render({ result }))[1], / disabled=""/);
  }
});
