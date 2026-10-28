import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const origin = process.env.EDUJAY_PREVIEW_ORIGIN ?? "http://localhost:3000";
assert.ok(["http://localhost:3000", "https://edujay.app"].includes(origin));
const { chromium } = require(process.env.EDUJAY_PLAYWRIGHT_PATH ?? "C:/Users/KWABENA JUNIOR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
mkdirSync("tmp/marketing-navbar", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
  await page.goto(origin + "/features", { waitUntil: "domcontentloaded", timeout: 120000 });
  const nav = page.getByRole("navigation", { name: "Main navigation", exact: true });
  const features = nav.getByRole("link", { name: "Features", exact: true }).first();
  const pricing = nav.getByRole("link", { name: "Pricing", exact: true }).first();
  await features.waitFor();
  await page.evaluate(() => document.fonts.ready);
  const underline = (link) => link.locator(".marketing-nav-label").evaluate((el) => {
    const style = getComputedStyle(el, "::after");
    return { transform: style.transform, duration: style.transitionDuration, origin: style.transformOrigin };
  });
  assert.equal(await features.getAttribute("aria-current"), "page");
  assert.equal((await underline(features)).transform, "matrix(1, 0, 0, 1, 0, 0)");
  assert.equal((await underline(pricing)).transform, "matrix(0, 0, 0, 1, 0, 0)");
  const before = await pricing.boundingBox();
  const textColor = await pricing.evaluate((el) => getComputedStyle(el).color);
  assert.equal((await underline(pricing)).duration, "0.8s, 0.4s");
  // Observe real animation frames, not just the completed hover state.
  const [frames] = await Promise.all([
    pricing.locator(".marketing-nav-label").evaluate(async (el) => {
      const frames = [];
      const start = performance.now();
      while (performance.now() - start < 1000) {
        await new Promise(requestAnimationFrame);
        const style = getComputedStyle(el, "::after");
        frames.push(new DOMMatrixReadOnly(style.transform).a);
      }
      return frames;
    }),
    page.mouse.move(before.x + before.width / 2, before.y + before.height / 2),
  ]);
  const intermediate = frames.filter((scale) => scale > 0.02 && scale < 0.98);
  assert.ok(new Set(intermediate.map((scale) => scale.toFixed(2))).size >= 4, "Underline must visibly grow through multiple animation frames");
  assert.ok(intermediate.every((scale, i) => i === 0 || scale >= intermediate[i - 1]), "Underline must grow smoothly");
  assert.equal((await underline(pricing)).transform, "matrix(1, 0, 0, 1, 0, 0)");
  assert.equal(await pricing.evaluate((el) => getComputedStyle(el).color), textColor, "Hover must not change link text color");
  assert.ok((await underline(pricing)).origin.startsWith("0px"), "Reveal must originate at the left");
  assert.deepEqual(await pricing.boundingBox(), before, "Hover must not shift navigation");
  await page.screenshot({ path: "tmp/marketing-navbar/desktop-hover.png" });
  await page.mouse.move(1400, 800);
  await page.waitForTimeout(900);
  assert.equal((await underline(pricing)).transform, "matrix(0, 0, 0, 1, 0, 0)");
  assert.ok((await underline(pricing)).origin.startsWith("0px"), "Retraction must remain anchored at the left");
  await pricing.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await page.waitForTimeout(900);
  assert.equal(await pricing.evaluate((el) => el.matches(":focus-visible")), true);
  assert.equal((await underline(pricing)).transform, "matrix(1, 0, 0, 1, 0, 0)");
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(450);
  assert.equal(await nav.getAttribute("data-marketing-light"), "true");
  assert.equal(await pricing.evaluate((el) => getComputedStyle(el).color), "rgb(75, 85, 99)");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal((await underline(pricing)).duration, "0s");
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = nav.locator('[aria-hidden]');
  assert.equal(await panel.evaluate((el) => el.inert), true);
  await nav.getByRole("button", { name: "Toggle menu" }).click();
  await page.waitForTimeout(450);
  assert.equal(await panel.evaluate((el) => el.inert), false);
  const mobileFeatures = panel.getByRole("link", { name: "Features", exact: true });
  assert.equal(await mobileFeatures.getAttribute("aria-current"), "page");
  assert.equal(await mobileFeatures.evaluate((el) => getComputedStyle(el).animationName), "none");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: "tmp/marketing-navbar/mobile-menu.png" });
  await panel.getByRole("link", { name: "Pricing", exact: true }).click();
  await page.waitForURL("**/pricing", { timeout: 120000 });
  assert.equal(await page.getByRole("button", { name: "Toggle menu" }).getAttribute("aria-expanded"), "false");
  console.log("Passed: 800ms underline, unchanged hover text color, intermediate animation frames, active page, keyboard focus, light background, stable layout, reduced motion and mobile navigation.");
} finally {
  await browser.close();
}
