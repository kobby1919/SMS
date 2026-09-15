import prisma from "@/src/lib/prisma";

export type IdentityRole =
  | "platform_admin"
  | "admin"
  | "teacher"
  | "parent"
  | "student"
  | "bursar";

export type TestIdentityPlanItem = {
  role: IdentityRole;
  title: string;
  accountRule: string;
  inviteFlow: string;
  recommendedEmail: string;
  status: "ready" | "implemented" | "planned";
};

export type IdentityAuditIssue = {
  severity: "critical" | "warning";
  title: string;
  detail: string;
  affected: string[];
};

export type RoleIdentityReadiness = {
  schoolId: string;
  testPlan: TestIdentityPlanItem[];
  counts: {
    admins: number;
    teachers: number;
    parents: number;
    students: number;
  };
  issues: IdentityAuditIssue[];
  healthy: boolean;
};

type IdentityRecord = {
  role: Exclude<IdentityRole, "platform_admin" | "bursar">;
  id: string;
  username: string;
  email: string | null;
  label: string;
};

const DEFAULT_TEST_DOMAIN = "edujay.test";

export const defaultSchoolTestIdentityPlan: TestIdentityPlanItem[] = [
  {
    role: "platform_admin",
    title: "Platform admin",
    accountRule: "Internal Edujay operator account only.",
    inviteFlow: "Created intentionally by Edujay, not by a school invite.",
    recommendedEmail: `platform-admin@${DEFAULT_TEST_DOMAIN}`,
    status: "ready",
  },
  {
    role: "admin",
    title: "School admin",
    accountRule: "First school owner/admin must accept a school admin invite.",
    inviteFlow: "Platform approval creates the school and sends /onboarding/accept.",
    recommendedEmail: `school-admin@${DEFAULT_TEST_DOMAIN}`,
    status: "implemented",
  },
  {
    role: "teacher",
    title: "Teacher",
    accountRule: "Teacher must accept a teacher invite with the invited email.",
    inviteFlow: "School admin sends /onboarding/teacher/accept.",
    recommendedEmail: `teacher-one@${DEFAULT_TEST_DOMAIN}`,
    status: "implemented",
  },
  {
    role: "parent",
    title: "Parent",
    accountRule: "Parent should be linked to wards through a parent invite flow.",
    inviteFlow: "Parent invite/linking flow is the next production target.",
    recommendedEmail: `parent-one@${DEFAULT_TEST_DOMAIN}`,
    status: "planned",
  },
  {
    role: "bursar",
    title: "Bursar",
    accountRule: "Finance staff should be invited as staff, not manually shared.",
    inviteFlow: "Staff/bursar invite flow is planned after parent/teacher hardening.",
    recommendedEmail: `bursar@${DEFAULT_TEST_DOMAIN}`,
    status: "planned",
  },
];

function normalizeEmail(value: string | null | undefined) {
  const email = value?.trim().toLowerCase();
  return email && email.includes("@") ? email : null;
}

function displayRecord(record: IdentityRecord) {
  return `${record.role}:${record.label} (${record.id})`;
}

function pushDuplicateIssues(
  issues: IdentityAuditIssue[],
  records: IdentityRecord[],
  keyName: "Clerk/user id" | "email",
  keyOf: (record: IdentityRecord) => string | null,
) {
  const groups = new Map<string, IdentityRecord[]>();

  for (const record of records) {
    const key = keyOf(record);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  for (const [key, group] of groups) {
    const roles = new Set(group.map((record) => record.role));
    if (group.length < 2 || roles.size < 2) continue;

    issues.push({
      severity: "critical",
      title: `Shared ${keyName} across roles`,
      detail:
        `${key} is connected to multiple Edujay roles. Production login must use ` +
        "one real person/account per role until multi-role memberships are designed.",
      affected: group.map(displayRecord),
    });
  }
}

function pushSeededIdWarnings(
  issues: IdentityAuditIssue[],
  records: IdentityRecord[],
) {
  const seededRecords = records.filter(
    (record) =>
      record.role !== "student" &&
      !record.id.startsWith("user_") &&
      !record.id.startsWith("school_"),
  );

  if (seededRecords.length === 0) return;

  issues.push({
    severity: "warning",
    title: "Demo operational records still exist",
    detail:
      "These records keep the default-school timetable, students, and parent links usable during testing. " +
      "Do not treat them as login identities; replace them gradually through invite/import flows.",
    affected: seededRecords.slice(0, 12).map(displayRecord),
  });
}

export async function getRoleIdentityReadiness(
  schoolId = "default-school",
): Promise<RoleIdentityReadiness> {
  const [admins, teachers, parents, students] = await Promise.all([
    prisma.admin.findMany({
      where: { schoolId },
      select: { id: true, username: true },
      orderBy: { username: "asc" },
    }),
    prisma.teacher.findMany({
      where: { schoolId },
      select: { id: true, username: true, email: true, name: true, surname: true },
      orderBy: [{ name: "asc" }, { surname: "asc" }],
    }),
    prisma.parent.findMany({
      where: { schoolId },
      select: { id: true, username: true, email: true, name: true, surname: true },
      orderBy: [{ name: "asc" }, { surname: "asc" }],
    }),
    prisma.student.findMany({
      where: { schoolId },
      select: { id: true, username: true, email: true, name: true, surname: true },
      orderBy: [{ name: "asc" }, { surname: "asc" }],
    }),
  ]);

  const records: IdentityRecord[] = [
    ...admins.map((admin) => ({
      role: "admin" as const,
      id: admin.id,
      username: admin.username,
      email: normalizeEmail(admin.username),
      label: admin.username,
    })),
    ...teachers.map((teacher) => ({
      role: "teacher" as const,
      id: teacher.id,
      username: teacher.username,
      email: normalizeEmail(teacher.email) ?? normalizeEmail(teacher.username),
      label: `${teacher.name} ${teacher.surname}`.trim() || teacher.username,
    })),
    ...parents.map((parent) => ({
      role: "parent" as const,
      id: parent.id,
      username: parent.username,
      email: normalizeEmail(parent.email) ?? normalizeEmail(parent.username),
      label: `${parent.name} ${parent.surname}`.trim() || parent.username,
    })),
    ...students.map((student) => ({
      role: "student" as const,
      id: student.id,
      username: student.username,
      email: normalizeEmail(student.email) ?? normalizeEmail(student.username),
      label: `${student.name} ${student.surname}`.trim() || student.username,
    })),
  ];

  const issues: IdentityAuditIssue[] = [];

  pushDuplicateIssues(issues, records, "Clerk/user id", (record) => record.id);
  pushDuplicateIssues(issues, records, "email", (record) => record.email);
  pushSeededIdWarnings(issues, records);

  return {
    schoolId,
    testPlan: defaultSchoolTestIdentityPlan,
    counts: {
      admins: admins.length,
      teachers: teachers.length,
      parents: parents.length,
      students: students.length,
    },
    issues,
    healthy: !issues.some((issue) => issue.severity === "critical"),
  };
}
