import { createHash, randomUUID } from "crypto";

import {
  BursarStatus,
  FeeCategory,
  FeeStructureStatus,
  Prisma,
  StudentStatus,
  TeacherStatus,
  Term,
  UserSex,
} from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { revalidateDashboard, revalidateReferenceData } from "@/src/lib/cacheTags";
import { studentRecordUsername } from "@/src/lib/services/user-management";
import {
  validateMigrationRows,
  type MigrationValidationRow,
} from "@/src/lib/services/data-migration-validation";
import type { MigrationValidationPayload } from "@/src/lib/validation/data-migration";

export type MigrationImportResult = {
  areaKey: MigrationValidationPayload["areaKey"];
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  correctionRows: number;
  warningRows: number;
  created: {
    students: number;
    parents: number;
    parentLinks: number;
    teachers: number;
    bursars: number;
    classes: number;
    subjects: number;
    feeBills: number;
    feeLineItems: number;
  };
  dirtyRows: Array<{
    rowNumber: number;
    status: MigrationValidationRow["status"];
    issues: MigrationValidationRow["issues"];
  }>;
};

export class MigrationImportError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "MigrationImportError";
    this.status = status;
  }
}

type ImportContext = MigrationValidationPayload & {
  schoolId: string;
  actorId: string;
};

type ImportCounters = MigrationImportResult["created"];

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
}

function identity(value: string | null | undefined) {
  return normalize(value).toLowerCase();
}

function normalizeEmail(value: string | null | undefined) {
  const email = normalize(value).toLowerCase();
  return email || null;
}

function normalizePhone(value: string | null | undefined) {
  const phone = normalize(value).replace(/\s+/g, "");
  return phone || null;
}

function normalizeAdmissionNumber(value: string) {
  return value.trim().toUpperCase();
}

function normalizeSex(value: string): UserSex {
  return value.trim().toLowerCase().startsWith("f") ? UserSex.FEMALE : UserSex.MALE;
}

function normalizeTerm(value: string): Term {
  const clean = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["1", "term1", "term_1", "firstterm"].includes(clean)) return Term.TERM_1;
  if (["2", "term2", "term_2", "secondterm"].includes(clean)) return Term.TERM_2;
  return Term.TERM_3;
}

function parseMoney(value: string) {
  return new Prisma.Decimal(value.replace(/[,\s]/g, ""));
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    name: parts[0] ?? "Guardian",
    surname: parts.slice(1).join(" ") || "Guardian",
  };
}

function generatedParentUsername(schoolId: string, identityKey: string) {
  const hash = createHash("sha256").update(`${schoolId}:${identityKey}`).digest("hex").slice(0, 24);
  return `parent:${schoolId}:${hash}`;
}

function generatedProfileUsername(prefix: "teacher" | "bursar", schoolId: string, email: string) {
  const hash = createHash("sha256").update(`${schoolId}:${prefix}:${email}`).digest("hex").slice(0, 24);
  return `${prefix}:${schoolId}:${hash}`;
}

function parentIdentity(values: Record<string, string>) {
  const email = normalizeEmail(values.parentEmail ?? values.email);
  const phone = normalizePhone(values.parentPhone ?? values.phone);
  if (email) return { key: `email:${email}`, email, phone };
  if (phone) return { key: `phone:${phone}`, email, phone };
  return null;
}

async function nextGradeOrder(tx: Prisma.TransactionClient, schoolId: string) {
  const aggregate = await tx.grade.aggregate({
    where: { schoolId },
    _max: { order: true },
  });
  return (aggregate._max.order ?? 0) + 1;
}

async function resolveGrade(tx: Prisma.TransactionClient, schoolId: string, gradeName: string) {
  const level = normalize(gradeName);
  const existing = await tx.grade.findFirst({
    where: { schoolId, level: { equals: level, mode: Prisma.QueryMode.insensitive } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const grade = await tx.grade.create({
    data: {
      schoolId,
      level,
      order: await nextGradeOrder(tx, schoolId),
    },
    select: { id: true },
  });
  return grade.id;
}

async function resolveParent(
  tx: Prisma.TransactionClient,
  schoolId: string,
  values: Record<string, string>,
  counters: ImportCounters,
) {
  const parentContact = parentIdentity(values);
  if (!parentContact) throw new MigrationImportError("Parent contact was not validated.");

  const candidates = await tx.parent.findMany({
    where: {
      schoolId,
      OR: [
        ...(parentContact.email ? [{ email: { equals: parentContact.email, mode: Prisma.QueryMode.insensitive } }] : []),
        ...(parentContact.phone ? [{ phone: { not: null } }] : []),
      ],
    },
    select: { id: true, email: true, phone: true },
  });
  const matches = candidates.filter((candidate) => {
    const emailMatches = parentContact.email && normalizeEmail(candidate.email) === parentContact.email;
    const phoneMatches = parentContact.phone && normalizePhone(candidate.phone) === parentContact.phone;
    return emailMatches || phoneMatches;
  });
  const uniqueMatches = new Set(matches.map((match) => match.id));

  if (uniqueMatches.size > 1) {
    throw new MigrationImportError(
      "Multiple parent records match this guardian contact. Clean up duplicate parent contacts before importing.",
      409,
    );
  }

  if (matches[0]) return matches[0].id;

  const parentName = splitName(values.parentName || values.parentFullName || values.parent || values.name);
  const parent = await tx.parent.create({
    data: {
      id: `par_${randomUUID()}`,
      schoolId,
      username: generatedParentUsername(schoolId, parentContact.key),
      name: parentName.name,
      surname: parentName.surname,
      email: parentContact.email,
      phone: parentContact.phone,
      address: values.address || "Not provided",
    },
    select: { id: true },
  });
  counters.parents += 1;
  return parent.id;
}

async function importClasses(
  tx: Prisma.TransactionClient,
  schoolId: string,
  rows: MigrationValidationRow[],
  counters: ImportCounters,
) {
  for (const row of rows) {
    const gradeId = await resolveGrade(tx, schoolId, row.values.gradeName);
    await tx.class.create({
      data: {
        schoolId,
        name: row.values.className.trim(),
        capacity: row.values.capacity ? Number(row.values.capacity) : 40,
        gradeId,
      },
    });
    counters.classes += 1;
  }
}

async function importSubjects(
  tx: Prisma.TransactionClient,
  schoolId: string,
  rows: MigrationValidationRow[],
  counters: ImportCounters,
) {
  for (const row of rows) {
    await tx.subject.create({
      data: {
        schoolId,
        name: row.values.subjectName.trim(),
      },
    });
    counters.subjects += 1;
  }
}

async function importStudents(
  tx: Prisma.TransactionClient,
  schoolId: string,
  actorId: string,
  rows: MigrationValidationRow[],
  counters: ImportCounters,
) {
  for (const row of rows) {
    const klass = await tx.class.findFirstOrThrow({
      where: { schoolId, name: { equals: row.values.className, mode: Prisma.QueryMode.insensitive } },
      select: { id: true, gradeId: true },
    });
    const parentId = await resolveParent(tx, schoolId, row.values, counters);
    const admissionNumber = normalizeAdmissionNumber(row.values.admissionNumber);
    const student = await tx.student.create({
      data: {
        id: `stu_${randomUUID()}`,
        schoolId,
        username: studentRecordUsername(schoolId, admissionNumber),
        admissionNumber,
        name: row.values.firstName,
        surname: row.values.lastName,
        email: normalizeEmail(row.values.email),
        phone: normalizePhone(row.values.phone),
        address: row.values.address || "Not provided",
        bloodType: row.values.bloodType || "Not provided",
        sex: normalizeSex(row.values.sex),
        status: StudentStatus.ACTIVE,
        parentId,
        classId: klass.id,
        gradeId: klass.gradeId,
      },
      select: { id: true },
    });

    await tx.parentStudentRelationship.upsert({
      where: {
        schoolId_parentId_studentId: { schoolId, parentId, studentId: student.id },
      },
      update: {
        status: "ACTIVE",
        role: "PRIMARY_GUARDIAN",
        endedAt: null,
        note: `Linked during migration import by ${actorId}.`,
      },
      create: {
        schoolId,
        parentId,
        studentId: student.id,
        role: "PRIMARY_GUARDIAN",
        status: "ACTIVE",
        note: `Linked during migration import by ${actorId}.`,
      },
    });
    counters.students += 1;
    counters.parentLinks += 1;
  }
}

async function importParents(
  tx: Prisma.TransactionClient,
  schoolId: string,
  rows: MigrationValidationRow[],
  counters: ImportCounters,
) {
  for (const row of rows) {
    const parentId = await resolveParent(tx, schoolId, row.values, counters);
    const student = await tx.student.findFirstOrThrow({
      where: { schoolId, admissionNumber: row.values.wardAdmissionNumber.trim().toUpperCase() },
      select: { id: true },
    });
    await tx.parentStudentRelationship.upsert({
      where: {
        schoolId_parentId_studentId: { schoolId, parentId, studentId: student.id },
      },
      update: { status: "ACTIVE", endedAt: null },
      create: { schoolId, parentId, studentId: student.id, status: "ACTIVE" },
    });
    counters.parentLinks += 1;
  }
}

async function importTeachers(
  tx: Prisma.TransactionClient,
  schoolId: string,
  rows: MigrationValidationRow[],
  counters: ImportCounters,
) {
  for (const row of rows) {
    const email = normalizeEmail(row.values.email);
    if (!email) throw new MigrationImportError("Teacher email was not validated.");
    await tx.teacher.create({
      data: {
        id: `tch_${randomUUID()}`,
        schoolId,
        username: generatedProfileUsername("teacher", schoolId, email),
        name: row.values.firstName,
        surname: row.values.lastName,
        sex: normalizeSex(row.values.sex),
        email,
        phone: normalizePhone(row.values.phone),
        address: "Not provided",
        status: TeacherStatus.INCOMPLETE_SETUP,
      },
    });
    counters.teachers += 1;
  }
}

async function importBursars(
  tx: Prisma.TransactionClient,
  schoolId: string,
  rows: MigrationValidationRow[],
  counters: ImportCounters,
) {
  for (const row of rows) {
    const email = normalizeEmail(row.values.email);
    if (!email) throw new MigrationImportError("Bursar email was not validated.");
    await tx.bursar.create({
      data: {
        id: `bur_${randomUUID()}`,
        schoolId,
        username: generatedProfileUsername("bursar", schoolId, email),
        name: row.values.firstName,
        surname: row.values.lastName,
        sex: normalizeSex(row.values.sex),
        email,
        phone: normalizePhone(row.values.phone),
        status: BursarStatus.ACTIVE,
      },
    });
    counters.bursars += 1;
  }
}

async function importFees(
  tx: Prisma.TransactionClient,
  schoolId: string,
  actorId: string,
  rows: MigrationValidationRow[],
  counters: ImportCounters,
) {
  const affectedBillIds = new Set<number>();

  for (const row of rows) {
    const student = await tx.student.findFirstOrThrow({
      where: { schoolId, admissionNumber: row.values.admissionNumber.trim().toUpperCase() },
      select: { id: true, gradeId: true },
    });
    const term = normalizeTerm(row.values.term);
    const feeStructure = await tx.feeStructure.upsert({
      where: {
        schoolId_gradeId_term_academicYear: {
          schoolId,
          gradeId: student.gradeId,
          term,
          academicYear: row.values.academicYear.trim(),
        },
      },
      update: {},
      create: {
        schoolId,
        gradeId: student.gradeId,
        term,
        academicYear: row.values.academicYear.trim(),
        title: `Imported ${term.replace("_", " ")} ${row.values.academicYear.trim()} fees`,
        status: FeeStructureStatus.DRAFT,
        createdBy: actorId,
      },
      select: { id: true },
    });

    const feeAmount = parseMoney(row.values.amount);
    const existingFeeItem = await tx.feeItem.findFirst({
      where: {
        feeStructureId: feeStructure.id,
        name: { equals: row.values.feeName.trim(), mode: Prisma.QueryMode.insensitive },
      },
      select: { id: true, amount: true },
    });

    if (existingFeeItem && existingFeeItem.amount.toString() !== feeAmount.toString()) {
      throw new MigrationImportError(
        "Fee item already exists with a different amount. Review the fee rows before importing.",
        409,
      );
    }

    const feeItem =
      existingFeeItem ??
      (await tx.feeItem.create({
        data: {
          feeStructureId: feeStructure.id,
          name: row.values.feeName.trim(),
          amount: feeAmount,
          category: FeeCategory.OTHER,
        },
        select: { id: true, amount: true },
      }));

    const bill = await tx.studentBill.upsert({
      where: {
        schoolId_studentId_feeStructureId: {
          schoolId,
          studentId: student.id,
          feeStructureId: feeStructure.id,
        },
      },
      update: {
        totalAmount: { increment: feeItem.amount },
        amountPaid: { increment: parseMoney(row.values.amountPaid || "0") },
        balance: { increment: feeItem.amount.minus(parseMoney(row.values.amountPaid || "0")) },
      },
      create: {
        schoolId,
        studentId: student.id,
        feeStructureId: feeStructure.id,
        totalAmount: feeItem.amount,
        amountPaid: parseMoney(row.values.amountPaid || "0"),
        balance: feeItem.amount.minus(parseMoney(row.values.amountPaid || "0")),
        generatedBy: actorId,
      },
      select: { id: true },
    });
    affectedBillIds.add(bill.id);

    await tx.billLineItem.create({
      data: {
        studentBillId: bill.id,
        feeItemId: feeItem.id,
        amount: feeItem.amount,
        amountPaid: parseMoney(row.values.amountPaid || "0"),
        balance: feeItem.amount.minus(parseMoney(row.values.amountPaid || "0")),
        isPaid: feeItem.amount.minus(parseMoney(row.values.amountPaid || "0")).lte(0),
      },
    });
    counters.feeLineItems += 1;
  }
  counters.feeBills = affectedBillIds.size;
}

export async function importValidatedMigrationRows(
  context: ImportContext,
): Promise<MigrationImportResult> {
  const validation = await validateMigrationRows(context);
  const cleanRows = validation.rows.filter((row) => row.status === "READY" && row.issues.length === 0);
  const dirtyRows = validation.rows
    .filter((row) => row.status !== "READY" || row.issues.length > 0)
    .map((row) => ({ rowNumber: row.rowNumber, status: row.status, issues: row.issues }));
  const counters: ImportCounters = {
    students: 0,
    parents: 0,
    parentLinks: 0,
    teachers: 0,
    bursars: 0,
    classes: 0,
    subjects: 0,
    feeBills: 0,
    feeLineItems: 0,
  };

  if (cleanRows.length > 0) {
    await prisma.$transaction(async (tx) => {
      if (context.areaKey === "classes") await importClasses(tx, context.schoolId, cleanRows, counters);
      if (context.areaKey === "subjects") await importSubjects(tx, context.schoolId, cleanRows, counters);
      if (context.areaKey === "students") await importStudents(tx, context.schoolId, context.actorId, cleanRows, counters);
      if (context.areaKey === "parents") await importParents(tx, context.schoolId, cleanRows, counters);
      if (context.areaKey === "teachers") await importTeachers(tx, context.schoolId, cleanRows, counters);
      if (context.areaKey === "bursars") await importBursars(tx, context.schoolId, cleanRows, counters);
      if (context.areaKey === "fees") await importFees(tx, context.schoolId, context.actorId, cleanRows, counters);

      await tx.onboardingAuditLog.create({
        data: {
          schoolId: context.schoolId,
          action: "IMPORT_RECORDED",
          performedBy: context.actorId,
          metadata: {
            importType: context.areaKey,
            rowCount: context.rows.length,
            importedRows: cleanRows.length,
            skippedRows: dirtyRows.length,
            created: counters,
          },
        },
      });
    });
  }

  revalidateDashboard(context.schoolId);
  revalidateReferenceData(context.schoolId, "students");
  revalidateReferenceData(context.schoolId, "parents");
  revalidateReferenceData(context.schoolId, "teachers");
  revalidateReferenceData(context.schoolId, "classes");
  revalidateReferenceData(context.schoolId, "subjects");

  return {
    areaKey: context.areaKey,
    totalRows: validation.totalRows,
    importedRows: cleanRows.length,
    skippedRows: validation.skippedRows,
    correctionRows: validation.correctionRows,
    warningRows: validation.warningRows,
    created: counters,
    dirtyRows,
  };
}
