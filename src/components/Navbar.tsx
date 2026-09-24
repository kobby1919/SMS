import type { AppRole } from "@/src/lib/roles";
import type { AppNotificationPriority, AppNotificationRecipientType, ParentNotification } from "@/src/generated/prisma";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/src/lib/prisma";
import { getSchoolBranding } from "@/src/lib/services/school-branding";
import { listActiveParentChildren } from "@/src/lib/services/parent-student-relationships";
import { prepareTeacherAccountabilityForView } from "@/src/lib/services/teacher-accountability-view";
import { getTeacherSelfAccountabilityOverview } from "@/src/lib/queries/teacher-self-accountability";
import { createNotification, markRead } from "@/src/lib/services/app-notifications";
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

const roleRecipientType: Partial<Record<AppRole, AppNotificationRecipientType>> = {
  platform_admin: "OWNER",
  admin: "ADMIN",
  teacher: "TEACHER",
  parent: "PARENT",
  bursar: "BURSAR",
};

function obligationReviewHref(obligationId: string) {
  return `/teacher/accountability?obligationId=${encodeURIComponent(obligationId)}`;
}

function canUseCentralNotifications() {
  return Boolean(
    "appNotification" in prisma &&
    "appNotificationDelivery" in prisma &&
    "appNotificationAuditLog" in prisma,
  );
}

function logNotificationBellFallback(error: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.warn("[navbar-notifications] Central notification bell fallback active.", error);
  }
}
function needsTeacherReview(status: string, escalationStatus: string | null) {
  return status === "ESCALATED" || Boolean(escalationStatus);
}

function parentNotificationHref(notification: Pick<ParentNotification, "href" | "occurredAt">) {
  const date = notification.occurredAt.toISOString().slice(0, 10);
  const href = notification.href || "/parent/updates";

  if (href === "/parent/updates" || href.startsWith("/parent/updates?")) {
    return `/parent/updates?date=${date}`;
  }

  return href;
}

function mapParentNotificationType(type: ParentNotification["type"]) {
  if (type === "DAILY_SUMMARY") return "PARENT_DAILY_SUMMARY";
  if (type === "ATTENDANCE") return "ATTENDANCE_ALERT";
  if (type === "ASSESSMENT") return "REPORT_CARD";
  if (type === "ANNOUNCEMENT") return "ANNOUNCEMENT";
  if (type === "BILL" || type === "PAYMENT") return "FINANCE_QUERY";
  return "SYSTEM";
}

function mapParentNotificationCategory(type: ParentNotification["type"]) {
  if (type === "ATTENDANCE") return "ATTENDANCE";
  if (type === "ASSESSMENT" || type === "ASSIGNMENT") return "ACADEMIC";
  if (type === "BILL" || type === "PAYMENT") return "FINANCE";
  return "GENERAL";
}

function mapParentNotificationPriority(priority: ParentNotification["priority"]): AppNotificationPriority {
  if (priority === "HIGH") return "HIGH";
  if (priority === "LOW") return "LOW";
  return "NORMAL";
}

async function syncParentNotificationsToAppNotifications({
  schoolId,
  parentId,
  notifications,
}: {
  schoolId: string;
  parentId: string;
  notifications: Array<ParentNotification & { student?: { name: string; surname: string } | null }>;
}) {
  if (!canUseCentralNotifications()) return;

  try {
    for (const notification of notifications) {
      const appNotification = await createNotification({
        schoolId,
        recipientType: "PARENT",
        recipientId: parentId,
        type: mapParentNotificationType(notification.type),
        category: mapParentNotificationCategory(notification.type),
        priority: mapParentNotificationPriority(notification.priority),
        title: notification.title,
        body: notification.body,
        href: parentNotificationHref(notification),
        sourceModel: "ParentNotification",
        sourceId: notification.id,
        idempotencyKey: `parent-notification:${notification.id}`,
        payload: {
          parentNotificationId: notification.id,
          studentName: notification.student ? `${notification.student.name} ${notification.student.surname}` : null,
        },
        deliveries: [{ channel: "IN_APP", destination: parentId }],
      });

      if (notification.readAt && !appNotification.readAt) {
        await markRead({
          schoolId,
          notificationId: appNotification.id,
          recipientType: "PARENT",
          recipientId: parentId,
        });
      }
    }
  } catch (error) {
    logNotificationBellFallback(error);
  }
}

async function syncTeacherAlertsToAppNotifications({
  schoolId,
  teacherId,
  alerts,
}: {
  schoolId: string;
  teacherId: string;
  alerts: Array<{
    id: string;
    title: string;
    description: string;
    href: string;
    priority: string;
    status: string;
    dueAt: string;
  }>;
}) {
  if (!canUseCentralNotifications()) return;

  try {
    for (const alert of alerts) {
      await createNotification({
        schoolId,
        recipientType: "TEACHER",
        recipientId: teacherId,
        type: "ACCOUNTABILITY_ALERT",
        category: "ACCOUNTABILITY",
        priority: alert.priority === "LOW" ? "LOW" : alert.priority === "NORMAL" ? "NORMAL" : "HIGH",
        title: alert.title,
        body: alert.description,
        href: alert.href,
        sourceModel: "TeacherObligation",
        sourceId: alert.id,
        idempotencyKey: `teacher-obligation:${alert.id}`,
        payload: {
          status: alert.status,
          dueAt: alert.dueAt,
        },
        deliveries: [{ channel: "IN_APP", destination: teacherId }],
      });
    }
  } catch (error) {
    logNotificationBellFallback(error);
  }
}

async function getNavbarNotificationContext({
  schoolId,
  userId,
  role,
}: {
  schoolId: string;
  userId: string;
  role: AppRole;
}) {
  const recipientType = roleRecipientType[role];
  if (!recipientType || !canUseCentralNotifications()) return { items: [], unreadCount: 0 };

  const where = {
    schoolId,
    recipientType,
    recipientId: userId,
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };

  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.appNotification.findMany({
        where,
        select: {
          id: true,
          type: true,
          category: true,
          priority: true,
          title: true,
          body: true,
          href: true,
          createdAt: true,
          readAt: true,
        },
        orderBy: [{ readAt: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
        take: 10,
      }),
      prisma.appNotification.count({ where: { ...where, readAt: null } }),
    ]);

    return {
      unreadCount,
      items: notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        category: notification.category,
        priority: notification.priority,
        title: notification.title,
        description: notification.body,
        href: notification.href ?? `/${role}`,
        createdAt: notification.createdAt.toISOString(),
        readAt: notification.readAt?.toISOString() ?? null,
      })),
    };
  } catch (error) {
    logNotificationBellFallback(error);
    return { items: [], unreadCount: 0 };
  }
}

async function syncSignedInProfilePhoto({
  role,
  userId,
  schoolId,
  imageUrl,
}: {
  role: AppRole;
  userId: string;
  schoolId: string;
  imageUrl?: string | null;
}) {
  if (role !== "teacher" || !imageUrl) return;

  await prisma.teacher
    .updateMany({
      where: {
        id: userId,
        schoolId,
        NOT: { img: imageUrl },
      },
      data: { img: imageUrl },
    })
    .catch(() => null);
}

const Navbar = async ({ role, userId, schoolId }: Props) => {
  const [clerkUser, branding] = await Promise.all([
    currentUser().catch(() => null),
    role === "platform_admin"
      ? Promise.resolve(null)
      : getSchoolBranding(schoolId).catch(() => null),
  ]);

  await syncSignedInProfilePhoto({
    role,
    userId,
    schoolId,
    imageUrl: clerkUser?.imageUrl,
  });

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

    await syncTeacherAlertsToAppNotifications({ schoolId, teacherId: userId, alerts });
    const notificationContext = await getNavbarNotificationContext({ schoolId, userId, role });

    return <NavbarClient user={userData} appNotifications={notificationContext.items} appNotificationUnreadCount={notificationContext.unreadCount} />;
  }

  if (role !== "parent") {
    const notificationContext = await getNavbarNotificationContext({ schoolId, userId, role });
    return <NavbarClient user={userData} appNotifications={notificationContext.items} appNotificationUnreadCount={notificationContext.unreadCount} />;
  }

  const [parent, children, parentNotifications] = await Promise.all([
    prisma.parent.findFirst({
      where: { id: userId, schoolId },
      select: {
        id: true,
        name: true,
        surname: true,
      },
    }),
    listActiveParentChildren(userId, schoolId),
    prisma.parentNotification.findMany({
      where: { schoolId, parentId: userId },
      include: {
        student: { select: { name: true, surname: true } },
      },
      orderBy: [{ readAt: "asc" }, { occurredAt: "desc" }, { createdAt: "desc" }],
      take: 10,
    }),
  ]);

  await syncParentNotificationsToAppNotifications({
    schoolId,
    parentId: userId,
    notifications: parentNotifications,
  });

  const notificationContext = await getNavbarNotificationContext({ schoolId, userId, role });

  return (
    <NavbarClient
      user={{
        ...userData,
        fullName: parent ? `${parent.name} ${parent.surname}` : userData.fullName,
      }}
      parentContext={{
        children: children.map((student) => ({
          id: student.id,
          name: `${student.name} ${student.surname}`,
          className: student.class?.name ?? "Class not set",
        })),
      }}
      appNotifications={notificationContext.items}
      appNotificationUnreadCount={notificationContext.unreadCount}
    />
  );
};

export default Navbar;
