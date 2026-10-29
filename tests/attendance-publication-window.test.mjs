import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
function load(file, mocks = {}, extra = "") {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, "utf8") + extra, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", code)((id) => Object.hasOwn(mocks, id) ? mocks[id] : require(id), loaded, loaded.exports);
  return loaded.exports;
}
const { attendanceWindowForLesson } = load("src/lib/attendance-window.ts");
const settings = { allowEarlyAttendanceMarking: true, attendanceOpenMinutesBeforeLesson: 10, attendanceGraceMinutesAfterLesson: 10, attendanceEscalateMinutesAfterLesson: 30 };
const lesson = { startTime: new Date("2026-10-29T07:30:00Z"), endTime: new Date("2026-10-29T08:10:00Z") };
const date = new Date("2026-10-29T00:00:00Z");
const publishedAt = new Date("2026-10-29T21:57:03.553Z");
const window = (now, overrides = {}) => attendanceWindowForLesson({ date, lesson, settings, publishedAt, now: new Date(now), ...overrides });

test("evening publication does not turn the morning lesson into a missed duty", () => {
  const result = window("2026-10-29T22:10:00Z");
  assert.equal(result.status, "NOT_REQUIRED");
  assert.equal(result.allowed, false);
  assert.match(result.message, /No attendance duty or penalty/);
});

test("same-day future lessons do not receive an artificial whole-day exemption", () => {
  const result = window("2026-10-29T07:35:00Z", { publishedAt: new Date("2026-10-29T07:00:00Z") });
  assert.equal(result.status, "OPEN");
  assert.equal(result.allowed, true);
});

test("later scheduled dates follow opening, grace and escalation deadlines exactly", () => {
  const nextDate = new Date("2026-11-05T00:00:00Z");
  for (const [time, status, allowed] of [["07:19:59", "UPCOMING", false], ["07:20:00", "OPEN", true], ["08:20:00", "OPEN", true], ["08:20:01", "LATE", true], ["08:40:00", "LATE", true], ["08:40:01", "MISSED", false]]) {
    const result = window(`2026-11-05T${time}Z`, { date: nextDate });
    assert.equal(result.status, status);
    assert.equal(result.allowed, allowed);
  }
});

test("server enforcement uses the same publication-aware window", async () => {
  const service = load("src/lib/services/teacher-attendance-obligations.ts", {
    "@/src/lib/prisma": {}, "@/src/lib/attendance-review": {}, "@/src/lib/services/teacher-obligation-store": {}, "@/src/lib/services/school-operating-hours": {},
    "@/src/lib/attendance-window": { attendanceWindowForLesson },
    "@/src/lib/services/teacher-accountability-settings": { getTeacherAccountabilitySettings: async (schoolId) => { assert.equal(schoolId, "school-a"); return settings; } },
    "@/src/lib/services/timetable": { getLiveTimetableLessonBySourceId: async (schoolId, lessonId) => { assert.equal(schoolId, "school-a"); assert.equal(lessonId, 9); return lesson; }, getActiveTimetablePublication: async () => ({ publishedAt }) },
  });
  const result = await service.evaluateAttendanceWindow({ schoolId: "school-a", lessonId: 9, date, now: new Date("2026-10-29T22:10:00Z") });
  assert.equal(result.status, "NOT_REQUIRED");
  assert.equal(result.allowed, false);
});

function taker() {
  return load("src/components/AttendanceTaker.tsx", {
    "next/navigation": { useRouter: () => ({ push() {}, refresh() {} }) },
    "next/image": { __esModule: true, default: () => null },
    "@/src/components/AttendanceCorrectionRequestForm": { __esModule: true, default: () => null },
  }, "\nexport { getLessonUiGroup };\n");
}

test("missing obligation does not make pre-publication or expired attendance editable", () => {
  const { getLessonUiGroup } = taker();
  const markingWindow = { ...window("2026-10-29T22:10:00Z"), openAt: "2026-10-29T07:20:00Z", missedAt: "2026-10-29T08:40:00Z" };
  assert.equal(getLessonUiGroup({ markingWindow }, new Date("2026-10-29T22:10:00Z")), "notRequired");
  assert.equal(getLessonUiGroup({ markingWindow: { ...markingWindow, status: "OPEN" } }, new Date("2026-10-29T22:10:00Z")), "issue");
});

test("attendance form labels exempt lessons neutrally and disables normal saving", async () => {
  const Component = taker().default;
  const result = window("2026-10-29T22:10:00Z");
  const html = renderToStaticMarkup(React.createElement(Component, {
    teacherLessons: [{ id: 9, subjectName: "English", className: "QA Primary 1A", classId: 1, day: "THURSDAY", startTime: lesson.startTime.toISOString(), endTime: lesson.endTime.toISOString(), accountability: null, markingWindow: { ...result, openAt: result.openAt.toISOString(), missedAt: result.missedAt.toISOString() } }],
    selectedLessonId: 9, selectedLesson: { id: 9, subjectName: "English", className: "QA Primary 1A" }, students: [{ id: "student-a", name: "Test", surname: "Student", img: null }], existingAttendance: [], pendingAttendanceCorrectionIds: [], hasAttendanceCorrectionRequest: false, dateStr: "2026-10-29", todayStr: "2026-10-29", role: "teacher",
  }));
  assert.match(html, /Not required/);
  assert.match(html, /No attendance duty or penalty/);
  assert.doesNotMatch(html, /Admin correction needed/);
  assert.match(html, /Attendance not required/);
  assert.doesNotMatch(html, /Save attendance/);
  if (process.env.EDUJAY_ATTENDANCE_PREVIEW === "1") {
    const postcss = require("postcss");
    const tailwindcss = require("tailwindcss");
    const config = load("tailwind.config.ts").default;
    const css = (await postcss([tailwindcss({ ...config, content: [{ raw: readFileSync("src/components/AttendanceTaker.tsx", "utf8"), extension: "tsx" }] })]).process(readFileSync("src/app/globals.css", "utf8"), { from: undefined })).css;
    const { chromium } = require("C:/Users/KWABENA JUNIOR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
    const browser = await chromium.launch({ channel: "msedge", headless: true });
    mkdirSync("tmp/attendance-publication", { recursive: true });
    try {
      for (const width of [320, 390, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 1000 } });
        await page.setContent(`<html><head><style>${css}</style></head><body><main style="padding:16px">${html}</main></body></html>`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.equal(await page.getByRole("button", { name: "Save attendance", exact: true }).count(), 0);
        assert.equal(await page.getByText("Not required", { exact: true }).first().isVisible(), true);
        await page.screenshot({ path: `tmp/attendance-publication/${width}.png`, fullPage: true });
        await page.close();
      }
    } finally { await browser.close(); }
  }
});

test("dashboard distinguishes no rated duties from successful completion", () => {
  const source = readFileSync("src/app/(dashboard)/teacher/page.tsx", "utf8");
  assert.match(source, /No required duties are recorded for today/);
  assert.match(source, /Reliability is not rated yet/);
  assert.match(source, /!attendanceEscalated && window.allowed/);
});
