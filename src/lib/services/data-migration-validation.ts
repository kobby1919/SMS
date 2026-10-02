import prisma from "@/src/lib/prisma";
import { getMigrationAreaDefinition, type MigrationAreaKey } from "@/src/lib/migration/column-mapping";

export type MigrationValidationIssueSeverity = "ERROR" | "WARNING" | "SKIP";
export type MigrationValidationRowStatus = "READY" | "NEEDS_CORRECTION" | "SKIPPED";

export type MigrationValidationIssue = {
  severity: MigrationValidationIssueSeverity;
  field?: string;
  message: string;
};

export type MigrationValidationRow = {
  rowNumber: number;
  status: MigrationValidationRowStatus;
  values: Record<string, string>;
  issues: MigrationValidationIssue[];
};

export type MigrationValidationResult = {
  areaKey: MigrationAreaKey;
  totalRows: number;
  readyRows: number;
  skippedRows: number;
  correctionRows: number;
  warningRows: number;
  rows: MigrationValidationRow[];
  summaryIssues: MigrationValidationIssue[];
};

type ValidationContext = {
  schoolId: string;
  areaKey: MigrationAreaKey;
  headers: string[];
  mapping: Record<string, string>;
  rows: string[][];
};

const VALID_SEX_VALUES = new Set(["MALE", "FEMALE"]);
const VALID_STUDENT_STATUS_VALUES = new Set(["ACTIVE", "INCOMPLETE_SETUP", "TRANSFERRED", "GRADUATED", "WITHDRAWN"]);
const VALID_TERM_VALUES = new Set(["TERM_1", "TERM_2", "TERM_3"]);
const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
}

function identity(value: string | null | undefined) {
  return normalize(value).toLowerCase();
}

function normalizeSex(value: string) {
  const clean = value.trim().toLowerCase();
  if (["m", "male", "mr"].includes(clean)) return "MALE";
  if (["f", "female", "miss", "mrs", "ms"].includes(clean)) return "FEMALE";
  return value.trim().toUpperCase();
}

function normalizeTerm(value: string) {
  const clean = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["1", "term1", "term_1", "firstterm"].includes(clean)) return "TERM_1";
  if (["2", "term2", "term_2", "secondterm"].includes(clean)) return "TERM_2";
  if (["3", "term3", "term_3", "thirdterm"].includes(clean)) return "TERM_3";
  return value.trim().toUpperCase();
}

function parseMoney(value: string) {
  const clean = value.replace(/[,\s]/g, "");
  if (!clean) return null;
  const amount = Number(clean);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100) / 100;
}

function isValidEmail(value: string) {
  return SIMPLE_EMAIL_PATTERN.test(value.trim().toLowerCase());
}

function compact(values: Array<string | null | undefined>) {
  return [...new Set(values.map(identity).filter(Boolean))];
}

function countDuplicates(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = identity(value);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function mappedValues(context: ValidationContext, row: string[]) {
  const values: Record<string, string> = {};
  for (const [fieldKey, header] of Object.entries(context.mapping)) {
    const headerIndex = context.headers.findIndex((candidate) => candidate === header);
    values[fieldKey] = headerIndex >= 0 ? normalize(row[headerIndex]) : "";
  }
  return values;
}

function addDuplicateIssue({
  issues,
  counts,
  value,
  field,
  label,
  severity = "ERROR",
}: {
  issues: MigrationValidationIssue[];
  counts: Map<string, number>;
  value: string;
  field: string;
  label: string;
  severity?: MigrationValidationIssueSeverity;
}) {
  const key = identity(value);
  if (key && (counts.get(key) ?? 0) > 1) {
    issues.push({
      severity,
      field,
      message: `${label} appears more than once in this upload.`,
    });
  }
}

function uploadedFeeRowKey(values: Record<string, string>) {
  const parts = [
    values.admissionNumber,
    values.feeName,
    values.term ? normalizeTerm(values.term) : "",
    values.academicYear,
  ].map(identity);

  return parts.every(Boolean) ? parts.join(":") : "";
}

async function existingSets(schoolId: string) {
  const [
    classes,
    subjects,
    students,
    parents,
    teachers,
    bursars,
    feeStructures,
  ] = await Promise.all([
    prisma.class.findMany({ where: { schoolId }, select: { name: true } }),
    prisma.subject.findMany({ where: { schoolId }, select: { name: true } }),
    prisma.student.findMany({ where: { schoolId }, select: { admissionNumber: true, email: true, phone: true } }),
    prisma.parent.findMany({ where: { schoolId }, select: { email: true, phone: true } }),
    prisma.teacher.findMany({ where: { schoolId }, select: { email: true, phone: true } }),
    prisma.bursar.findMany({ where: { schoolId }, select: { email: true, phone: true } }),
    prisma.feeStructure.findMany({ where: { schoolId }, select: { title: true, academicYear: true, term: true } }),
  ]);

  return {
    classNames: new Set(classes.map((item) => identity(item.name))),
    subjectNames: new Set(subjects.map((item) => identity(item.name))),
    admissionNumbers: new Set(compact(students.map((item) => item.admissionNumber))),
    studentEmails: new Set(compact(students.map((item) => item.email))),
    studentPhones: new Set(compact(students.map((item) => item.phone))),
    parentEmails: new Set(compact(parents.map((item) => item.email))),
    parentPhones: new Set(compact(parents.map((item) => item.phone))),
    teacherEmails: new Set(compact(teachers.map((item) => item.email))),
    teacherPhones: new Set(compact(teachers.map((item) => item.phone))),
    bursarEmails: new Set(compact(bursars.map((item) => item.email))),
    bursarPhones: new Set(compact(bursars.map((item) => item.phone))),
    feeKeys: new Set(
      feeStructures.map((item) => `${identity(item.title)}:${item.term}:${identity(item.academicYear)}`),
    ),
  };
}

export async function validateMigrationRows(
  context: ValidationContext,
): Promise<MigrationValidationResult> {
  const area = getMigrationAreaDefinition(context.areaKey);
  const existing = await existingSets(context.schoolId);
  const mappedRows = context.rows.map((row, index) => ({
    rowNumber: index + 2,
    values: mappedValues(context, row),
  }));

  const duplicateAdmissionNumbers = countDuplicates(mappedRows.map((row) => row.values.admissionNumber));
  const duplicateClassNames = countDuplicates(mappedRows.map((row) => row.values.className));
  const duplicateSubjectNames = countDuplicates(mappedRows.map((row) => row.values.subjectName));
  const duplicateEmails = countDuplicates(mappedRows.map((row) => row.values.email ?? row.values.parentEmail));
  const duplicatePhones = countDuplicates(mappedRows.map((row) => row.values.phone ?? row.values.parentPhone));
  const duplicateStudentGuardianEmails = countDuplicates(mappedRows.map((row) => row.values.parentEmail));
  const duplicateStudentGuardianPhones = countDuplicates(mappedRows.map((row) => row.values.parentPhone));
  const duplicateFeeRows = countDuplicates(mappedRows.map((row) => uploadedFeeRowKey(row.values)));

  const rows = mappedRows.map(({ rowNumber, values }) => {
    const issues: MigrationValidationIssue[] = [];

    for (const field of area.fields.filter((item) => item.required)) {
      if (!normalize(values[field.key])) {
        issues.push({
          severity: "ERROR",
          field: field.key,
          message: `${field.label} is required.`,
        });
      }
    }

    if (values.sex && !VALID_SEX_VALUES.has(normalizeSex(values.sex))) {
      issues.push({ severity: "ERROR", field: "sex", message: "Sex must be Male or Female." });
    }

    if (values.status && !VALID_STUDENT_STATUS_VALUES.has(values.status.trim().toUpperCase())) {
      issues.push({ severity: "ERROR", field: "status", message: "Student status is not valid." });
    }

    if (values.term && !VALID_TERM_VALUES.has(normalizeTerm(values.term))) {
      issues.push({ severity: "ERROR", field: "term", message: "Term must be TERM_1, TERM_2, or TERM_3." });
    }

    for (const [field, value] of Object.entries(values)) {
      if (field.toLowerCase().includes("email") && value && !isValidEmail(value)) {
        issues.push({ severity: "ERROR", field, message: "Email address is not valid." });
      }
    }

    if (context.areaKey === "students") {
      addDuplicateIssue({ issues, counts: duplicateAdmissionNumbers, value: values.admissionNumber, field: "admissionNumber", label: "Admission number" });
      addDuplicateIssue({ issues, counts: duplicateStudentGuardianEmails, value: values.parentEmail, field: "parentEmail", label: "Guardian email", severity: "WARNING" });
      addDuplicateIssue({ issues, counts: duplicateStudentGuardianPhones, value: values.parentPhone, field: "parentPhone", label: "Guardian phone", severity: "WARNING" });
      if (values.admissionNumber && existing.admissionNumbers.has(identity(values.admissionNumber))) {
        issues.push({ severity: "SKIP", field: "admissionNumber", message: "Student already exists in Edujay." });
      }
      if (values.className && !existing.classNames.has(identity(values.className))) {
        issues.push({ severity: "ERROR", field: "className", message: "Class name does not exist in Edujay yet." });
      }
      if (!values.parentEmail) {
        issues.push({ severity: "ERROR", field: "parentEmail", message: "Guardian email is required for parent invite/login access." });
      }
      if (values.parentEmail && existing.parentEmails.has(identity(values.parentEmail))) {
        issues.push({ severity: "WARNING", field: "parentEmail", message: "Guardian email already exists in Edujay. Confirm this student should link to that existing parent." });
      }
      if (values.parentPhone && existing.parentPhones.has(identity(values.parentPhone))) {
        issues.push({ severity: "WARNING", field: "parentPhone", message: "Guardian phone already exists in Edujay. Confirm this student should link to that existing parent." });
      }
    }

    if (context.areaKey === "parents") {
      addDuplicateIssue({ issues, counts: duplicateEmails, value: values.email, field: "email", label: "Parent email", severity: "WARNING" });
      addDuplicateIssue({ issues, counts: duplicatePhones, value: values.phone, field: "phone", label: "Parent phone", severity: "WARNING" });
      if (!values.email) {
        issues.push({ severity: "ERROR", field: "email", message: "Parent email is required for invite/login access." });
      }
      if (values.email && existing.parentEmails.has(identity(values.email))) {
        issues.push({ severity: "WARNING", field: "email", message: "Parent email already exists in Edujay. Confirm this row should link another ward to the existing profile." });
      }
      if (values.wardAdmissionNumber && !existing.admissionNumbers.has(identity(values.wardAdmissionNumber))) {
        issues.push({ severity: "ERROR", field: "wardAdmissionNumber", message: "Ward admission number does not match an existing Edujay student." });
      }
    }

    if (context.areaKey === "teachers") {
      addDuplicateIssue({ issues, counts: duplicateEmails, value: values.email, field: "email", label: "Teacher email" });
      if (values.email && existing.teacherEmails.has(identity(values.email))) {
        issues.push({ severity: "SKIP", field: "email", message: "Teacher email already exists in Edujay." });
      }
      if (values.phone && existing.teacherPhones.has(identity(values.phone))) {
        issues.push({ severity: "WARNING", field: "phone", message: "Teacher phone already exists in Edujay." });
      }
    }

    if (context.areaKey === "bursars") {
      addDuplicateIssue({ issues, counts: duplicateEmails, value: values.email, field: "email", label: "Bursar email" });
      if (values.email && existing.bursarEmails.has(identity(values.email))) {
        issues.push({ severity: "SKIP", field: "email", message: "Bursar email already exists in Edujay." });
      }
      if (values.phone && existing.bursarPhones.has(identity(values.phone))) {
        issues.push({ severity: "WARNING", field: "phone", message: "Bursar phone already exists in Edujay." });
      }
    }

    if (context.areaKey === "classes") {
      addDuplicateIssue({ issues, counts: duplicateClassNames, value: values.className, field: "className", label: "Class name" });
      if (values.className && existing.classNames.has(identity(values.className))) {
        issues.push({ severity: "SKIP", field: "className", message: "Class already exists in Edujay." });
      }
      const capacity = values.capacity ? Number(values.capacity) : null;
      if (values.capacity && (capacity === null || !Number.isInteger(capacity) || capacity <= 0)) {
        issues.push({ severity: "ERROR", field: "capacity", message: "Capacity must be a positive whole number." });
      }
    }

    if (context.areaKey === "subjects") {
      addDuplicateIssue({ issues, counts: duplicateSubjectNames, value: values.subjectName, field: "subjectName", label: "Subject name" });
      if (values.subjectName && existing.subjectNames.has(identity(values.subjectName))) {
        issues.push({ severity: "SKIP", field: "subjectName", message: "Subject already exists in Edujay." });
      }
    }

    if (context.areaKey === "fees") {
      const amount = parseMoney(values.amount);
      const amountPaid = values.amountPaid ? parseMoney(values.amountPaid) : 0;
      addDuplicateIssue({
        issues,
        counts: duplicateFeeRows,
        value: uploadedFeeRowKey(values),
        field: "feeName",
        label: "Fee row for this student/term/year",
      });
      if (values.admissionNumber && !existing.admissionNumbers.has(identity(values.admissionNumber))) {
        issues.push({ severity: "ERROR", field: "admissionNumber", message: "Fee row points to a student that does not exist in Edujay." });
      }
      if (amount === null || amount <= 0) {
        issues.push({ severity: "ERROR", field: "amount", message: "Fee amount must be a positive number." });
      }
      if (amountPaid === null || amountPaid < 0) {
        issues.push({ severity: "ERROR", field: "amountPaid", message: "Amount paid must be zero or more." });
      }
      if (amount !== null && amountPaid !== null && amountPaid > amount) {
        issues.push({ severity: "WARNING", field: "amountPaid", message: "Amount paid is higher than billed amount. This may be an overpayment." });
      }
      const feeKey = `${identity(values.feeName)}:${normalizeTerm(values.term)}:${identity(values.academicYear)}`;
      if (values.feeName && values.term && values.academicYear && existing.feeKeys.has(feeKey)) {
        issues.push({ severity: "WARNING", field: "feeName", message: "A matching fee structure already exists. Confirm this is an opening balance import." });
      }
    }

    const hasError = issues.some((issue) => issue.severity === "ERROR");
    const hasSkip = issues.some((issue) => issue.severity === "SKIP");
    const status: MigrationValidationRowStatus = hasError ? "NEEDS_CORRECTION" : hasSkip ? "SKIPPED" : "READY";

    return { rowNumber, status, values, issues };
  });

  return {
    areaKey: context.areaKey,
    totalRows: rows.length,
    readyRows: rows.filter((row) => row.status === "READY" && row.issues.length === 0).length,
    skippedRows: rows.filter((row) => row.status === "SKIPPED").length,
    correctionRows: rows.filter((row) => row.status === "NEEDS_CORRECTION").length,
    warningRows: rows.filter((row) => row.issues.some((issue) => issue.severity === "WARNING")).length,
    rows,
    summaryIssues: rows.length === 0
      ? [{ severity: "ERROR", message: "No data rows were found after the header row." }]
      : [],
  };
}
