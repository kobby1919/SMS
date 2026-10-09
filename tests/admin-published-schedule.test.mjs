import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);
function load(path, mocks) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)((id) => Object.hasOwn(mocks, id) ? mocks[id] : id === "server-only" ? {} : nodeRequire(id), module, module.exports);
  return module.exports;
}
function fixture({ empty = false, many = false } = {}) {
  const queries = [];
  const lessons = Array.from({ length: many ? 35 : 2 }, (_, index) => ({ id: `p${index}`, sourceId: index + 1, teacherId: "t1", teacherName: "Victoria Mensah", classId: 1, className: "Primary Six", subjectName: "Math", name: "Math", day: index % 2 ? "MONDAY" : "FRIDAY", startTime: new Date("1970-01-01T08:00:00Z"), endTime: new Date("1970-01-01T09:00:00Z") }));
  const tx = {
    timetablePublication: { findFirst: async (q) => { queries.push(q); return empty ? null : { id: "publication-a", version: 1, lessons }; } },
    class: { findMany: async (q) => { queries.push(q); return [{ id: 1, name: "Primary Six", _count: { students: 10 } }, { id: 2, name: "KG1", _count: { students: 5 } }, { id: 3, name: "Empty class", _count: { students: 0 } }]; } },
    teacher: { findMany: async (q) => { queries.push(q); return [{ id: "t1", status: "SUSPENDED" }]; } },
  };
  const service = load("src/lib/queries/admin-published-schedule.ts", {
    "@/src/lib/authz": { requireRole: async (roles) => { assert.deepEqual(roles, ["admin"]); return { schoolId: "school-a" }; } },
    "@/src/lib/prisma": { $transaction: async (work, options) => { assert.equal(options.isolationLevel, "RepeatableRead"); return work(tx); } },
  });
  return { service, queries };
}
test("published view reads one authorized publication, never draft or archived lessons", async () => {
  const f = fixture();
  const result = await f.service.getAdminPublishedSchedule({});
  assert.equal(result.lessons[0].day, "MONDAY");
  assert.ok(f.queries.every((q) => q.where.schoolId === "school-a"));
  assert.equal(f.queries[0].where.status, "ACTIVE");
  assert.equal(f.queries[0].select.lessons.where.schoolId, "school-a");
  assert.deepEqual(result.uncoveredClasses.map((cls) => cls.id), [2]);
  assert.deepEqual(result.unavailableTeachers.map((teacher) => teacher.id), ["t1"]);
});
test("foreign or malformed filters cannot expose a schedule selection", async () => {
  for (const params of [{ classId: "999" }, { teacherId: "school-b-teacher" }, { classId: ["1"] }, { day: "INVALID" }, { page: "0" }]) {
    const result = await fixture().service.getAdminPublishedSchedule(params);
    assert.ok(result.error);
    assert.equal(result.lessons.length, 0);
  }
});
test("published schedule filters and pagination retain valid counts and clamp empty pages", async () => {
  const f = fixture({ many: true });
  const result = await f.service.getAdminPublishedSchedule({ page: "999", classId: "1", search: "Victoria" });
  assert.equal(result.page, 2);
  assert.equal(result.count, 35);
  assert.equal(result.lessons.length, 5);
  const day = await f.service.getAdminPublishedSchedule({ day: "MONDAY" });
  assert.ok(day.lessons.every((lesson) => lesson.day === "MONDAY"));
});
test("unpublished schools have an honest empty state without draft fallback", async () => {
  const result = await fixture({ empty: true }).service.getAdminPublishedSchedule({});
  assert.equal(result.publication, null);
  assert.equal(result.totalLessons, 0);
  assert.equal(result.lessons.length, 0);
});
test("draft checks identify inactive teachers and do not call an empty draft healthy", async () => {
  const make = (empty) => load("src/lib/services/timetable-health.ts", {
    "@/src/lib/prisma": { class: { findMany: async () => [] }, lesson: { findMany: async () => empty ? [] : [{ id: 1, day: "MONDAY", classId: 1, teacherId: "t1", subjectId: 2, startTime: new Date("1970-01-01T08:00Z"), endTime: new Date("1970-01-01T09:00Z"), subject: { name: "Math" }, class: { name: "Primary Six", _count: { students: 2 } }, teacher: { name: "Victoria", surname: "Mensah", status: "SUSPENDED", subjects: [{ id: 2 }] }, periodTemplate: { name: "Period 1", type: "TEACHING", startTime: "08:00", endTime: "09:00", isActive: true } }] } },
    "@/src/lib/services/school-operating-hours": { dateTimeToTimeString: (date) => date.toISOString().slice(11, 16), timeToMinutes: (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3)), isTimeRangeWithinWindow: () => true, formatSchoolDayRange: () => "Monday", getSchoolOperatingWindowStatus: async () => ({ activeDays: ["MONDAY"], openingTime: "08:00", closingTime: "15:00" }) },
  });
  assert.equal((await make(true).getTimetableHealthSummary("a")).status, "NEEDS_REVIEW");
  const result = await make(false).getTimetableHealthSummary("a");
  assert.equal(result.status, "CRITICAL");
  assert.ok(result.issues.some((issue) => issue.id === "inactive-teacher-1"));
});

test("old admin lessons destination preserves filter links into the consolidated timetable", () => {
  const source = readFileSync("src/app/(dashboard)/list/lessons/page.tsx", "utf8");
  assert.match(source, /role === "admin"/);
  assert.match(source, /redirect\(`\/admin\/timetable\?\$\{query\}`\)/);
  const menu = readFileSync("src/components/MenuClient.tsx", "utf8");
  assert.match(menu, /label: "Published Lessons",\s+href: "\/list\/lessons",\s+visible: \["teacher"\]/);
});
