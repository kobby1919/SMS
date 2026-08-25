import type { AppRole } from "@/src/lib/roles";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/src/lib/prisma";
import { getSchoolBranding } from "@/src/lib/services/school-branding";
import NavbarClient from "./NavbarClient";

type Props = {
  role: AppRole;
  userId: string;
  schoolId: string;
};

const roleLabel: Record<AppRole, string> = {
  platform_admin: "Platform Admin",
  admin: "Admin",
  teacher: "Teacher",
  student: "Student",
  parent: "Parent",
  bursar: "Bursar",
};

const Navbar = async ({ role, userId, schoolId }: Props) => {
  const [clerkUser, branding] = await Promise.all([
    currentUser().catch(() => null),
    role === "platform_admin"
      ? Promise.resolve(null)
      : getSchoolBranding(schoolId).catch(() => null),
  ]);

  const userData = {
    fullName:
      clerkUser?.fullName ||
      clerkUser?.username ||
      clerkUser?.primaryEmailAddress?.emailAddress ||
      roleLabel[role],
    role,
    schoolName: branding?.displayName ?? "Edujay",
  };

  if (role !== "parent") {
    return <NavbarClient user={userData} />;
  }

  const [parent, notifications] = await Promise.all([
    prisma.parent.findFirst({
      where: { id: userId, schoolId },
      select: {
        id: true,
        name: true,
        surname: true,
        students: {
          where: { schoolId },
          select: {
            id: true,
            name: true,
            surname: true,
            class: { select: { name: true } },
          },
          orderBy: [{ name: "asc" }, { surname: "asc" }],
        },
      },
    }),
    prisma.parentNotification.findMany({
      where: { schoolId, parentId: userId },
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        href: true,
        occurredAt: true,
        readAt: true,
        student: { select: { name: true, surname: true } },
      },
      orderBy: [{ readAt: "asc" }, { occurredAt: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
  ]);

  return (
    <NavbarClient
      user={{
        ...userData,
        fullName: parent ? `${parent.name} ${parent.surname}` : userData.fullName,
      }}
      parentContext={{
        children: parent?.students.map((student) => ({
          id: student.id,
          name: `${student.name} ${student.surname}`,
          className: student.class?.name ?? "Class not set",
        })) ?? [],
        notifications: notifications.map((notification) => ({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          description: notification.body,
          href: notification.href ?? "/parent/updates",
          occurredAt: notification.occurredAt.toISOString(),
          readAt: notification.readAt?.toISOString() ?? null,
          childName: notification.student
            ? `${notification.student.name} ${notification.student.surname}`
            : null,
        })),
      }}
    />
  );
};

export default Navbar;
