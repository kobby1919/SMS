import type { UserSex } from "@/src/generated/prisma";
import { formatTitledFullName } from "@/src/lib/format-role-name";

export type TeacherFollowUpItem = {
  id: string;
  teacherId: string;
  teacherName: string;
  kind: "ATTENDANCE" | "HOMEWORK_CHECKING" | "CA_SCORE_PUBLISHING" | "ESCALATION" | "CORRECTION";
  title: string;
  detail: string;
  at: string;
  reviewId: string | null;
  correctionKind: "ATTENDANCE" | "HOMEWORK" | "ACADEMIC" | null;
};

export function teacherFollowUpName(person: { name: string; surname: string; sex: UserSex | null }) {
  return formatTitledFullName(person, "Teacher");
}

export function isOutstandingDuty(input: { deadline: Date; complete: boolean; status?: string; completedAt?: Date | null; exception?: boolean }, now: Date) {
  return Number.isFinite(input.deadline.getTime()) && input.deadline < now && !input.complete && !input.completedAt && !input.exception && !["COMPLETED", "COMPLETED_LATE", "CANCELLED"].includes(input.status ?? "");
}

export function summarizeTeacherFollowUps(items: TeacherFollowUpItem[]) {
  const unique = [...new Map(items.map((item) => [item.id, item])).values()];
  const groups = new Map<string, { teacherId: string; teacherName: string; duties: number; escalations: number; corrections: number; attendance: number; homework: number; ca: number; oldestAt: string; href: string }>();
  for (const item of unique) {
    const group = groups.get(item.teacherId) ?? { teacherId: item.teacherId, teacherName: item.teacherName, duties: 0, escalations: 0, corrections: 0, attendance: 0, homework: 0, ca: 0, oldestAt: item.at, href: `/admin/accountability/follow-up?teacherId=${encodeURIComponent(item.teacherId)}` };
    if (item.kind === "ESCALATION") group.escalations++;
    else if (item.kind === "CORRECTION") group.corrections++;
    else { group.duties++; if (item.kind === "ATTENDANCE") group.attendance++; if (item.kind === "HOMEWORK_CHECKING") group.homework++; if (item.kind === "CA_SCORE_PUBLISHING") group.ca++; }
    if (item.at < group.oldestAt) group.oldestAt = item.at;
    groups.set(item.teacherId, group);
  }
  const teachers = [...groups.values()].sort((a, b) => b.escalations - a.escalations || a.oldestAt.localeCompare(b.oldestAt) || b.duties - a.duties || a.teacherId.localeCompare(b.teacherId));
  return { totals: { overdue: unique.filter((item) => !["ESCALATION", "CORRECTION"].includes(item.kind)).length, escalations: unique.filter((item) => item.kind === "ESCALATION").length, corrections: unique.filter((item) => item.kind === "CORRECTION").length, teachers: teachers.length }, followUps: teachers.slice(0, 5) };
}
