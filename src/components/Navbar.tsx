import type { AppRole } from "@/src/lib/roles";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/src/lib/prisma";
import { getSchoolBranding } from "@/src/lib/services/school-branding";
import { prepareTeacherAccountabilityForView } from "@/src/lib/services/teacher-accountability-view";
import { getTeacherSelfAccountabilityOverview } from "@/src/lib/queries/teacher-self-accountability";
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

function obligationReviewHref(obligationId: string) {
  return `/teacher/accountability?obligationId=${encodeURIComponent(obligationId)}`;
}

function needsTeacherReview(status: string, escalationStatus: string | null) {
  return status === "ESCALATED" || Boolean(escalationStatus);
}

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

  if (role === "teacher") {
    await prepareTeacherAccountabilityForView({ schoolId, teacherId: userId });
    const overview = await getTeacherSelfAccountabilityOverview({ schoolId, teacherId: userId });
    const alerts = overview.todayDuties
      .filter((duty) => !["COMPLETED", "COMPLETED_LATE", "CANCELLED"].includes(duty.status))
      .map((duty) => ({
        id: duty.id,
        title: duty.title,
        description: [
          duty.className && duty.subjectName ? `${duty.className} - ${duty.subjectName}` : null,
          duty.escalationReason ?? null,
          `Due ${duty.expectedAt.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" })}`,
        ].filter(Boolean).join("\n"),
        href: needsTeacherReview(duty.status, duty.escalationStatus)
          ? obligationReviewHref(duty.id)
          : duty.actionHref,
        priority:
          duty.status === "MISSED" || duty.status === "ESCALATED" || duty.escalationStatus
            ? "HIGH"
            : duty.priority,
        status: duty.status,
        dueAt: duty.expectedAt.toISOString(),
      }))
      .slice(0, 8);

    return <NavbarClient user={userData} teacherContext={{ alerts }} />;
  }

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
