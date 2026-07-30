import { randomUUID } from "crypto";
import prisma from "@/src/lib/prisma";
import type {
  ParentDeliveryChannel,
  ParentNotificationPreference,
} from "@/src/generated/prisma";

type PreferenceDelegate = {
  findUnique(args: {
    where: { parentId: string };
  }): Promise<ParentNotificationPreference | null>;
  upsert(args: {
    where: { parentId: string };
    create: ParentNotificationPreferenceInput;
    update: Omit<ParentNotificationPreferenceInput, "schoolId" | "parentId">;
  }): Promise<ParentNotificationPreference>;
};

type PrismaWithPreferenceDelegate = typeof prisma & {
  parentNotificationPreference?: PreferenceDelegate;
};

type ParentNotificationPreferenceInput = {
  schoolId: string;
  parentId: string;
  dailySummaryEnabled: boolean;
  urgentAlertsEnabled: boolean;
  preferredChannel: ParentDeliveryChannel;
  fallbackChannel: ParentDeliveryChannel;
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
};

const prismaWithPreference = prisma as PrismaWithPreferenceDelegate;

function normalizePreference(row: ParentNotificationPreference | null | undefined) {
  if (!row) return null;
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

export async function getParentNotificationPreference(input: {
  parentId: string;
}) {
  if (prismaWithPreference.parentNotificationPreference) {
    return prismaWithPreference.parentNotificationPreference.findUnique({
      where: { parentId: input.parentId },
    });
  }

  const rows = await prisma.$queryRaw<ParentNotificationPreference[]>`
    SELECT
      "id",
      "dailySummaryEnabled",
      "urgentAlertsEnabled",
      "preferredChannel",
      "fallbackChannel",
      "emailEnabled",
      "smsEnabled",
      "whatsappEnabled",
      "createdAt",
      "updatedAt",
      "schoolId",
      "parentId"
    FROM "ParentNotificationPreference"
    WHERE "parentId" = ${input.parentId}
    LIMIT 1
  `;

  return normalizePreference(rows[0]);
}

export async function upsertParentNotificationPreference(input: ParentNotificationPreferenceInput) {
  const updateData = {
    dailySummaryEnabled: input.dailySummaryEnabled,
    urgentAlertsEnabled: input.urgentAlertsEnabled,
    preferredChannel: input.preferredChannel,
    fallbackChannel: input.fallbackChannel,
    emailEnabled: input.emailEnabled,
    smsEnabled: input.smsEnabled,
    whatsappEnabled: input.whatsappEnabled,
  };

  if (prismaWithPreference.parentNotificationPreference) {
    return prismaWithPreference.parentNotificationPreference.upsert({
      where: { parentId: input.parentId },
      create: input,
      update: updateData,
    });
  }

  const existing = await getParentNotificationPreference({ parentId: input.parentId });
  if (existing) {
    await prisma.$executeRaw`
      UPDATE "ParentNotificationPreference"
      SET
        "dailySummaryEnabled" = ${input.dailySummaryEnabled},
        "urgentAlertsEnabled" = ${input.urgentAlertsEnabled},
        "preferredChannel" = CAST(${input.preferredChannel} AS "ParentDeliveryChannel"),
        "fallbackChannel" = CAST(${input.fallbackChannel} AS "ParentDeliveryChannel"),
        "emailEnabled" = ${input.emailEnabled},
        "smsEnabled" = ${input.smsEnabled},
        "whatsappEnabled" = ${input.whatsappEnabled},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "parentId" = ${input.parentId}
    `;
    return getParentNotificationPreference({ parentId: input.parentId });
  }

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "ParentNotificationPreference" (
      "id",
      "dailySummaryEnabled",
      "urgentAlertsEnabled",
      "preferredChannel",
      "fallbackChannel",
      "emailEnabled",
      "smsEnabled",
      "whatsappEnabled",
      "createdAt",
      "updatedAt",
      "schoolId",
      "parentId"
    )
    VALUES (
      ${id},
      ${input.dailySummaryEnabled},
      ${input.urgentAlertsEnabled},
      CAST(${input.preferredChannel} AS "ParentDeliveryChannel"),
      CAST(${input.fallbackChannel} AS "ParentDeliveryChannel"),
      ${input.emailEnabled},
      ${input.smsEnabled},
      ${input.whatsappEnabled},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      ${input.schoolId},
      ${input.parentId}
    )
  `;

  return getParentNotificationPreference({ parentId: input.parentId });
}
