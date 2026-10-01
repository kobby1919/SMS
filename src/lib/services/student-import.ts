import { createHash, randomUUID } from "crypto";
import { Prisma, StudentStatus, UserSex } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { revalidateDashboard, revalidateReferenceData } from "@/src/lib/cacheTags";
import { studentRecordUsername } from "@/src/lib/services/user-management";

const REQUIRED_HEADERS = [
  "admissionNumber",
  "firstName",
  "lastName",
  "sex",
  "className",
  "parentName",
] as const;

const OPTIONAL_HEADERS = [
  "parentPhone",
  "parentEmail",
  "studentEmail",
  "studentPhone",
  "address",
  "bloodType",
] as const;

export const STUDENT_IMPORT_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS] as const;
export const STUDENT_IMPORT_TEMPLATE = `${STUDENT_IMPORT_HEADERS.join(",")}
EDJ-0001,Akosua,Mensah,FEMALE,Class 1A,Ama Mensah,0200000001,ama@example.com,,,Accra,B+
EDJ-0002,Kofi,Mensah,MALE,Class 1A,Ama Mensah,0200000001,ama@example.com,,,Accra,O+`;

type StudentImportHeader = (typeof STUDENT_IMPORT_HEADERS)[number];

type ParsedStudentRow = Record<StudentImportHeader, string> & {
  rowNumber: number;
};

type ExistingParentIdentity = {
  id: string;
  email: string | null;
  phone: string | null;
};

export type StudentImportResult = {
  imported: number;
  createdStudents: number;
  linkedParents: number;
  createdParentProfiles: number;
  matchedExistingParentProfiles: number;
  parentsCreated: number;
  parentsLinked: number;
  rowsSkipped: number;
  rowsNeedingCorrection: number;
  correctionReport: string[];
};

export class StudentImportError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly errors: string[] = [],
    readonly rowCount = 0,
  ) {
    super(message);
    this.name = "StudentImportError";
  }
}

export function emptyStudentImportResult(errors: string[] = [], rowCount = 0): StudentImportResult {
  return {
    imported: 0,
    createdStudents: 0,
    linkedParents: 0,
    createdParentProfiles: 0,
    matchedExistingParentProfiles: 0,
    parentsCreated: 0,
    parentsLinked: 0,
    rowsSkipped: rowCount,
    rowsNeedingCorrection: countRowsNeedingCorrection(errors),
    correctionReport: errors,
  };
}

function normalizeHeader(value: string) {
  return value.trim().replace(/^\uFEFF/, "");
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === "\"" && inQuotes && next === "\"") {
      current += "\"";
      i++;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseStudentCsv(csv: string) {
  const lines = csv
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new StudentImportError("Upload a CSV file with a header row and at least one student row.");
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new StudentImportError(`Missing required column${missingHeaders.length === 1 ? "" : "s"}: ${missingHeaders.join(", ")}.`);
  }

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    if (values.length > headers.length) {
      throw new StudentImportError(
        `Row ${index + 2} has more values than the header row. If a value contains a comma, wrap it in quotes.`,
      );
    }
    const row = { rowNumber: index + 2 } as ParsedStudentRow;
    for (const header of STUDENT_IMPORT_HEADERS) {
      const headerIndex = headers.indexOf(header);
      row[header] = headerIndex >= 0 ? (values[headerIndex] ?? "").trim() : "";
    }
    return row;
  });
}

function normalizeAdmissionNumber(value: string) {
  return value.trim().toUpperCase();
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  return email || null;
}

function normalizePhone(value: string) {
  const phone = value.replace(/\s+/g, "").trim();
  return phone || null;
}

function normalizeClassName(value: string) {
  return value.trim().toLowerCase();
}

function splitParentName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return {
    name: parts[0] ?? "Guardian",
    surname: parts.slice(1).join(" ") || "Guardian",
  };
}

function parentIdentityKey(row: ParsedStudentRow) {
  const email = normalizeEmail(row.parentEmail);
  const phone = normalizePhone(row.parentPhone);
  if (email) return `email:${email}`;
  if (phone) return `phone:${phone.replace(/\s+/g, "")}`;
  return null;
}

function parentIdentityDisplay(row: ParsedStudentRow) {
  const email = normalizeEmail(row.parentEmail);
  const phone = normalizePhone(row.parentPhone);
  return [email, phone].filter(Boolean).join(" / ");
}

function generatedParentUsername(schoolId: string, identityKey: string) {
  const hash = createHash("sha256").update(`${schoolId}:${identityKey}`).digest("hex").slice(0, 24);
  return `parent:${schoolId}:${hash}`;
}

function validateRows(rows: ParsedStudentRow[]) {
  const errors: string[] = [];
  const seenAdmissionNumbers = new Set<string>();
  const parentContactByEmail = new Map<string, string | null>();
  const parentContactByPhone = new Map<string, string | null>();

  rows.forEach((row) => {
    const rowLabel = `Row ${row.rowNumber}`;
    const admissionNumber = normalizeAdmissionNumber(row.admissionNumber);

    if (!admissionNumber) errors.push(`${rowLabel}: admissionNumber is required.`);
    if (admissionNumber && seenAdmissionNumbers.has(admissionNumber)) {
      errors.push(`${rowLabel}: duplicate admissionNumber ${admissionNumber} appears in this file.`);
    }
    seenAdmissionNumbers.add(admissionNumber);

    if (!row.firstName.trim()) errors.push(`${rowLabel}: firstName is required.`);
    if (!row.lastName.trim()) errors.push(`${rowLabel}: lastName is required.`);
    if (!Object.values(UserSex).includes(row.sex.trim().toUpperCase() as UserSex)) {
      errors.push(`${rowLabel}: sex must be MALE or FEMALE.`);
    }
    if (!row.className.trim()) errors.push(`${rowLabel}: className is required.`);
    if (!row.parentName.trim()) errors.push(`${rowLabel}: parentName is required.`);
    if (!parentIdentityKey(row)) errors.push(`${rowLabel}: provide parentPhone or parentEmail so Edujay can link the guardian.`);
    if (row.parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.parentEmail.trim())) {
      errors.push(`${rowLabel}: parentEmail is not valid.`);
    }
    if (row.studentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.studentEmail.trim())) {
      errors.push(`${rowLabel}: studentEmail is not valid.`);
    }

    const parentEmail = normalizeEmail(row.parentEmail);
    const parentPhone = normalizePhone(row.parentPhone);
    if (parentEmail) {
      const previousPhone = parentContactByEmail.get(parentEmail);
      if (parentContactByEmail.has(parentEmail) && previousPhone !== parentPhone) {
        errors.push(`${rowLabel}: parentEmail ${parentEmail} appears with different phone numbers.`);
      }
      parentContactByEmail.set(parentEmail, parentPhone);
    }
    if (parentPhone) {
      const previousEmail = parentContactByPhone.get(parentPhone);
      if (parentContactByPhone.has(parentPhone) && previousEmail !== parentEmail) {
        errors.push(`${rowLabel}: parentPhone ${parentPhone} appears with different email addresses.`);
      }
      parentContactByPhone.set(parentPhone, parentEmail);
    }
  });

  return errors;
}

function countRowsNeedingCorrection(errors: string[]) {
  const rowNumbers = new Set<number>();
  for (const error of errors) {
    const match = error.match(/^Row\s+(\d+)/i);
    if (match?.[1]) rowNumbers.add(Number(match[1]));
  }
  return rowNumbers.size || (errors.length > 0 ? 1 : 0);
}

function resolveExistingParentForRow(
  row: ParsedStudentRow,
  parentsByEmail: Map<string, ExistingParentIdentity>,
  parentsByPhone: Map<string, ExistingParentIdentity>,
) {
  const parentEmail = normalizeEmail(row.parentEmail);
  const parentPhone = normalizePhone(row.parentPhone);
  const emailMatch = parentEmail ? parentsByEmail.get(parentEmail) ?? null : null;
  const phoneMatch = parentPhone ? parentsByPhone.get(parentPhone) ?? null : null;

  if (emailMatch && phoneMatch && emailMatch.id !== phoneMatch.id) {
    throw new StudentImportError(
      "Fix guardian contact conflicts and upload again.",
      400,
      [
        `Row ${row.rowNumber}: ${parentIdentityDisplay(row)} matches two different guardian records already in Edujay.`,
      ],
    );
  }

  return emailMatch ?? phoneMatch ?? null;
}

export async function importStudentsFromCsv(schoolId: string, csv: string): Promise<StudentImportResult> {
  const rows = parseStudentCsv(csv);
  if (rows.length > 500) {
    throw new StudentImportError("Import at most 500 students at a time so the school can review mistakes properly.");
  }

  const rowErrors = validateRows(rows);
  if (rowErrors.length > 0) {
    throw new StudentImportError("Fix the CSV errors and upload again.", 400, rowErrors, rows.length);
  }

  const admissionNumbers = rows.map((row) => normalizeAdmissionNumber(row.admissionNumber));
  const classNames = Array.from(new Set(rows.map((row) => normalizeClassName(row.className))));

  const parentEmails = rows.map((row) => normalizeEmail(row.parentEmail)).filter((email): email is string => Boolean(email));
  const parentPhones = rows.map((row) => normalizePhone(row.parentPhone)).filter((phone): phone is string => Boolean(phone));

  const [existingStudents, classes, existingParents] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId, admissionNumber: { in: admissionNumbers } },
      select: { admissionNumber: true },
    }),
    prisma.class.findMany({
      where: { schoolId },
      select: { id: true, name: true, gradeId: true },
    }),
    prisma.parent.findMany({
      where: {
        schoolId,
        OR: [
          ...(parentEmails.length ? [{ email: { in: parentEmails, mode: Prisma.QueryMode.insensitive } }] : []),
          ...(parentPhones.length ? [{ phone: { in: parentPhones } }] : []),
        ],
      },
      select: { id: true, email: true, phone: true },
    }),
  ]);

  const existingAdmissionNumbers = new Set(existingStudents.map((student) => student.admissionNumber?.toUpperCase()));
  const classByName = new Map(classes.map((klass) => [normalizeClassName(klass.name), klass]));
  const parentsByEmail = new Map(
    existingParents
      .map((parent) => parent.email ? [parent.email.toLowerCase(), parent] as const : null)
      .filter((entry): entry is readonly [string, ExistingParentIdentity] => Boolean(entry)),
  );
  const parentsByPhone = new Map(
    existingParents
      .map((parent) => parent.phone ? [normalizePhone(parent.phone), parent] as const : null)
      .filter((entry): entry is readonly [string, ExistingParentIdentity] => Boolean(entry?.[0])),
  );
  const lookupErrors: string[] = [];

  for (const row of rows) {
    const admissionNumber = normalizeAdmissionNumber(row.admissionNumber);
    const className = normalizeClassName(row.className);
    if (existingAdmissionNumbers.has(admissionNumber)) {
      lookupErrors.push(`Row ${row.rowNumber}: admissionNumber ${admissionNumber} already exists.`);
    }
    if (!classByName.has(className)) {
      lookupErrors.push(`Row ${row.rowNumber}: className "${row.className}" does not match an Edujay class.`);
    }
    try {
      resolveExistingParentForRow(row, parentsByEmail, parentsByPhone);
    } catch (error) {
      if (error instanceof StudentImportError) lookupErrors.push(...error.errors);
      else throw error;
    }
  }

  const unusedClassNames = classNames.filter((className) => !classByName.has(className));
  if (unusedClassNames.length > 0) {
    lookupErrors.push(`Unknown classes in file: ${unusedClassNames.join(", ")}.`);
  }

  if (lookupErrors.length > 0) {
    throw new StudentImportError("Fix the CSV lookup errors and upload again.", 400, lookupErrors, rows.length);
  }

  let parentsCreated = 0;
  let matchedExistingParentProfiles = 0;
  const parentIdByIdentity = new Map<string, string>();

  try {
    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const identityKey = parentIdentityKey(row);
        if (!identityKey) throw new StudentImportError(`Row ${row.rowNumber}: parent contact is required.`);

        let parentId = parentIdByIdentity.get(identityKey);
        if (!parentId) {
          const parentEmail = normalizeEmail(row.parentEmail);
          const parentPhone = normalizePhone(row.parentPhone);
          const existingParent = resolveExistingParentForRow(row, parentsByEmail, parentsByPhone);

          if (existingParent) {
            parentId = existingParent.id;
            matchedExistingParentProfiles++;
          } else {
            const parentName = splitParentName(row.parentName);
            const parent = await tx.parent.create({
              data: {
                id: `par_${randomUUID()}`,
                schoolId,
                username: generatedParentUsername(schoolId, identityKey),
                name: parentName.name,
                surname: parentName.surname,
                email: parentEmail,
                phone: parentPhone,
                address: row.address || "Not provided",
              },
              select: { id: true },
            });
            parentId = parent.id;
            parentsCreated++;
          }
          parentIdByIdentity.set(identityKey, parentId);
        } else {
          matchedExistingParentProfiles++;
        }

        const admissionNumber = normalizeAdmissionNumber(row.admissionNumber);
        const klass = classByName.get(normalizeClassName(row.className));
        if (!klass) throw new StudentImportError(`Row ${row.rowNumber}: className "${row.className}" was not found.`);

        const student = await tx.student.create({
          data: {
            id: `stu_${randomUUID()}`,
            schoolId,
            username: studentRecordUsername(schoolId, admissionNumber),
            admissionNumber,
            name: row.firstName.trim(),
            surname: row.lastName.trim(),
            email: normalizeEmail(row.studentEmail),
            phone: normalizePhone(row.studentPhone),
            address: row.address || "Not provided",
            bloodType: row.bloodType || "Not provided",
            sex: row.sex.trim().toUpperCase() as UserSex,
            status: StudentStatus.ACTIVE,
            parentId,
            classId: klass.id,
            gradeId: klass.gradeId,
          },
          select: { id: true },
        });

        await tx.parentStudentRelationship.upsert({
          where: {
            schoolId_parentId_studentId: {
              schoolId,
              parentId,
              studentId: student.id,
            },
          },
          update: {
            status: "ACTIVE",
            role: "PRIMARY_GUARDIAN",
            canViewFees: true,
            canViewReports: true,
            canMessageSchool: true,
            endedAt: null,
            note: "Linked during student CSV import.",
          },
          create: {
            schoolId,
            parentId,
            studentId: student.id,
            role: "PRIMARY_GUARDIAN",
            status: "ACTIVE",
            canViewFees: true,
            canViewReports: true,
            canMessageSchool: true,
            note: "Linked during student CSV import.",
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new StudentImportError("A duplicate admission number or generated guardian identity was found. Review the CSV and upload again.");
    }
    throw error;
  }

  revalidateReferenceData(schoolId, "students");
  revalidateReferenceData(schoolId, "parents");
  revalidateDashboard(schoolId);

  return {
    imported: rows.length,
    createdStudents: rows.length,
    linkedParents: rows.length,
    createdParentProfiles: parentsCreated,
    matchedExistingParentProfiles,
    parentsCreated,
    parentsLinked: rows.length,
    rowsSkipped: 0,
    rowsNeedingCorrection: 0,
    correctionReport: [],
  };
}
