import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.EDUJAY_PLAYWRIGHT_PATH);
function load(path) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)((id) => id === "next/link" ? { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) } : id === "next/navigation" ? { useRouter: () => ({ refresh: () => {} }) } : id === "@/src/lib/actions/caActions" ? {} : id === "@/src/lib/caGrades" ? { TERM_LABELS: { TERM_1: "Term 1", TERM_2: "Term 2", TERM_3: "Term 3" } } : id.startsWith("@/") ? load(`${id.slice(2)}.tsx`) : require(id), loaded, loaded.exports);
  return loaded.exports;
}
const component = load("src/components/AdminReportReview.tsx").default;
const now = new Date("2026-10-12T12:00:00Z");
const rows = ["MISSING_CA", "STALE_TOTAL", "MISSING_EXAM"].map((reason, index) => ({ studentId: `s${index}`, studentName: "Victoria Ama Mensah-Agyemang", subjectId: 1, subjectName: "English Language and Written Expression", reason, detail: reason === "MISSING_EXAM" ? "No confirmed exam score. A legacy zero does not prove an exam was entered." : "CA incomplete: 2/4 activity scores; allocation must match the configured CA weight." }));
const base = { classes: [{ id: 1, name: "Primary Six - Section A" }], configs: [{ academicYear: "2026/27", isActive: true, currentTerm: "TERM_1" }], year: "2026/27", term: "TERM_1", classId: 1, error: null, readiness: { currentPeriod: true, issues: [], isReady: false, studentCount: 24, subjectCount: 5, readyEntryCount: 117, expectedEntryCount: 120, readyStudentCount: 21, missingCount: 3, missingCACount: 2, missingExamCount: 1 }, publication: { id: 1, status: "SUBMITTED", updatedAt: now, submittedAt: now }, audit: [{ id: 1, message: "Primary Six - Section A: submitted for review.", createdAt: now }], submittedByName: "Victoria Ama Mensah-Agyemang", rows, page: 1, pageCount: 1 };
const css = readFileSync("tmp/admin-assessment-review/preview.css", "utf8").replace(/url\("(\/fonts\/[^"\s]+)"\)/g, (_, path) => `url("data:font/ttf;base64,${readFileSync(resolve(`public${path}`)).toString("base64")}")`);
base.examStatus = "LOCKED";
base.readiness.examRequired = true;
mkdirSync("tmp/admin-reports-review", { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
try {
  for (const state of ["SUBMITTED", "PUBLISHED", "PREPARING", "EMPTY"]) for (const width of [320, 390, 768, 1440]) {
    const data = state === "EMPTY" ? { ...base, readiness: null, rows: [], publication: null } : { ...base, publication: state === "PREPARING" ? null : { ...base.publication, status: state } };
    const html = renderToStaticMarkup(React.createElement(component, { data }));
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.setContent(`<html><head><style>${css}</style></head><body class="font-nunito"><div class="flex min-w-0"><aside class="w-14 md:w-56 lg:w-60 xl:w-64 shrink-0"></aside><div data-dashboard-content class="min-w-0 flex-1">${html}</div></div></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.fonts.check('600 14px "Nunito"')), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${state} overflow at ${width}px`);
    assert.equal(await page.locator("input,select,button,textarea").evaluateAll((nodes) => nodes.filter((node) => { const b = node.getBoundingClientRect(); return b.left < 0 || b.right > innerWidth; }).length), 0, `${state} clipped controls at ${width}px`);
    if (state !== "EMPTY") assert.ok((await page.locator('a[href^="/list/ca?"]').first().getAttribute("href")).includes("studentId=s0"));
    await page.screenshot({ path: resolve(`tmp/admin-reports-review/${state}-${width}.png`), fullPage: true });
    console.log(`PASS reports ${state} ${width}px`);
    await page.close();
  }
} finally { await browser.close(); }
