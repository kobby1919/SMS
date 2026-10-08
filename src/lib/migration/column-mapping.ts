export type MigrationAreaKey =
  | "students"
  | "parents"
  | "teachers"
  | "bursars"
  | "classes"
  | "subjects"
  | "fees"
  | "feeStructures"
  | "discounts";

export type MigrationFieldDefinition = {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
  help: string;
};

export type MigrationAreaDefinition = {
  key: MigrationAreaKey;
  label: string;
  description: string;
  fields: MigrationFieldDefinition[];
  sampleRows: string[][];
};

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export const MIGRATION_AREAS: MigrationAreaDefinition[] = [
  {
    key: "classes",
    label: "Classes",
    description: "Create the school class structure before students are mapped into classes.",
    fields: [
      { key: "className", label: "Class name", required: true, aliases: ["class", "class name", "grade class"], help: "Example: Nursery A, KG1, Class 1A." },
      { key: "gradeName", label: "Grade/level", required: true, aliases: ["grade", "level", "section"], help: "Example: Nursery, KG1, Primary 1." },
      { key: "capacity", label: "Capacity", required: false, aliases: ["capacity", "class size", "max students"], help: "Optional planned class capacity." },
    ],
    sampleRows: [["Nursery A", "Nursery", "35"], ["Class 1A", "Primary 1", "40"]],
  },
  {
    key: "subjects",
    label: "Subjects",
    description: "Prepare curriculum subjects before timetable, CA, syllabus, and reports.",
    fields: [
      { key: "subjectName", label: "Subject name", required: true, aliases: ["subject", "subject name", "course"], help: "Example: English Language, Mathematics." },
      { key: "code", label: "Subject code", required: false, aliases: ["code", "subject code"], help: "Optional school code for the subject." },
      { key: "department", label: "Department", required: false, aliases: ["department", "subject group"], help: "Optional grouping for reporting." },
    ],
    sampleRows: [["English Language", "ENG", "Languages"], ["Mathematics", "MATH", "Core"]],
  },
  {
    key: "students",
    label: "Students",
    description: "Bring admission records and class placement after classes exist.",
    fields: [
      { key: "admissionNumber", label: "Admission number", required: true, aliases: ["adm no", "admission no", "admission number", "student id"], help: "Use SCHOOLCODE-YYYY-0001 format, for example EDJ-2026-0001." },
      { key: "firstName", label: "First name", required: true, aliases: ["first name", "firstname", "given name"], help: "Student first name." },
      { key: "lastName", label: "Last name", required: true, aliases: ["last name", "surname", "family name"], help: "Student surname." },
      { key: "className", label: "Class name", required: true, aliases: ["class", "class name", "current class"], help: "Must match a class in Edujay." },
      { key: "sex", label: "Sex", required: true, aliases: ["sex", "gender"], help: "Male or Female." },
      { key: "parentName", label: "Guardian name", required: true, aliases: ["parent", "parent name", "guardian", "guardian name"], help: "Primary parent/guardian name." },
      { key: "guardianSex", label: "Guardian sex", required: true, aliases: ["guardian sex", "parent sex", "guardian gender", "parent gender"], help: "Male or Female. Used for parent titles." },
      { key: "parentEmail", label: "Guardian email", required: true, aliases: ["parent email", "guardian email", "email"], help: "Required for parent invite/login access." },
      { key: "parentPhone", label: "Guardian phone", required: false, aliases: ["parent phone", "guardian phone", "phone", "contact"], help: "Optional contact phone." },
    ],
    sampleRows: [["EDJ-2026-0001", "Ama", "Mensah", "Nursery A", "Female", "Akosua Mensah", "Female", "parent@example.com", "0240000000"]],
  },
  {
    key: "parents",
    label: "Parents and guardians",
    description: "Create guardian profiles and link them to active wards.",
    fields: [
      { key: "parentName", label: "Parent name", required: true, aliases: ["parent", "parent name", "guardian", "guardian name"], help: "Full guardian name." },
      { key: "sex", label: "Sex", required: true, aliases: ["sex", "gender", "parent sex", "guardian sex"], help: "Male or Female. Used for parent titles." },
      { key: "email", label: "Email", required: true, aliases: ["email", "email address"], help: "Required for parent invite/login access." },
      { key: "phone", label: "Phone", required: false, aliases: ["phone", "phone number", "mobile", "contact"], help: "Optional contact phone." },
      { key: "wardAdmissionNumber", label: "Ward admission number", required: true, aliases: ["ward adm no", "student admission", "admission number", "student id"], help: "Links parent to the right student. Use the official Edujay admission number." },
      { key: "relationship", label: "Relationship", required: false, aliases: ["relationship", "guardian type"], help: "Example: Mother, Father, Guardian." },
    ],
    sampleRows: [["Akosua Mensah", "Female", "parent@example.com", "0240000000", "EDJ-2026-0001", "Mother"]],
  },
  {
    key: "teachers",
    label: "Teachers",
    description: "Prepare staff profiles before secure invites and subject capability setup.",
    fields: [
      { key: "firstName", label: "First name", required: true, aliases: ["first name", "firstname", "given name"], help: "Teacher first name." },
      { key: "lastName", label: "Last name", required: true, aliases: ["last name", "surname", "family name"], help: "Teacher surname." },
      { key: "sex", label: "Sex", required: true, aliases: ["sex", "gender"], help: "Used for proper title display." },
      { key: "email", label: "Email", required: true, aliases: ["email", "email address"], help: "Teacher invite/login email." },
      { key: "phone", label: "Phone", required: false, aliases: ["phone", "phone number", "mobile"], help: "Optional contact phone." },
      { key: "teacherType", label: "Teacher type", required: false, aliases: ["teacher type", "role", "staff type"], help: "Subject teacher, class teacher, or both." },
    ],
    sampleRows: [["Samuel", "Assan", "Male", "teacher@example.com", "0240000000", "Subject Teacher"]],
  },
  {
    key: "bursars",
    label: "Bursars",
    description: "Prepare finance users before secure bursar invites.",
    fields: [
      { key: "firstName", label: "First name", required: true, aliases: ["first name", "firstname", "given name"], help: "Bursar first name." },
      { key: "lastName", label: "Last name", required: true, aliases: ["last name", "surname", "family name"], help: "Bursar surname." },
      { key: "sex", label: "Sex", required: true, aliases: ["sex", "gender"], help: "Used for proper title display." },
      { key: "email", label: "Email", required: true, aliases: ["email", "email address"], help: "Bursar invite/login email." },
      { key: "phone", label: "Phone", required: false, aliases: ["phone", "phone number", "mobile"], help: "Optional contact phone." },
    ],
    sampleRows: [["Victoria", "Mensah", "Female", "bursar@example.com", "0240000000"]],
  },
  {
    key: "feeStructures", label: "Fee structures",
    description: "Import standard charges first, then review and publish them before importing opening bills. Daily collections have separate setup.",
    fields: [
      { key: "gradeName", label: "Grade/level", required: true, aliases: ["grade", "level"], help: "An existing school grade, for example KG1." },
      { key: "term", label: "Term", required: true, aliases: ["term"], help: "TERM_1, TERM_2, or TERM_3." },
      { key: "academicYear", label: "Academic year", required: true, aliases: ["year", "session"], help: "Example: 2026/27." },
      { key: "feeName", label: "Fee item", required: true, aliases: ["fee", "fee item"], help: "Example: Tuition." },
      { key: "category", label: "Category", required: true, aliases: ["category", "fee category"], help: "TUITION, LEVY, EXAM, FEEDING, TRANSPORT, UNIFORM, LIBRARY, SPORTS, or OTHER." },
      { key: "feeFrequency", label: "Billing frequency", required: true, aliases: ["frequency", "billing frequency"], help: "TERM, MONTHLY, WEEKLY, or ONE_TIME." },
      { key: "amount", label: "Standard amount", required: true, aliases: ["amount", "standard amount"], help: "Gross charge before discounts." },
      { key: "isOptional", label: "Optional item", required: true, aliases: ["optional", "optional item"], help: "TRUE or FALSE; optional items are not automatically billed to everyone." },
      { key: "dueDate", label: "Due date", required: true, aliases: ["due date"], help: "YYYY-MM-DD. Must be consistent across a grade's term structure." },
    ],
    sampleRows: [["KG1", "TERM_1", "2026/27", "Tuition", "TUITION", "TERM", "1200", "FALSE", "2026-10-31"]],
  },
  {
    key: "fees", label: "Student opening bills",
    description: "Import historical charges and paid balances against published fee structures. Import discounts separately.",
    fields: [
      { key: "admissionNumber", label: "Admission number", required: true, aliases: ["adm no", "admission no", "student id", "admission number"], help: "Student the fee belongs to. Use SCHOOLCODE-YYYY-0001 format." },
      { key: "feeName", label: "Fee item", required: true, aliases: ["fee", "fee item", "bill item", "description"], help: "Must match the published fee item." },
      { key: "feeFrequency", label: "Billing frequency", required: true, aliases: ["frequency", "billing frequency", "fee frequency", "billing type"], help: "TERM, MONTHLY, WEEKLY, or ONE_TIME. Gate collections use daily collection setup." },
      { key: "amount", label: "Amount", required: true, aliases: ["amount", "bill amount", "total"], help: "Original charge before any discount." },
      { key: "amountPaid", label: "Opening amount paid", required: true, aliases: ["paid", "amount paid", "collected", "opening amount paid"], help: "Historical payments only; enter 0 if unpaid. Does not issue receipts or count as today's collections." },
      { key: "term", label: "Term", required: true, aliases: ["term", "semester"], help: "School term." },
      { key: "academicYear", label: "Academic year", required: true, aliases: ["academic year", "year", "session"], help: "Example: 2026/27." },
    ],
    sampleRows: [["EDJ-2026-0001", "Tuition", "TERM", "1200", "500", "TERM_1", "2026/27"]],
  },
  {
    key: "discounts", label: "Discounts and scholarships",
    description: "Import approved reductions after opening bills. A reduction lowers the balance and never counts as a payment.",
    fields: [
      { key: "admissionNumber", label: "Admission number", required: true, aliases: ["admission number", "adm no"], help: "Existing student admission number." },
      { key: "term", label: "Term", required: true, aliases: ["term"], help: "TERM_1, TERM_2, or TERM_3." },
      { key: "academicYear", label: "Academic year", required: true, aliases: ["year", "session"], help: "Identifies the student's bill." },
      { key: "discountType", label: "Discount type", required: true, aliases: ["discount type", "type"], help: "SCHOLARSHIP, SIBLING, STAFF_CHILD, BURSARY, or OTHER." },
      { key: "amount", label: "Fixed reduction", required: false, aliases: ["amount", "fixed reduction"], help: "Enter either a fixed amount or a percentage." },
      { key: "percentage", label: "Percentage", required: false, aliases: ["percentage", "percent"], help: "Percentage of the original bill total, greater than 0 and at most 100." },
      { key: "reason", label: "Reason", required: true, aliases: ["reason", "description"], help: "Reason for the approved reduction." },
      { key: "approvalReference", label: "Approval reference", required: true, aliases: ["approval reference", "reference"], help: "Unique school approval reference; prevents reimporting the same reduction." },
    ],
    sampleRows: [["EDJ-2026-0001", "TERM_1", "2026/27", "SCHOLARSHIP", "200", "", "Approved tuition scholarship", "SCH-2026-001"]],
  },
];

export function getMigrationAreaDefinition(key: MigrationAreaKey) {
  return MIGRATION_AREAS.find((area) => area.key === key) ?? MIGRATION_AREAS[0];
}

export function suggestColumnMapping(
  headers: string[],
  area: MigrationAreaDefinition,
): Record<string, string> {
  const normalizedHeaders = new Map<string, string>();
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    if (!normalized || normalizedHeaders.has(normalized)) continue;
    normalizedHeaders.set(normalized, header);
  }
  const mapping: Record<string, string> = {};

  for (const field of area.fields) {
    const candidates = [field.label, field.key, ...field.aliases].map(normalizeHeader);
    const match = candidates.find((candidate) => normalizedHeaders.has(candidate));
    if (match) {
      mapping[field.key] = normalizedHeaders.get(match) ?? "";
    }
  }

  return mapping;
}

export function buildMigrationTemplateCsv(area: MigrationAreaDefinition) {
  const headers = area.fields.map((field) => field.label);
  return [headers, ...area.sampleRows]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
}
