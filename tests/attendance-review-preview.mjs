import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.EDUJAY_PLAYWRIGHT_PATH);
const loaded = { exports: {} };
const code = ts.transpileModule(readFileSync("src/components/AdminAttendanceReview.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
new Function("require", "module", "exports", code)((id) => id === "next/link" ? { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) } : require(id), loaded, loaded.exports);
const student = { id: "s1", name: "Victoria Ama", surname: "Mensah-Agyemang", classId: 1 };
const rows = ["PRESENT", "LATE", "ABSENT", "UNKNOWN"].map((status, index) => ({ student: { ...student, id: `s${index}` }, className: "Primary Six - Section A", status, marked: status === "ABSENT" ? 5 : 3, expected: 5, absentDays: 4 }));
const data = { error: null, selection: {}, date: "2026-10-12", today: "2026-10-12", since: "2026-09-13", timezone: "Africa/Accra", publication: { id: "p1" }, operatingDay: true, ambiguous: false, classes: [{ id: 1, name: "Primary Six - Section A" }], totals: { PRESENT: 12, LATE: 2, ABSENT: 1, EXCUSED: 0, UNKNOWN: 9, NO_LESSONS: 0 }, rosterCount: 24, page: 1, pageCount: 1, count: 24, rows, recurring: [rows[2]], recurringCount: 1, selectedStudent: student, history: rows.map((row, index) => ({ date: `2026-10-0${index + 1}`, className: index === 3 ? "Class not recorded" : row.className, marked: index === 3 ? 0 : row.marked, expected: index === 3 ? null : row.expected, status: row.status, unmatched: index === 3 ? 1 : 0 })), lessons: ["COMPLETE", "UPCOMING", "WINDOW_CLOSED", "HISTORICAL", "REVIEW"].map((state, index) => ({ sourceId: index, className: "Primary Six - Section A", subjectName: "English Language and Written Expression", teacherName: "Victoria Ama Mensah-Agyemang", state, marked: state === "COMPLETE" ? 24 : state === "UPCOMING" ? 0 : 4, recorded: state === "REVIEW" ? 26 : state === "COMPLETE" ? 24 : 4, expected: state === "HISTORICAL" ? null : 24, startTime: new Date("1970-01-01T08:00:00Z"), endTime: new Date("1970-01-01T09:00:00Z") })) };
const html = renderToStaticMarkup(React.createElement(loaded.exports.default, { data }));
const css = readFileSync("tmp/admin-assessment-review/preview.css", "utf8").replace(/url\("(\/fonts\/[^"\s]+)"\)/g, (_, path) => `url("data:font/ttf;base64,${readFileSync(resolve(`public${path}`)).toString("base64")}")`);
mkdirSync("tmp/attendance-review", { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
try {
  for (const width of [320, 390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.setContent(`<html><head><style>${css}</style></head><body class="font-nunito">${html}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.fonts.check('600 14px "Nunito"')), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow at ${width}px`);
    assert.equal(await page.locator("input,select,button").evaluateAll((nodes) => nodes.filter((node) => { const b = node.getBoundingClientRect(); return b.left < 0 || b.right > innerWidth; }).length), 0, `Clipped controls at ${width}px`);
    await page.screenshot({ path: resolve(`tmp/attendance-review/${width}.png`), fullPage: true });
    console.log(`PASS attendance ${width}px`);
    await page.close();
  }
} finally { await browser.close(); }
