"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/authz";

export async function markParentNotificationsRead() {
  const { userId, schoolId } = await requireRole(["parent"]);

  await prisma.parentNotification.updateMany({
    where: {
      schoolId,
      parentId: userId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  revalidatePath("/parent");
}
