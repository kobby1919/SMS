import { createHash, randomUUID } from "crypto";

import {
  BillStatus,
  DiscountType,
  BursarStatus,
  FeeBillingFrequency,
  FeeCategory,
  FeeStructureStatus,
  ParentStudentRelationshipRole,
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
import { applyDiscountInTransaction } from "@/src/lib/services/bill-discounts";
import { getMigrationInventory } from "@/src/lib/services/migration-inventory";
import { inventorySchema } from "@/src/lib/migration/inventory";
import { loadStagedMigration, readStagedImportResult } from "@/src/lib/services/migration-staging";
import { migrationStagingStorage } from "@/src/lib/services/migration-staging-storage";

export type MigrationImportResult = {
  batchId: string | null;
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
    feeStructures: number;
    discounts: number;
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

type ImportContext = {
  schoolId: string;
  actorId: string;
  uploadId: string;
};

type ImportCounters = MigrationImportResult["created"];

type DirtyRowReportEntry = {
  rowNumber: number;
  status: MigrationValidationRow["status"];
  severity: MigrationValidationRow["issues"][number]["severity"];
  field: string | null;
  message: string;
};

function buildDirtyRowReport(dirtyRows: MigrationImportResult["dirtyRows"]): DirtyRowReportEntry[] {
  return dirtyRows.slice(0, 500).flatMap((row) =>
    row.issues.length === 0
      ? [{
          rowNumber: row.rowNumber,
          status: row.status,
          severity: "ERROR" as const,
          field: null,
          message: "Row was not imported.",
        }]
      : row.issues.map((issue) => ({
          rowNumber: row.rowNumber,
          status: row.status,
          severity: issue.severity,
          field: issue.field ?? null,
          message: issue.message,
        })),
  );
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
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

function normalizeFeeFrequency(value: string | null | undefined): FeeBillingFrequency | null {
  const clean = (value ?? "TERM").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!clean) return FeeBillingFrequency.TERM;
  if (["term", "termly", "per_term"].includes(clean)) return FeeBillingFrequency.TERM;
  if (["month", "monthly", "per_month"].includes(clean)) return FeeBillingFrequency.MONTHLY;
  if (["week", "weekly", "per_week"].includes(clean)) return FeeBillingFrequency.WEEKLY;
  if (["day", "daily", "per_day", "every_day"].includes(clean)) return FeeBillingFrequency.DAILY;
  if (["one_time", "onetime", "once", "single"].includes(clean)) return FeeBillingFrequency.ONE_TIME;
  return null;
}

function parseMoney(value: string) {
  return new Prisma.Decimal(value.replace(/[,\s]/g, ""));
}

function billStatusForAmounts(totalAmount: Prisma.Decimal, amountPaid: Prisma.Decimal, balance: Prisma.Decimal) {
  if (balance.lt(0) || amountPaid.gt(totalAmount)) return BillStatus.OVERPAID;
  if (balance.lte(0)) return BillStatus.PAID;
  if (amountPaid.gt(0)) return BillStatus.PARTIAL;
  return BillStatus.UNPAID;
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
      sex: normalizeSex(values.guardianSex || values.sex),
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
    const activeRelationshipCount = await tx.parentStudentRelationship.count({
      where: { schoolId, studentId: student.id, status: "ACTIVE" },
    });
    const role = activeRelationshipCount > 0
      ? ParentStudentRelationshipRole.GUARDIAN
      : ParentStudentRelationshipRole.PRIMARY_GUARDIAN;
    await tx.parentStudentRelationship.upsert({
      where: {
        schoolId_parentId_studentId: { schoolId, parentId, studentId: student.id },
      },
      update: {
        status: "ACTIVE",
        endedAt: null,
        note: `Guardian link refreshed during parent migration import.`,
      },
      create: {
        schoolId,
        parentId,
        studentId: student.id,
        status: "ACTIVE",
        role,
        note: role === ParentStudentRelationshipRole.PRIMARY_GUARDIAN
          ? "Primary guardian link created during parent migration import because no active guardian existed."
          : "Additional guardian link created during parent migration import.",
      },
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
    const feeStructure = await tx.feeStructure.findUnique({
      where: {
        schoolId_gradeId_term_academicYear: {
          schoolId,
          gradeId: student.gradeId,
          term,
          academicYear: row.values.academicYear.trim(),
        },
      },
      select: { id: true, status: true, dueDate: true },
    });
    if (!feeStructure || feeStructure.status !== "PUBLISHED") throw new MigrationImportError("Publish the matching fee structure before importing opening bills.");

    const feeAmount = parseMoney(row.values.amount);
    const billingFrequency = normalizeFeeFrequency(row.values.feeFrequency);
    if (!billingFrequency) {
      throw new MigrationImportError(
        "Billing frequency must be TERM, MONTHLY, WEEKLY, DAILY, or ONE_TIME.",
        400,
      );
    }
    if (billingFrequency === FeeBillingFrequency.DAILY) {
      throw new MigrationImportError(
        "Daily collection items cannot be imported as student term bills. Use daily collection setup instead.",
        400,
      );
    }

    const existingFeeItem = await tx.feeItem.findFirst({
      where: {
        feeStructureId: feeStructure.id,
        name: { equals: row.values.feeName.trim(), mode: Prisma.QueryMode.insensitive },
      },
      select: { id: true, amount: true, billingFrequency: true },
    });

    if (existingFeeItem && existingFeeItem.amount.toString() !== feeAmount.toString()) {
      throw new MigrationImportError(
        "Fee item already exists with a different amount. Review the fee rows before importing.",
        409,
      );
    }
    if (existingFeeItem && existingFeeItem.billingFrequency !== billingFrequency) {
      throw new MigrationImportError(
        "Fee item already exists with a different billing frequency. Review the fee rows before importing.",
        409,
      );
    }

    if (!existingFeeItem) throw new MigrationImportError("Fee item must already exist in the published structure.");
    const feeItem = existingFeeItem;

    const amountPaid = parseMoney(row.values.amountPaid || "0");
    if (amountPaid.lt(0) || amountPaid.gt(feeItem.amount)) throw new MigrationImportError("Opening paid amount must be between zero and the charge.");
    const lineBalance = feeItem.amount.minus(amountPaid);
    const existingBill = await tx.studentBill.findUnique({
      where: {
        schoolId_studentId_feeStructureId: {
          schoolId,
          studentId: student.id,
          feeStructureId: feeStructure.id,
        },
      },
      select: {
        id: true,
        totalAmount: true,
        amountPaid: true,
        balance: true,
        status: true,
        discountAmount: true,
        lineItems: {
          where: { feeItemId: feeItem.id },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (existingBill?.lineItems.length) {
      throw new MigrationImportError(
        "This fee item is already on this student's bill. Validate again and remove duplicate fee rows before importing.",
        409,
      );
    }
    if (existingBill && (existingBill.status === "WAIVED" || existingBill.discountAmount.gt(0) || await tx.payment.count({ where: { schoolId, studentBillId: existingBill.id } }) > 0)) throw new MigrationImportError("Opening balances cannot extend a waived bill or a bill with discounts or live payment history.");

    const bill = existingBill
      ? await tx.studentBill.update({
          where: { id: existingBill.id },
          data: {
            totalAmount: existingBill.totalAmount.plus(feeItem.amount),
            amountPaid: existingBill.amountPaid.plus(amountPaid),
            balance: existingBill.balance.plus(lineBalance),
            status: billStatusForAmounts(
              existingBill.totalAmount.plus(feeItem.amount),
              existingBill.amountPaid.plus(amountPaid),
              existingBill.balance.plus(lineBalance),
            ),
          },
          select: { id: true },
        })
      : await tx.studentBill.create({
        data: {
        schoolId,
        studentId: student.id,
        feeStructureId: feeStructure.id,
        totalAmount: feeItem.amount,
        amountPaid,
        balance: lineBalance,
        dueDate: feeStructure.dueDate,
        status: billStatusForAmounts(feeItem.amount, amountPaid, lineBalance),
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
        amountPaid,
        balance: lineBalance,
        isPaid: lineBalance.lte(0),
      },
    });
    counters.feeLineItems += 1;
    await tx.financeAuditLog.create({ data: { schoolId, action: "BILL_GENERATED", performedBy: actorId, entityType: "StudentBill", entityId: String(bill.id), metadata: { source: "MIGRATION_OPENING_BALANCE", feeItemId: feeItem.id, charge: feeItem.amount.toFixed(2), openingAmountPaid: amountPaid.toFixed(2), admissionNumber: row.values.admissionNumber } } });
  }
  counters.feeBills = affectedBillIds.size;
}

async function importFeeStructures(tx: Prisma.TransactionClient, schoolId: string, actorId: string, rows: MigrationValidationRow[], counters: ImportCounters) {
  const structureIds = new Set<number>();
  for (const { values } of rows) {
    const grade = await tx.grade.findFirst({ where: { schoolId, level: { equals: values.gradeName.trim(), mode: "insensitive" } } });
    if (!grade) throw new MigrationImportError("Grade does not exist in this school.");
    const dueDate = new Date(`${values.dueDate}T00:00:00.000Z`);
    const structure = await tx.feeStructure.upsert({ where: { schoolId_gradeId_term_academicYear: { schoolId, gradeId: grade.id, term: normalizeTerm(values.term), academicYear: values.academicYear.trim() } }, update: {}, create: { schoolId, gradeId: grade.id, term: normalizeTerm(values.term), academicYear: values.academicYear.trim(), title: `${grade.level} ${values.term} ${values.academicYear}`, dueDate, createdBy: actorId }, include: { feeItems: true, _count: { select: { bills: true } } } });
    if (structure.status !== FeeStructureStatus.DRAFT || structure._count.bills > 0) throw new MigrationImportError("Published or billed fee structures cannot be modified by import.");
    if (structure.dueDate && structure.dueDate.getTime() !== dueDate.getTime()) throw new MigrationImportError("Due date must match other items in this structure.");
    if (!structure.dueDate) await tx.feeStructure.update({ where: { id: structure.id }, data: { dueDate } });
    if (structure.feeItems.some((item) => item.name.trim().toLowerCase() === values.feeName.trim().toLowerCase())) throw new MigrationImportError("Fee item already exists. Validate again.");
    const frequency = normalizeFeeFrequency(values.feeFrequency);
    if (!frequency || frequency === "DAILY") throw new MigrationImportError("Daily collections require separate setup.");
    await tx.feeItem.create({ data: { feeStructureId: structure.id, name: values.feeName.trim(), category: values.category.trim().toUpperCase() as FeeCategory, amount: parseMoney(values.amount), billingFrequency: frequency, isOptional: values.isOptional.trim().toUpperCase() === "TRUE" } });
    await tx.financeAuditLog.create({ data: { schoolId, action: "FEE_STRUCTURE_CREATED", performedBy: actorId, entityType: "FeeStructure", entityId: String(structure.id), metadata: { source: "MIGRATION", feeName: values.feeName, category: values.category, dueDate: values.dueDate } } });
    structureIds.add(structure.id);
  }
  counters.feeStructures = structureIds.size;
}

async function importDiscounts(tx: Prisma.TransactionClient, schoolId: string, actorId: string, rows: MigrationValidationRow[], counters: ImportCounters) {
  for (const { values } of rows) {
    const reference = values.approvalReference.trim().toLowerCase();
    const duplicate = await tx.financeAuditLog.findFirst({ where: { schoolId, action: "DISCOUNT_APPLIED", metadata: { path: ["approvalReference"], equals: reference } } });
    if (duplicate) throw new MigrationImportError("Approval reference was already imported. Validate again.", 409);
    const bills = await tx.studentBill.findMany({ where: { schoolId, student: { schoolId, admissionNumber: values.admissionNumber.trim().toUpperCase() }, feeStructure: { schoolId, term: normalizeTerm(values.term), academicYear: values.academicYear.trim() } }, take: 2 });
    if (bills.length !== 1) throw new MigrationImportError("Exactly one bill must match this student and term. Review ambiguous bills manually.");
    const bill = bills[0];
    await applyDiscountInTransaction(tx, { schoolId, actorId, billId: bill.id, type: values.discountType.trim().toUpperCase() as DiscountType, description: values.reason.trim(), amount: values.amount ? parseMoney(values.amount).toString() : undefined, percentage: values.percentage ? parseMoney(values.percentage).toString() : undefined, approvalReference: reference });
    counters.discounts += 1;
  }
}

export async function importValidatedMigrationRows(
  request: ImportContext,
): Promise<MigrationImportResult> {
  const staged = await loadStagedMigration(request.schoolId, request.uploadId);
  if (staged.upload.status === "IMPORTED" && staged.upload.encryptedResult) {
    return readStagedImportResult(request.schoolId, request.uploadId, staged.upload.encryptedResult);
  }
  const context = { ...staged.payload, ...request };
  const validation = await validateMigrationRows(context);
  const batchId = `mig_${randomUUID()}`;
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
    feeStructures: 0,
    discounts: 0,
  };
  const result = (): MigrationImportResult => ({ batchId: cleanRows.length > 0 ? batchId : null, areaKey: context.areaKey, totalRows: validation.totalRows, importedRows: cleanRows.length, skippedRows: validation.skippedRows, correctionRows: validation.correctionRows, warningRows: validation.warningRows, created: counters, dirtyRows });

  if (cleanRows.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id" = ${context.schoolId} FOR SHARE`;
      const inventory = await getMigrationInventory(context.schoolId, tx);
      if (inventory?.status !== "CONFIRMED" || !inventorySchema.safeParse(inventory).success || !inventory.rows.some((row) => row.key === context.areaKey && row.disposition === "INCLUDE")) {
        throw new MigrationImportError("Confirm a migration inventory that includes this dataset before importing.", 409);
      }
      if (inventory.version !== staged.upload.inventoryVersion) throw new MigrationImportError("The inventory scope changed after this upload. Stage and validate the file again.", 409);
      await tx.$queryRaw`SELECT "id" FROM "MigrationStagedUpload" WHERE "id" = ${request.uploadId} AND "schoolId" = ${context.schoolId} FOR UPDATE`;
      const upload = await tx.migrationStagedUpload.findFirst({ where: { id: request.uploadId, schoolId: context.schoolId } });
      if (!upload || upload.status !== "VALIDATED" || !upload.encryptedPayload || upload.expiresAt <= new Date() || upload.checksum !== staged.upload.checksum) throw new MigrationImportError("This upload changed, expired, or was already imported. Refresh the workspace.", 409);
      if (["fees", "feeStructures", "discounts"].includes(context.areaKey)) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${context.schoolId}), hashtext('finance-migration'))`;
      if (context.areaKey === "classes") await importClasses(tx, context.schoolId, cleanRows, counters);
      if (context.areaKey === "subjects") await importSubjects(tx, context.schoolId, cleanRows, counters);
      if (context.areaKey === "students") await importStudents(tx, context.schoolId, context.actorId, cleanRows, counters);
      if (context.areaKey === "parents") await importParents(tx, context.schoolId, cleanRows, counters);
      if (context.areaKey === "teachers") await importTeachers(tx, context.schoolId, cleanRows, counters);
      if (context.areaKey === "bursars") await importBursars(tx, context.schoolId, cleanRows, counters);
      if (context.areaKey === "fees") await importFees(tx, context.schoolId, context.actorId, cleanRows, counters);
      if (context.areaKey === "feeStructures") await importFeeStructures(tx, context.schoolId, context.actorId, cleanRows, counters);
      if (context.areaKey === "discounts") await importDiscounts(tx, context.schoolId, context.actorId, cleanRows, counters);

      await tx.onboardingAuditLog.create({
        data: {
          schoolId: context.schoolId,
          action: "IMPORT_RECORDED",
          performedBy: context.actorId,
          metadata: {
            importType: context.areaKey,
            inventoryVersion: inventory.version,
            uploadId: request.uploadId,
            sourceChecksum: upload.checksum,
            rowCount: context.rows.length,
            importedRows: cleanRows.length,
            skippedRows: dirtyRows.length,
            correctionRows: validation.correctionRows,
            warningRows: validation.warningRows,
            batchId,
            fileName: context.fileName ?? null,
            status: "COMPLETED",
            problematic: false,
            markedProblematicAt: null,
            markedProblematicBy: null,
            errorCount: dirtyRows.reduce((count, row) => count + row.issues.length, 0),
            errors: buildDirtyRowReport(dirtyRows),
            created: counters,
          },
        },
      });
      const encryptedResult = await migrationStagingStorage.seal(JSON.stringify(result()), { schoolId: context.schoolId, uploadId: request.uploadId, purpose: "RESULT" });
      await tx.migrationStagedUpload.update({ where: { id: request.uploadId }, data: { status: "IMPORTED", importedAt: new Date(), batchId, encryptedResult } });
    }, {
      maxWait: 15_000,
      timeout: context.areaKey === "fees" ? 90_000 : 45_000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  revalidateDashboard(context.schoolId);
  revalidateReferenceData(context.schoolId, "students");
  revalidateReferenceData(context.schoolId, "parents");
  revalidateReferenceData(context.schoolId, "teachers");
  revalidateReferenceData(context.schoolId, "classes");
  revalidateReferenceData(context.schoolId, "subjects");

  return result();
}
