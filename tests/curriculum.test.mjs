import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const nodeRequire = createRequire(import.meta.url);
function load(path, mocks) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)((id) => Object.hasOwn(mocks, id) ? mocks[id] : id === "server-only" ? {} : nodeRequire(id), loaded, loaded.exports);
  return loaded.exports;
}
function review({ empty = false } = {}) {
  const queries = [];
  const classes = [{ id: 1, name: "Primary Six A", gradeId: 1 }, { id: 2, name: "Primary Six B", gradeId: 1 }];
  const guides = [{ id: 1, gradeId: 1, subjectId: 10, status: "PUBLISHED", subject: { name: "Math" }, grade: { level: "Primary Six" }, topics: [{ id: 1, title: "Fractions", weekNumber: 1, durationWeeks: 1, progress: [{ classId: 1 }, { classId: 1 }] }, { id: 2, title: "Decimals", weekNumber: 2, durationWeeks: 2, progress: [] }] }];
  const db = {
    class: { findMany: async (q) => { queries.push(q); return empty ? [] : classes; } },
    subject: { findMany: async (q) => { queries.push(q); return [{ id: 10, name: "Math" }, { id: 11, name: "English" }]; } },
    cAConfig: { findMany: async (q) => { queries.push(q); return [{ academicYear: "2026/27", currentTerm: "TERM_1", isActive: true }]; } },
    syllabus: { findMany: async (q) => { queries.push(q); return q.distinct ? [{ academicYear: "2025/26" }] : q.where.id === -1 || empty ? [] : guides; } },
    timetablePublication: { findFirst: async (q) => { queries.push(q); return { lessons: [{ classId: 1, subjectId: 10, teacherId: "t1", teacherName: "Ama" }, { classId: 1, subjectId: 10, teacherId: "t1", teacherName: "Ama" }, { classId: 1, subjectId: 11, teacherId: "t2", teacherName: "Abena" }] }; } },
    teacher: { findMany: async (q) => { queries.push(q); return [{ id: "t1", status: "ACTIVE" }, { id: "t2", status: "SUSPENDED" }]; } },
  };
  const service = load("src/lib/queries/admin-curriculum.ts", { "@/src/lib/authz": { requireRole: async (roles) => { assert.deepEqual(roles, ["admin"]); return { schoolId: "a" }; } }, "@/src/lib/prisma": { $transaction: async (work, options) => { assert.equal(options.isolationLevel, "RepeatableRead"); return work(db); } } });
  return { service, queries };
}
test("curriculum separates prepared topics, distinct recorded coverage and missing guides", async () => {
  const f = review();
  const data = await f.service.getAdminCurriculum({});
  assert.equal(data.totals.missing, 1);
  const math = data.rows.find((row) => row.classId === 1 && row.subjectId === 10);
  assert.equal(math.recorded, 1);
  assert.equal(math.planned, 2);
  assert.equal(math.gaps.length, 1);
  assert.equal(math.assignments.length, 1);
  assert.equal(data.rows.find((row) => row.classId === 2).recorded, 0);
  assert.ok(f.queries.every((q) => q.where.schoolId === "a"));
  const guideQuery = f.queries.find((q) => q.include?.topics);
  assert.equal(guideQuery.include.topics.include.progress.where.schoolId, "a");
  assert.ok(guideQuery.include.topics.include.progress.where.coveredDate.lte instanceof Date);
});
test("historical curriculum does not attribute current timetable teachers", async () => {
  const f = review();
  const data = await f.service.getAdminCurriculum({ year: "2025/26" });
  assert.equal(data.currentPeriod, false);
  assert.ok(data.rows.every((row) => row.assignments.length === 0));
  assert.ok(!f.queries.some((q) => q.select?.lessons));
});
test("invalid curriculum filters and foreign selections never expose coverage", async () => {
  for (const params of [{ classId: "999" }, { subjectId: "999" }, { year: "foreign-year" }, { classId: ["1"] }, { term: "INVALID" }, { page: "0" }]) {
    const result = await review().service.getAdminCurriculum(params);
    assert.ok(result.error);
    assert.equal(result.rows.length, 0);
  }
});
test("empty curriculum and guide view remain honest", async () => {
  const result = await review({ empty: true }).service.getAdminCurriculum({ view: "guides" });
  assert.equal(result.guides.length, 0);
  assert.equal(result.count, 0);
  assert.equal(result.pageCount, 1);
});

function actions({ role = "teacher", history = 0, draft = false, wrongGrade = false, assigned = true, otherTeacher = false, historical = false } = {}) {
  const writes = [];
  const db = {
    syllabus: { findFirst: async () => ({ id: 1, status: draft ? "DRAFT" : "PUBLISHED" }), updateMany: async (q) => { writes.push(q); return { count: 1 }; }, deleteMany: async (q) => { writes.push(q); return { count: 1 }; } },
    syllabusTopic: { findFirst: async (q) => { assert.equal(q.where.syllabus.is.schoolId, "a"); assert.equal(q.where.syllabus.is.status, "PUBLISHED"); return draft ? null : { syllabusId: 1, syllabus: { gradeId: 1, subjectId: 10, academicYear: "2026/27", term: "TERM_1" } }; }, findMany: async () => [] },
    class: { findFirst: async (q) => { assert.equal(q.where.schoolId, "a"); return { gradeId: wrongGrade ? 2 : 1 }; } },
    teacher: { findFirst: async (q) => { assert.equal(q.where.schoolId, "a"); assert.equal(q.where.status, "ACTIVE"); return { id: "t1" }; } },
    cAConfig: { findFirst: async () => ({ academicYear: historical ? "2025/26" : "2026/27", currentTerm: "TERM_1" }) },
    timetablePublication: { findFirst: async (q) => { assert.equal(q.where.schoolId, "a"); assert.equal(q.where.status, "ACTIVE"); assert.equal(q.select.lessons.where.teacherId, "t1"); assert.equal(q.select.lessons.where.classId, 1); assert.equal(q.select.lessons.where.subjectId, 10); return { lessons: assigned ? [{ id: "p1" }] : [] }; } },
    syllabusTopicProgress: { count: async () => history, findUnique: async () => ({ teacherId: otherTeacher ? "t2" : "t1" }), upsert: async (q) => { writes.push(q); }, deleteMany: async (q) => { writes.push(q); } },
  };
  const validation = load("src/lib/validation/syllabus.ts", { "./common": { nonEmptyStringSchema: nodeRequire("zod").z.string().trim().min(1), positiveIntSchema: nodeRequire("zod").z.coerce.number().int().positive(), termSchema: nodeRequire("zod").z.enum(["TERM_1", "TERM_2", "TERM_3"]) } });
  const service = load("src/lib/actions/syllabusActions.ts", {
    "@/src/lib/authz": { requireRole: async (roles) => { if (!roles.includes(role)) throw new Error("Forbidden"); return { schoolId: "a", userId: "t1", role }; } },
    "next/cache": { revalidatePath: () => {} }, "@/src/lib/cacheTags": { revalidateDocument: () => {}, revalidateDashboard: () => {} },
    "@/src/lib/services/school-operating-hours": { assertWithinSchoolOperatingHours: async () => {} },
    "@/src/lib/services/curriculum-write": { withCurriculumWrite: async (work) => work(db) },
    "@/src/lib/validation/parse": { parseActionInput: (schema, data) => schema.parse(data) },
    "@/src/lib/validation/syllabus": validation, "@/src/lib/validation/common": { positiveIntSchema: nodeRequire("zod").z.coerce.number().int().positive() },
  });
  return { service, writes };
}
test("admin cannot record or remove teacher coverage", async () => {
  const f = actions({ role: "admin" });
  await assert.rejects(() => f.service.markTopicCovered(1, 1), /Forbidden/);
  await assert.rejects(() => f.service.unmarkTopicCovered(1, 1), /Forbidden/);
  assert.equal(f.writes.length, 0);
});
test("unpublished, historical, wrong-grade and unassigned teacher progress are rejected", async () => {
  for (const options of [{ draft: true }, { historical: true }, { wrongGrade: true }, { assigned: false }, { otherTeacher: true }]) {
    const f = actions(options);
    await assert.rejects(() => f.service.markTopicCovered(1, 1));
    await assert.rejects(() => f.service.unmarkTopicCovered(1, 1));
    assert.equal(f.writes.length, 0);
  }
});
test("coverage notes preserve original teacher and recorded date", async () => {
  const f = actions();
  await f.service.markTopicCovered(1, 1, "Follow-up exercise");
  assert.deepEqual(f.writes[0].update, { notes: "Follow-up exercise" });
  assert.equal(f.writes[0].create.schoolId, "a");
});
test("recorded curriculum cannot be unpublished or deleted, and empty guides cannot publish through status update", async () => {
  const f = actions({ role: "admin", history: 1, draft: true });
  await assert.rejects(() => f.service.deleteSyllabus(1), /recorded coverage/);
  await assert.rejects(() => f.service.unpublishSyllabus(1), /recorded coverage/);
  const empty = actions({ role: "admin" });
  await assert.rejects(() => empty.service.updateSyllabus(1, { status: "PUBLISHED" }), /at least one topic/);
  assert.equal(empty.writes.length, 0);
});
test("coverage PDFs and detail pages protect drafts and class-scoped evidence", () => {
  const pdf = readFileSync("src/app/api/syllabus/pdf/route.tsx", "utf8");
  assert.match(pdf, /role === "teacher" \? \{ status: "PUBLISHED" \}/);
  assert.match(pdf, /keyParts: \[ctx.schoolId, "syllabus-curriculum-v2", syllabus.id, role, teacherClassIds/);
  assert.match(pdf, /t.progress.filter/);
  assert.match(pdf, /private, no-store/);
  const detail = readFileSync("src/app/(dashboard)/list/syllabus/[id]/page.tsx", "utf8");
  assert.doesNotMatch(detail, /currentSyllabusWeek|Behind|startMonthForTerm/);
  assert.match(detail, /role === "teacher" && currentPeriod/);
  assert.match(detail, /not independently verified/i);
});

test("curriculum transaction conflicts return a review-and-retry error without masking infrastructure errors", async () => {
  class KnownError extends Error { constructor(code) { super(code); this.code = code; } }
  for (const code of ["P2034", "P2002", "P1001"]) {
    const service = load("src/lib/services/curriculum-write.ts", { "@/src/generated/prisma": { Prisma: { PrismaClientKnownRequestError: KnownError } }, "@/src/lib/prisma": { $transaction: async (_, options) => { assert.equal(options.isolationLevel, "Serializable"); throw new KnownError(code); } } });
    await assert.rejects(() => service.withCurriculumWrite(async () => {}), code === "P1001" ? /P1001/ : /Refresh and review/);
  }
});
