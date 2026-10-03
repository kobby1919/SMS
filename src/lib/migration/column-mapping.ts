export type MigrationAreaKey =
  | "students"
  | "parents"
  | "teachers"
  | "bursars"
  | "classes"
  | "subjects"
  | "fees";

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
    key: "fees",
    label: "Fees and bills",
    description: "Prepare fee balances carefully before parents see finance records.",
    fields: [
      { key: "admissionNumber", label: "Admission number", required: true, aliases: ["adm no", "admission no", "student id", "admission number"], help: "Student the fee belongs to. Use SCHOOLCODE-YYYY-0001 format." },
      { key: "feeName", label: "Fee item", required: true, aliases: ["fee", "fee item", "bill item", "description"], help: "Example: Tuition, Feeding, Bus." },
      { key: "amount", label: "Amount", required: true, aliases: ["amount", "bill amount", "total"], help: "Amount billed." },
      { key: "amountPaid", label: "Amount paid", required: false, aliases: ["paid", "amount paid", "collected"], help: "Existing amount paid, if any." },
      { key: "term", label: "Term", required: true, aliases: ["term", "semester"], help: "School term." },
      { key: "academicYear", label: "Academic year", required: true, aliases: ["academic year", "year", "session"], help: "Example: 2026/27." },
    ],
    sampleRows: [["EDJ-2026-0001", "Tuition", "1200", "500", "TERM_1", "2026/27"]],
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
