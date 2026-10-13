import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.EDUJAY_PLAYWRIGHT_PATH);
let role = "admin", available = true, reads = 0;
const now = new Date("2026-10-12T12:00:00Z");
const bill = {
  id: 26, status: "PARTIAL", totalAmount: 1234567.89, amountPaid: 234567.89, balance: 1000000, discountAmount: 0, notes: "PAYMENT-REFERENCE-" + "1234567890".repeat(8),
  student: { id: "s1", name: "Alexandra-Abena", surname: "Mensah-Agyemang", img: null, class: { name: "Primary Six - Section A" }, grade: { level: 6 }, parent: { name: "Samuel", surname: "Mensah", phone: "+233201234567" } },
  feeStructure: { id: 1, title: "Term one tuition and compulsory charges", term: "TERM_1", academicYear: "2026/27" },
  lineItems: [{ id: 1, amount: 1234567.89, amountPaid: 234567.89, isPaid: false, feeItem: { name: "Tuition and educational materials", category: "TUITION", isOptional: false } }],
  payments: [{ id: 1, amount: 234567.89, status: "CONFIRMED", method: "CASH", paymentDate: now, createdAt: now, receiptNumber: "EDJ-" + "1".repeat(40) }],
  discounts: [],
  financeQueries: [{ id: 1, reason: "NEED_CLARIFICATION", status: "OPEN", parent: { name: "Samuel", surname: "Mensah" }, payment: null, message: "Please clarify this charge.", response: null }],
};
const mocks = {
  "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
  "next/image": { __esModule: true, default: (props) => { const attributes = { ...props }; delete attributes.priority; delete attributes.unoptimized; return React.createElement("img", attributes); } },
  "next/navigation": { usePathname: () => "/list/finance/bills/26", useRouter: () => ({ refresh() {} }), redirect: (url) => { throw new Error(url); } },
  "@/src/lib/authz": { requirePageSession: async (roles) => { if (roles && !roles.includes(role)) throw new Error("Forbidden"); return { role, schoolId: "school-a", userId: "u1" }; } },
  "@/src/lib/prisma": { __esModule: true, default: { studentBill: { findFirst: async ({ where }) => { reads++; assert.equal(where.schoolId, "school-a"); assert.equal(where.student.schoolId, "school-a"); assert.equal(where.feeStructure.schoolId, "school-a"); return available ? bill : null; } } } },
  "@/src/components/Navbar": { __esModule: true, default: () => React.createElement("div", { className: "h-16" }) },
  "@/src/components/NavigationProgress": { __esModule: true, default: () => null },
};
function load(path) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)((id) => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith("@/src/lib/actions/") ? {} : id.startsWith("@/") || id.startsWith("./") ? (() => {
    const base = id.startsWith("@/") ? id.slice(2) : resolve(path, "..", id);
    if (id === "@/src/generated/prisma") return require(resolve(base));
    return load(existsSync(base + ".tsx") ? base + ".tsx" : base + ".ts");
  })() : require(id), loaded, loaded.exports);
  return loaded.exports;
}
const Page = load("src/app/(dashboard)/list/finance/bills/[id]/page.tsx").default;
const Layout = load("src/app/(dashboard)/layout.tsx").default;
const ErrorPage = load("src/components/PageRecoveryError.tsx").default;
const Table = load("src/components/Table.tsx").default;
const css = readFileSync("tmp/admin-assessment-review/preview.css", "utf8");
mkdirSync("tmp/page-recovery", { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
try {
  for (const state of ["admin", "bursar", "missing", "invalid", "error", "table"]) for (const width of [320, 390, 768, 1024, 1440]) {
    role = state === "bursar" ? "bursar" : "admin";
    available = state !== "missing";
    const before = reads;
    const content = state === "error" ? React.createElement(ErrorPage, { reset() {} }) : state === "table" ? React.createElement(Table, { columns: [{ header: "Student", accessor: "name" }], data: [1], renderRow: (id) => React.createElement("tr", { key: id }, React.createElement("td", { className: "whitespace-nowrap" }, "Reference-" + "1234567890".repeat(30))) }) : await Page({ params: Promise.resolve({ id: state === "invalid" ? "26bad" : "26" }) });
    if (state === "invalid") assert.equal(reads, before);
    const html = renderToStaticMarkup(await Layout({ children: content }));
    if (state === "admin") assert.doesNotMatch(html, /Waive Bill|Apply discount|Mark resolved|Record Payment/);
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.route("http://edujay.test/**", async (route) => {
      const publicRoot = resolve("public");
      const asset = resolve(publicRoot, "." + decodeURIComponent(new URL(route.request().url()).pathname));
      if (!asset.startsWith(publicRoot + "/") && !asset.startsWith(publicRoot + "\\")) return route.fulfill({ status: 404 });
      if (!existsSync(asset)) return route.fulfill({ status: 404 });
      const contentType = asset.endsWith(".png") ? "image/png" : asset.endsWith(".ttf") ? "font/ttf" : asset.endsWith(".woff2") ? "font/woff2" : "application/octet-stream";
      await route.fulfill({ contentType, body: readFileSync(asset) });
    });
    await page.setContent(`<html><head><base href="http://edujay.test/"><style>${css}</style></head><body class="font-nunito">${html}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => document.fonts.load('600 14px "Nunito"'));
    assert.equal(await page.evaluate(() => document.fonts.check('600 14px "Nunito"')), true);
    assert.equal(await page.locator("img").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)), true, `${state} missing image`);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll("[data-dashboard-content]")].some((node) => node.scrollWidth > node.clientWidth + 1)), false, `${state} content overflow at ${width}px`);
    assert.equal(await page.locator("input,select,textarea,button,a").evaluateAll((nodes) => nodes.filter((node) => { const b = node.getBoundingClientRect(); return b.width && (b.left < -1 || b.right > innerWidth + 1); }).length), 0, `${state} clipped controls at ${width}px`);
    if (width === 320 && ["admin", "bursar"].includes(state)) {
      assert.ok(await page.locator("h1").evaluate((heading) => heading.getBoundingClientRect().width >= 170), "Student name must have a readable mobile line width");
      assert.ok(await page.getByText("Parent / Guardian", { exact: true }).evaluate((label) => label.getBoundingClientRect().width >= 100), "Parent contact must not be squeezed by the phone number");
    }
    await page.screenshot({ path: resolve(`tmp/page-recovery/${state}-${width}.png`), fullPage: true });
    console.log(`PASS ${state} shell ${width}px`);
    await page.close();
  }
} finally { await browser.close(); }
