import type { Prisma } from "@/src/generated/prisma";

export class ParentInviteProfileError extends Error {}

export async function findParentInviteProfile(db: Pick<Prisma.TransactionClient, "parent">, schoolId: string, email: string) {
  const matches = await db.parent.findMany({
    where: { schoolId, email: { equals: email.trim().toLowerCase(), mode: "insensitive" } },
    take: 2,
    select: {
      id: true, name: true, surname: true, sex: true, email: true, phone: true,
      acceptedInvites: { where: { schoolId, acceptedAt: { not: null } }, select: { id: true }, take: 1 },
      studentRelationships: {
        where: { schoolId, status: "ACTIVE", endedAt: null, student: { schoolId, status: "ACTIVE" } },
        select: { studentId: true, student: { select: { id: true, name: true, surname: true, class: { select: { name: true } } } } },
      },
    },
  });
  if (matches.length > 1) throw new ParentInviteProfileError("Multiple parent profiles use this email. Resolve the duplicate profiles before inviting.");
  return matches[0] ?? null;
}

export function parentProfileHasAccount(profile: { id: string; acceptedInvites: { id: string }[] }) {
  return profile.id.startsWith("user_") || profile.acceptedInvites.length > 0;
}
