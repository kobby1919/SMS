import prisma from "@/src/lib/prisma";
import { requirePageSession } from "@/src/lib/authz";
import UserCardClient from "./UserCardClient ";

type UserCardType = "admin" | "teacher" | "student" | "parent";

export default async function UserCard({ type }: { type: UserCardType }) {
  const { schoolId } = await requirePageSession();

  let count: number;
  switch (type) {
    case "admin":
      count = await prisma.admin.count({ where: { schoolId } });
      break;
    case "teacher":
      count = await prisma.teacher.count({ where: { schoolId } });
      break;
    case "student":
      count = await prisma.student.count({ where: { schoolId } });
      break;
    case "parent":
      count = await prisma.parent.count({ where: { schoolId } });
      break;
  }

  return <UserCardClient type={type} count={count} />;
}
