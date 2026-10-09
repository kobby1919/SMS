import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const runtime = process.env.EDUJAY_PLAYWRIGHT_PATH;
if (!runtime) throw new Error("Set EDUJAY_PLAYWRIGHT_PATH to an installed Playwright package.");
const { chromium } = require(runtime);
const rows = Array.from({ length: 4 }, (_, index) => ({
  student: { id: String(index), name: index === 0 ? "Alexandra-Abena" : "Student", surname: "Mensah-Agyemang", admissionNumber: "EDJ-2026-000123" },
  position: { ca: index ? null : 25.75, scored: index ? 0 : 1, expected: 2, examConfirmed: false, total: null, status: index ? "Not started" : "Incomplete" },
  examScore: 0, updatedAt: index ? null : new Date("2026-10-09T10:30:00Z"),
  progress: { buckets: [{ bucketId: 1, name: "Class exercises", aggregationMode: "AVERAGE_TO_BUCKET", earnedMarks: 25.75, allocationMarks: 30, activities: [{ id: 1, title: "Reading comprehension and written expression", teacherName: "Victoria Ama Mensah", activityDate: new Date("2026-10-08"), rawScore: index ? null : 9, rawMaxScore: 10, earnedMarks: index ? null : 27 }] }] },
}));
const data = { year: "2026/27", term: "TERM_1", classId: 1, subjectId: 2, classes: [{ id: 1, name: "Primary Six - Section A" }], configs: [{ academicYear: "2026/27" }], config: { classworkWeight: 30, examWeight: 70 }, subjects: [{ id: 2, name: "English Language" }], teacherNames: ["Victoria Ama Mensah"], search: "", rows, count: 4, page: 1, pageCount: 1, error: null };
const timetablePreview = process.env.EDUJAY_PREVIEW === "timetable";
const timetable = { publication: { version: 3, publishedAt: new Date("2026-10-09T10:00:00Z") }, classes: [{ id: 1, name: "Primary Six - Section A" }], teachers: [{ id: "t1", name: "Victoria Ama Mensah-Agyemang" }], uncoveredClasses: [{ id: 2, name: "Kindergarten One - Section B" }], unavailableTeachers: [{ id: "t1", name: "Victoria Ama Mensah-Agyemang" }], days: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"], selection: {}, error: null, totalLessons: 4, count: 4, page: 1, pageCount: 1, lessons: Array.from({ length: 4 }, (_, index) => ({ id: String(index), day: "MONDAY", startTime: new Date("1970-01-01T08:00:00Z"), endTime: new Date("1970-01-01T09:00:00Z"), className: "Primary Six - Section A", subjectName: "English Language and Written Expression", teacherName: "Victoria Ama Mensah-Agyemang" })) };
function load(path) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const imports = (id) => id === "@/src/lib/queries/admin-published-schedule" ? { getAdminPublishedSchedule: async () => timetable } : id === "@/src/lib/services/school-operating-hours" ? { dateTimeToTimeString: (date) => date.toISOString().slice(11, 16) } : id === "@/src/lib/queries/admin-assessment-review" ? { getAdminAssessmentReview: async () => data } : id === "@/src/components/AssessmentReviewFilters" ? load("src/components/AssessmentReviewFilters.tsx") : id === "next/link" ? { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) } : require(id);
  new Function("require", "module", "exports", code)(imports, module, module.exports);
  return module.exports;
}
const element = await load(timetablePreview ? "src/components/AdminPublishedSchedule.tsx" : "src/components/AdminAssessmentReview.tsx").default({ params: {} });
const html = renderToStaticMarkup(element);
const css = readFileSync("tmp/admin-assessment-review/preview.css", "utf8");
mkdirSync("tmp/admin-assessment-review", { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.EDUJAY_BROWSER_CHANNEL ? { channel: process.env.EDUJAY_BROWSER_CHANNEL } : {}) });
try {
  for (const width of [320, 390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.setContent(`<html><head><style>${css}</style></head><body style="background:#f3f4f6;font-family:Arial,sans-serif"><div style="display:flex;min-width:0">${html}</div></body></html>`);
    const evidence = page.locator("details").filter({ visible: true });
    if (await evidence.count()) await evidence.first().evaluate((node) => { node.open = true; });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, `Horizontal overflow at ${width}px`);
    const clipped = await page.locator("input,select,button").evaluateAll((nodes) => nodes.filter((node) => { const box = node.getBoundingClientRect(); return box.left < 0 || box.right > innerWidth; }).length);
    assert.equal(clipped, 0, `Clipped controls at ${width}px`);
    await page.screenshot({ path: resolve(`tmp/admin-assessment-review/${timetablePreview ? "timetable-" : ""}${width}.png`), fullPage: true });
    console.log(`PASS ${width}px: no horizontal overflow or clipped controls`);
    await page.close();
  }
} finally { await browser.close(); }
