import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const nodeRequire = createRequire(import.meta.url);
const { chromium } = nodeRequire(process.env.EDUJAY_PLAYWRIGHT_PATH);
const data = {
  classes: [{ id: 1, name: "Primary Six - Section A" }], subjects: [{ id: 10, name: "English Language" }], years: ["2026/27"], year: "2026/27", term: "TERM_1", currentPeriod: true, activePeriodAvailable: true, publicationAvailable: true,
  error: null, selection: {}, view: process.env.EDUJAY_PREVIEW_VIEW ?? "coverage", page: 1, pageCount: 1, count: 4, totals: { guides: 3, published: 2, missing: 1 },
  guides: Array.from({ length: 4 }, (_, index) => ({ id: index + 1, gradeName: "Primary Six - Section A", subjectName: "English Language and Written Expression", status: index % 2 ? "DRAFT" : "PUBLISHED", planned: 12 })),
  rows: Array.from({ length: 4 }, (_, index) => ({ classId: index + 1, className: "Primary Six - Section A", subjectId: 10, subjectName: "English Language and Written Expression", guideId: index ? index : null, guideStatus: index ? "PUBLISHED" : null, planned: index ? 12 : 0, recorded: index ? 2 : 0, assignments: [{ name: "Victoria Ama Mensah-Agyemang", active: true }], gaps: index ? Array.from({ length: 10 }, (_, topic) => ({ id: topic + 1, title: "Reading comprehension and written expression", weekNumber: topic + 3, durationWeeks: 1 })) : [] })),
};
const detailMode = ["detail", "teacher-detail"].includes(data.view);
const teacherMode = data.view === "teacher-detail";
const guide = { id: 1, subjectId: 10, gradeId: 1, subject: { name: "English Language and Written Expression" }, grade: { level: "Primary Six" }, academicYear: "2026/27", term: "TERM_1", status: "PUBLISHED", description: "", topics: Array.from({ length: 3 }, (_, index) => ({ id: index + 1, title: "Reading comprehension and written expression", weekNumber: index + 1, durationWeeks: 1, subtopics: ["Reading fluency"], objectives: ["Read and explain a short passage"], coreCompetencies: [], teachingResources: "Reader and exercise book", progress: index ? [] : [{ id: 1, classId: 1, teacherId: "t1", coveredDate: new Date("2026-10-01T10:00:00Z"), notes: "Completed the first classroom exercise.", class: { name: "Primary Six - Section A" }, teacher: { name: "Victoria Ama", surname: "Mensah-Agyemang" } }] })) };
function load(path) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const imports = (id) => {
    if (id === "@/src/lib/queries/admin-curriculum") return { getAdminCurriculum: async () => data };
    if (id === "@/src/lib/authz") return { requirePageSession: async () => ({ schoolId: "a", userId: "t1", role: teacherMode ? "teacher" : "admin" }) };
    if (id === "@/src/lib/prisma") return { syllabus: { findFirst: async () => guide }, cAConfig: { findFirst: async () => ({ academicYear: "2026/27", currentTerm: "TERM_1" }) }, class: { findMany: async () => [{ id: 1, name: "Primary Six - Section A" }] } };
    if (id === "@/src/lib/services/timetable") return { listLiveTimetableLessons: async () => [{ subjectId: 10, classId: 1, teacher: { name: "Victoria Ama", surname: "Mensah-Agyemang" } }] };
    if (id === "@/src/components/SyllabusProgressCard") return load("src/components/SyllabusProgressCard.tsx");
    if (id === "@/src/lib/actions/syllabusActions") return {};
    if (id === "next/navigation") return { notFound: () => { throw new Error("Not found"); }, useRouter: () => ({ refresh: () => {} }) };
    if (id === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
    return nodeRequire(id);
  };
  new Function("require", "module", "exports", code)(imports, loaded, loaded.exports);
  return loaded.exports;
}
const component = load(detailMode ? "src/app/(dashboard)/list/syllabus/[id]/page.tsx" : "src/components/AdminCurriculum.tsx");
const html = renderToStaticMarkup(await component.default(detailMode ? { params: Promise.resolve({ id: "1" }), searchParams: Promise.resolve({}) } : { params: {} }));
const css = readFileSync("tmp/admin-assessment-review/preview.css", "utf8").replace(/url\("(\/fonts\/[^"\s]+)"\)/g, (_, path) => `url("data:font/ttf;base64,${readFileSync(resolve(`public${path}`)).toString("base64")}")`);
mkdirSync("tmp/curriculum-review", { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.EDUJAY_BROWSER_CHANNEL ?? "msedge" });
try {
  for (const width of [320, 390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.setContent(`<html><head><style>${css}</style></head><body class="font-nunito" style="background:#f3f4f6"><div style="display:flex;min-width:0">${html}</div></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.fonts.check('600 14px "Nunito"')), true);
    const details = page.locator("details");
    if (await details.count()) await details.first().evaluate((node) => { node.open = true; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow at ${width}px`);
    assert.equal(await page.locator("input,select,button").evaluateAll((nodes) => nodes.filter((node) => { const box = node.getBoundingClientRect(); return box.left < 0 || box.right > innerWidth; }).length), 0, `Clipped controls at ${width}px`);
    await page.screenshot({ path: resolve(`tmp/curriculum-review/${data.view}-${width}.png`), fullPage: true });
    console.log(`PASS ${data.view} ${width}px`);
    await page.close();
  }
} finally { await browser.close(); }
