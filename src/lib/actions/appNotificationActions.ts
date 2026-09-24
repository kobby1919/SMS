"use server";

import { revalidatePath } from "next/cache";
import type { AppNotificationRecipientType } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { requireRole, type AppRole } from "@/src/lib/authz";
import { markRead } from "@/src/lib/services/app-notifications";

const roleToRecipientType: Partial<Record<AppRole, AppNotificationRecipientType>> = {
  admin: "ADMIN",
  teacher: "TEACHER",
  parent: "PARENT",
  bursar: "BURSAR",
  platform_admin: "OWNER",
};

async function getNotificationContext() {
  const context = await requireRole(["admin", "teacher", "parent", "bursar", "platform_admin"]);
  const recipientType = roleToRecipientType[context.role];
  if (!recipientType) throw new Error("Notifications are not available for this role yet.");
  return { ...context, recipientType };
}

export async function markAppNotificationRead(notificationId: string) {
  const { schoolId, userId, recipientType } = await getNotificationContext();

  await markRead({
    schoolId,
    notificationId,
    recipientType,
    recipientId: userId,
  });

  revalidatePath("/", "layout");
}

export async function markAppNotificationsRead() {
  const { schoolId, userId, recipientType } = await getNotificationContext();

  const notifications = await prisma.appNotification.findMany({
    where: {
      schoolId,
      recipientType,
      recipientId: userId,
      readAt: null,
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },

  });

  for (const notification of notifications) {
    await markRead({
      schoolId,
      notificationId: notification.id,
      recipientType,
      recipientId: userId,
    });
  }

  revalidatePath("/", "layout");
}
