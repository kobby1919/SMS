import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.EDUJAY_PLAYWRIGHT_PATH ?? "C:/Users/KWABENA JUNIOR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const origin = process.env.EDUJAY_PREVIEW_ORIGIN ?? "https://edujay.app";
assert.ok(["https://edujay.app", "http://127.0.0.1:3000"].includes(origin));
mkdirSync("tmp/typography/public", { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
try {
  for (const width of [390, 1440]) {
    for (const route of ["/", "/features", "/howItWorks", "/pricing", "/about", "/request-access", "/sign-in"]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const response = await page.goto(origin + route, { waitUntil: "domcontentloaded", timeout: 90000 });
      assert.equal(response.status(), 200, route);
      await page.locator("h1:visible,h2:visible").first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1200);
      const fonts = await page.evaluate(() => {
        const visible = (el) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
        const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(visible).map((el) => ({ text: el.textContent.trim().slice(0, 60), family: getComputedStyle(el).fontFamily }));
        const body = [...document.querySelectorAll("p")].find((el) => visible(el) && el.textContent.trim().length > 50);
        const controls = [...document.querySelectorAll("input,select,textarea,button,nav a")].filter(visible).map((el) => getComputedStyle(el).fontFamily);
        return { headings, body: body && getComputedStyle(body).fontFamily, controls, clashLoaded: document.fonts.check('700 20px "Clash Display"'), manropeLoaded: document.fonts.check('400 16px "Manrope"') };
      });
      assert.ok(fonts.headings.length > 0, route);
      for (const heading of fonts.headings) assert.ok(heading.family.includes("Clash Display"), `${route}: ${heading.text}: ${heading.family}`);
      if (fonts.body) assert.ok(fonts.body.includes("Manrope"), `${route} body: ${fonts.body}`);
      for (const family of fonts.controls) assert.ok(family.includes("Manrope"), `${route} control: ${family}`);
      assert.equal(fonts.clashLoaded, true);
      assert.equal(fonts.manropeLoaded, true);
      await page.screenshot({ path: `tmp/typography/public/${route === "/" ? "home" : route.slice(1)}-${width}.png`, fullPage: true });
      console.log(JSON.stringify({ route, width, headings: fonts.headings.length, bodyAndControlsManrope: true, loadedFontsVerified: true }));
      await page.close();
    }
  }
} finally { await browser.close(); }
