import prisma from "@/src/lib/prisma";
import {
  AppNotificationCategory,
  AppNotificationDeliveryChannel,
  AppNotificationDeliveryStatus,
  AppNotificationPriority,
  AppNotificationRecipientType,
  AppNotificationType,
  Prisma,
} from "@/src/generated/prisma";

type PrismaClientOrTx = typeof prisma | Prisma.TransactionClient;

type DeliveryInput = {
  channel: AppNotificationDeliveryChannel;
  destination: string;
  provider?: string | null;
  status?: AppNotificationDeliveryStatus;
  nextAttemptAt?: Date | null;
};

export type AppNotificationSettingInput = {
  schoolId: string;
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  whatsappEnabled?: boolean;
  timezone?: string;
  sendWeeklyFinanceSummaryToAdmins?: boolean;
  sendDailyFinanceReportToAdmins?: boolean;
  sendParentSummariesByEmail?: boolean;
  sendParentSummariesBySms?: boolean;
  sendParentSummariesByWhatsapp?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  highPriorityOverridesQuietHours?: boolean;
  urgentPriorityOverridesChannels?: boolean;
};

export type AppNotificationPreferenceInput = {
  schoolId: string;
  recipientType: AppNotificationRecipientType;
  recipientId: string;
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  whatsappEnabled?: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  highPriorityOverridesQuietHours?: boolean;
};

export type CreateNotificationInput = {
  schoolId: string;
  recipientType: AppNotificationRecipientType;
  recipientId: string;
  type: AppNotificationType;
  category: AppNotificationCategory;
  title: string;
  body: string;
  priority?: AppNotificationPriority;
  href?: string | null;
  payload?: Prisma.InputJsonValue | null;
  sourceModel?: string | null;
  sourceId?: string | null;
  idempotencyKey?: string | null;
  expiresAt?: Date | null;
  deliveries?: DeliveryInput[];
};

export type NotifyUserInput = Omit<CreateNotificationInput, "recipientType" | "recipientId"> & {
  recipientType: AppNotificationRecipientType;
  recipientId: string;
};

export type NotifyManyInput = Omit<CreateNotificationInput, "recipientType" | "recipientId" | "deliveries"> & {
  recipients: Array<{
    recipientType: AppNotificationRecipientType;
    recipientId: string;
    deliveries?: DeliveryInput[];
  }>;
};

export type NotifyRoleInput = Omit<CreateNotificationInput, "recipientType" | "recipientId" | "deliveries"> & {
  recipientType: AppNotificationRecipientType;
  deliveriesForRecipient?: (recipient: RoleRecipient) => DeliveryInput[];
};

export type RoleRecipient = {
  id: string;
  recipientType: AppNotificationRecipientType;
  email?: string | null;
  phone?: string | null;
};

const MAX_ATTEMPTS = 5;
const MAX_IDEMPOTENCY_PART_LENGTH = 120;

export const notificationIdempotencyKeys = {
  weeklyFinanceSummary: (schoolId: string, weekStart: string | Date) =>
    createNotificationIdempotencyKey("weekly-finance-summary", schoolId, dateKeyPart(weekStart)),
  dailyFinanceReport: (schoolId: string, date: string | Date) =>
    createNotificationIdempotencyKey("daily-finance-report", schoolId, dateKeyPart(date)),
  parentDailySummary: (parentId: string, date: string | Date) =>
    createNotificationIdempotencyKey("parent-daily-summary", parentId, dateKeyPart(date)),
  paymentCorrectionApplied: (correctionId: string) =>
    createNotificationIdempotencyKey("payment-correction-applied", correctionId),
  teacherAttendanceEscalated: (obligationId: string) =>
    createNotificationIdempotencyKey("teacher-attendance-escalated", obligationId),
  forRecipient: (
    baseKey: string,
    schoolId: string,
    recipientType: AppNotificationRecipientType,
    recipientId: string,
  ) => createNotificationIdempotencyKey(baseKey, schoolId, recipientType, recipientId),
};


async function withTransaction<T>(client: PrismaClientOrTx, action: (tx: Prisma.TransactionClient) => Promise<T>) {
  if ("$transaction" in client) {
    return client.$transaction(action);
  }

  return action(client);
}

function dateKeyPart(value: string | Date) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return cleanIdempotencyPart(value, "date");
}

function cleanIdempotencyPart(value: string, field = "idempotency part") {
  const cleaned = cleanText(value, field)
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!cleaned) throw new Error(`${field} must contain at least one safe character.`);
  return cleaned.slice(0, MAX_IDEMPOTENCY_PART_LENGTH);
}

export function createNotificationIdempotencyKey(prefix: string, ...parts: Array<string | Date>) {
  const keyParts = [cleanIdempotencyPart(prefix, "idempotency prefix")];

  for (const part of parts) {
    keyParts.push(part instanceof Date ? dateKeyPart(part) : cleanIdempotencyPart(part));
  }

  return keyParts.join(":");
}

function notificationRequiresIdempotency(input: {
  category: AppNotificationCategory;
  priority: AppNotificationPriority;
  type: AppNotificationType;
}) {
  if (input.category !== "GENERAL") return true;
  if (input.priority === "HIGH" || input.priority === "URGENT") return true;
  return input.type !== "ANNOUNCEMENT" && input.type !== "SYSTEM";
}

function cleanText(value: string, field: string) {
  const cleaned = value.trim();
  if (!cleaned) throw new Error(`${field} is required.`);
  return cleaned;
}

function cleanOptional(value?: string | null) {
  const cleaned = value?.trim();
  return cleaned || null;
}

function safeHref(value?: string | null) {
  const href = cleanOptional(value);
  if (!href) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (href.startsWith("https://") || href.startsWith("http://")) return href;
  throw new Error("Notification href must be a relative path or http(s) URL.");
}

function cleanTime(value: string | undefined, field: string) {
  if (value === undefined) return undefined;
  const cleaned = cleanText(value, field);
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(cleaned)) {
    throw new Error(`${field} must use HH:mm format.`);
  }
  return cleaned;
}

function cleanNullableTime(value: string | null | undefined, field: string) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return cleanTime(value, field) ?? null;
}

function cleanTimezone(value: string | undefined, fallback = "Africa/Accra") {
  const timezone = (value ?? fallback).trim();
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone }).format(new Date());
  } catch {
    throw new Error("timezone must be a valid IANA timezone.");
  }
  return timezone;
}
function assertQueueableDeliveryStatus(status: AppNotificationDeliveryStatus) {
  if (status === "PENDING") return;
  if (status === "SENT") return;
  if (status === "RETRYING") throw new Error("Use markFailed to schedule retrying deliveries.");
  if (status === "CANCELLED") throw new Error("Cancelled deliveries should be handled by a cancellation workflow.");
  if (status === "DELIVERED") throw new Error("Use markDelivered to mark a delivery as delivered.");
  if (status === "FAILED") throw new Error("Use markFailed to mark a delivery as failed.");
}

function scopedIdempotencyKey(input: CreateNotificationInput) {
  const explicitKey = cleanOptional(input.idempotencyKey);
  if (!explicitKey) return sourceDedupeKey(input);

  return createNotificationIdempotencyKey(
    explicitKey,
    input.schoolId,
    input.recipientType,
    input.recipientId,
  );
}

function normalizeNotificationInput(input: CreateNotificationInput) {
  const priority = input.priority ?? "NORMAL";
  const idempotencyKey = scopedIdempotencyKey(input);

  if (notificationRequiresIdempotency({ category: input.category, priority, type: input.type }) && !idempotencyKey) {
    throw new Error(
      `Notification type ${input.type} in ${input.category} requires an idempotencyKey or sourceModel/sourceId.`,
    );
  }

  return {
    ...input,
    schoolId: cleanText(input.schoolId, "schoolId"),
    recipientId: cleanText(input.recipientId, "recipientId"),
    title: cleanText(input.title, "title").slice(0, 160),
    body: cleanText(input.body, "body"),
    href: safeHref(input.href),
    priority,
    sourceModel: cleanOptional(input.sourceModel),
    sourceId: cleanOptional(input.sourceId),
    idempotencyKey,
    deliveries: input.deliveries ?? [],
  };
}

function normalizeDeliveryInput(input: DeliveryInput) {
  const destination = cleanText(input.destination, "destination");
  const status = input.status ?? "PENDING";
  assertQueueableDeliveryStatus(status);
  return {
    channel: input.channel,
    destination,
    provider: cleanOptional(input.provider) ?? defaultProvider(input.channel),
    status,
    nextAttemptAt: input.nextAttemptAt ?? null,
  };
}

function defaultProvider(channel: AppNotificationDeliveryChannel) {
  if (channel === "IN_APP") return "edujay-in-app";
  return "provider-not-configured";
}

function sourceDedupeKey(input: CreateNotificationInput) {
  const schoolId = cleanText(input.schoolId, "schoolId");
  const recipientId = cleanText(input.recipientId, "recipientId");
  const sourceModel = cleanOptional(input.sourceModel);
  const sourceId = cleanOptional(input.sourceId);
  if (!sourceModel || !sourceId) return null;
  return createNotificationIdempotencyKey(
    input.type,
    schoolId,
    input.recipientType,
    recipientId,
    sourceModel,
    sourceId,
  );
}

export async function dedupeNotification(input: CreateNotificationInput, client: PrismaClientOrTx = prisma) {
  const normalized = normalizeNotificationInput(input);

  if (!normalized.idempotencyKey) return null;

  return client.appNotification.findUnique({
    where: {
      schoolId_idempotencyKey: {
        schoolId: normalized.schoolId,
        idempotencyKey: normalized.idempotencyKey,
      },
    },
    include: { deliveries: true },
  });
}

export async function createNotification(input: CreateNotificationInput, client: PrismaClientOrTx = prisma) {
  const normalized = normalizeNotificationInput(input);

  return withTransaction(client, async (tx) => {
    const existing = await dedupeNotification(normalized, tx);
    if (existing) {
      for (const delivery of normalized.deliveries) {
        await queueDelivery(
          {
            schoolId: normalized.schoolId,
            notificationId: existing.id,
            ...delivery,
          },
          tx,
        );
      }

      return tx.appNotification.findUniqueOrThrow({
        where: { id: existing.id },
        include: { deliveries: true },
      });
    }

    let notification;

    try {
      notification = await tx.appNotification.create({
        data: {
          schoolId: normalized.schoolId,
          recipientType: normalized.recipientType,
          recipientId: normalized.recipientId,
          type: normalized.type,
          category: normalized.category,
          priority: normalized.priority,
          title: normalized.title,
          body: normalized.body,
          href: normalized.href,
          payload: normalized.payload ?? Prisma.JsonNull,
          sourceModel: normalized.sourceModel,
          sourceId: normalized.sourceId,
          idempotencyKey: normalized.idempotencyKey,
          expiresAt: normalized.expiresAt ?? null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const raced = await dedupeNotification(normalized, tx);
        if (!raced) throw error;

        for (const delivery of normalized.deliveries) {
          await queueDelivery(
            {
              schoolId: normalized.schoolId,
              notificationId: raced.id,
              ...delivery,
            },
            tx,
          );
        }

        return tx.appNotification.findUniqueOrThrow({
          where: { id: raced.id },
          include: { deliveries: true },
        });
      }

      throw error;
    }

    for (const delivery of normalized.deliveries) {
      await queueDelivery(
        {
          schoolId: normalized.schoolId,
          notificationId: notification.id,
          ...delivery,
        },
        tx,
      );
    }

    return tx.appNotification.findUniqueOrThrow({
      where: { id: notification.id },
      include: { deliveries: true },
    });
  });
}

export async function notifyUser(input: NotifyUserInput, client: PrismaClientOrTx = prisma) {
  return createNotification(input, client);
}

export async function notifyMany(input: NotifyManyInput, client: PrismaClientOrTx = prisma) {
  const { recipients, ...notificationInput } = input;
  if (recipients.length === 0) return [];

  return withTransaction(client, async (tx) => {
    const notifications = [];
    const seen = new Set<string>();

    for (const recipient of recipients) {
      const key = `${recipient.recipientType}:${recipient.recipientId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      notifications.push(
        await createNotification(
          {
            ...notificationInput,
            recipientType: recipient.recipientType,
            recipientId: recipient.recipientId,
            deliveries: recipient.deliveries,
          },
          tx,
        ),
      );
    }

    return notifications;
  });
}

export async function notifyRole(input: NotifyRoleInput, client: PrismaClientOrTx = prisma) {
  const recipients = await recipientsForRole(input.schoolId, input.recipientType, client);

  return notifyMany(
    {
      ...input,
      recipients: recipients.map((recipient) => ({
        recipientType: recipient.recipientType,
        recipientId: recipient.id,
        deliveries: input.deliveriesForRecipient?.(recipient) ?? [
          {
            channel: "IN_APP",
            destination: recipient.id,
          },
        ],
      })),
    },
    client,
  );
}

export async function queueDelivery(
  input: DeliveryInput & { schoolId: string; notificationId: string },
  client: PrismaClientOrTx = prisma,
) {
  const schoolId = cleanText(input.schoolId, "schoolId");
  const notificationId = cleanText(input.notificationId, "notificationId");
  const delivery = normalizeDeliveryInput(input);
  const where = {
    notificationId_channel_destination: {
      notificationId,
      channel: delivery.channel,
      destination: delivery.destination,
    },
  };

  const existing = await client.appNotificationDelivery.findUnique({ where });
  if (existing) return existing;

  try {
    return await client.appNotificationDelivery.create({
      data: {
        schoolId,
        notificationId,
        channel: delivery.channel,
        destination: delivery.destination,
        provider: delivery.provider,
        status: delivery.status,
        nextAttemptAt: delivery.nextAttemptAt,
        sentAt: delivery.status === "SENT" ? new Date() : null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return client.appNotificationDelivery.findUniqueOrThrow({ where });
    }

    throw error;
  }
}
export async function markRead(input: {
  schoolId: string;
  notificationId: string;
  recipientType: AppNotificationRecipientType;
  recipientId: string;
}, client: PrismaClientOrTx = prisma) {
  const now = new Date();
  return client.appNotification.updateMany({
    where: {
      id: cleanText(input.notificationId, "notificationId"),
      schoolId: cleanText(input.schoolId, "schoolId"),
      recipientType: input.recipientType,
      recipientId: cleanText(input.recipientId, "recipientId"),
      readAt: null,
    },
    data: { readAt: now },
  });
}

export async function markDelivered(input: {
  schoolId: string;
  deliveryId: string;
  providerMessageId?: string | null;
  deliveredAt?: Date;
}, client: PrismaClientOrTx = prisma) {
  const deliveredAt = input.deliveredAt ?? new Date();
  return client.appNotificationDelivery.updateMany({
    where: {
      id: cleanText(input.deliveryId, "deliveryId"),
      schoolId: cleanText(input.schoolId, "schoolId"),
      status: { not: "CANCELLED" },
    },
    data: {
      status: "DELIVERED",
      deliveredAt,
      providerMessageId: cleanOptional(input.providerMessageId) ?? undefined,
      lastError: null,
    },
  });
}

export async function markFailed(input: {
  schoolId: string;
  deliveryId: string;
  error: string;
  failedAt?: Date;
  retryAt?: Date | null;
}, client: PrismaClientOrTx = prisma) {
  const failedAt = input.failedAt ?? new Date();
  const error = cleanText(input.error, "error").slice(0, 1000);
  const current = await client.appNotificationDelivery.findFirst({
    where: {
      id: cleanText(input.deliveryId, "deliveryId"),
      schoolId: cleanText(input.schoolId, "schoolId"),
    },
    select: { attempts: true, status: true },
  });

  if (!current || current.status === "CANCELLED" || current.status === "DELIVERED") return { count: 0 };

  const attempts = current.attempts + 1;
  const shouldRetry = Boolean(input.retryAt) && attempts < MAX_ATTEMPTS;

  return client.appNotificationDelivery.updateMany({
    where: {
      id: cleanText(input.deliveryId, "deliveryId"),
      schoolId: cleanText(input.schoolId, "schoolId"),
    },
    data: {
      attempts,
      status: shouldRetry ? "RETRYING" : "FAILED",
      failedAt,
      lastError: error,
      nextAttemptAt: shouldRetry ? input.retryAt : null,
    },
  });
}

export async function retryFailed(input: {
  schoolId: string;
  deliveryId?: string;
  before?: Date;
}, client: PrismaClientOrTx = prisma) {
  const where: Prisma.AppNotificationDeliveryWhereInput = {
    schoolId: cleanText(input.schoolId, "schoolId"),
    status: { in: ["FAILED", "RETRYING"] },
    attempts: { lt: MAX_ATTEMPTS },
    OR: [
      { nextAttemptAt: null },
      { nextAttemptAt: { lte: input.before ?? new Date() } },
    ],
  };

  if (input.deliveryId) where.id = cleanText(input.deliveryId, "deliveryId");

  return client.appNotificationDelivery.updateMany({
    where,
    data: {
      status: "PENDING",
      nextAttemptAt: null,
      lastError: null,
    },
  });
}

export async function getAppNotificationSettings(schoolIdInput: string, client: PrismaClientOrTx = prisma) {
  const schoolId = cleanText(schoolIdInput, "schoolId");

  return client.appNotificationSetting.upsert({
    where: { schoolId },
    create: { schoolId },
    update: {},
  });
}

export async function updateAppNotificationSettings(
  input: AppNotificationSettingInput,
  client: PrismaClientOrTx = prisma,
) {
  const schoolId = cleanText(input.schoolId, "schoolId");

  return client.appNotificationSetting.upsert({
    where: { schoolId },
    create: {
      schoolId,
      inAppEnabled: input.inAppEnabled ?? true,
      emailEnabled: input.emailEnabled ?? true,
      smsEnabled: input.smsEnabled ?? false,
      whatsappEnabled: input.whatsappEnabled ?? false,
      timezone: cleanTimezone(input.timezone),
      sendWeeklyFinanceSummaryToAdmins: input.sendWeeklyFinanceSummaryToAdmins ?? true,
      sendDailyFinanceReportToAdmins: input.sendDailyFinanceReportToAdmins ?? false,
      sendParentSummariesByEmail: input.sendParentSummariesByEmail ?? true,
      sendParentSummariesBySms: input.sendParentSummariesBySms ?? false,
      sendParentSummariesByWhatsapp: input.sendParentSummariesByWhatsapp ?? false,
      quietHoursStart: cleanTime(input.quietHoursStart ?? "20:00", "quietHoursStart"),
      quietHoursEnd: cleanTime(input.quietHoursEnd ?? "06:00", "quietHoursEnd"),
      highPriorityOverridesQuietHours: input.highPriorityOverridesQuietHours ?? true,
      urgentPriorityOverridesChannels: input.urgentPriorityOverridesChannels ?? false,
    },
    update: {
      inAppEnabled: input.inAppEnabled,
      emailEnabled: input.emailEnabled,
      smsEnabled: input.smsEnabled,
      whatsappEnabled: input.whatsappEnabled,
      timezone: input.timezone === undefined ? undefined : cleanTimezone(input.timezone),
      sendWeeklyFinanceSummaryToAdmins: input.sendWeeklyFinanceSummaryToAdmins,
      sendDailyFinanceReportToAdmins: input.sendDailyFinanceReportToAdmins,
      sendParentSummariesByEmail: input.sendParentSummariesByEmail,
      sendParentSummariesBySms: input.sendParentSummariesBySms,
      sendParentSummariesByWhatsapp: input.sendParentSummariesByWhatsapp,
      quietHoursStart: cleanTime(input.quietHoursStart, "quietHoursStart"),
      quietHoursEnd: cleanTime(input.quietHoursEnd, "quietHoursEnd"),
      highPriorityOverridesQuietHours: input.highPriorityOverridesQuietHours,
      urgentPriorityOverridesChannels: input.urgentPriorityOverridesChannels,
    },
  });
}

export async function getAppNotificationPreference(
  input: Pick<AppNotificationPreferenceInput, "schoolId" | "recipientType" | "recipientId">,
  client: PrismaClientOrTx = prisma,
) {
  return client.appNotificationPreference.findUnique({
    where: {
      schoolId_recipientType_recipientId: {
        schoolId: cleanText(input.schoolId, "schoolId"),
        recipientType: input.recipientType,
        recipientId: cleanText(input.recipientId, "recipientId"),
      },
    },
  });
}

export async function upsertAppNotificationPreference(
  input: AppNotificationPreferenceInput,
  client: PrismaClientOrTx = prisma,
) {
  const schoolId = cleanText(input.schoolId, "schoolId");
  const recipientId = cleanText(input.recipientId, "recipientId");

  return client.appNotificationPreference.upsert({
    where: {
      schoolId_recipientType_recipientId: {
        schoolId,
        recipientType: input.recipientType,
        recipientId,
      },
    },
    create: {
      schoolId,
      recipientType: input.recipientType,
      recipientId,
      inAppEnabled: input.inAppEnabled ?? true,
      emailEnabled: input.emailEnabled ?? true,
      smsEnabled: input.smsEnabled ?? false,
      whatsappEnabled: input.whatsappEnabled ?? false,
      quietHoursStart: cleanNullableTime(input.quietHoursStart, "quietHoursStart"),
      quietHoursEnd: cleanNullableTime(input.quietHoursEnd, "quietHoursEnd"),
      highPriorityOverridesQuietHours: input.highPriorityOverridesQuietHours ?? true,
    },
    update: {
      inAppEnabled: input.inAppEnabled,
      emailEnabled: input.emailEnabled,
      smsEnabled: input.smsEnabled,
      whatsappEnabled: input.whatsappEnabled,
      quietHoursStart: cleanNullableTime(input.quietHoursStart, "quietHoursStart"),
      quietHoursEnd: cleanNullableTime(input.quietHoursEnd, "quietHoursEnd"),
      highPriorityOverridesQuietHours: input.highPriorityOverridesQuietHours,
    },
  });
}

function channelEnabledBySettings(
  channel: AppNotificationDeliveryChannel,
  settings: Awaited<ReturnType<typeof getAppNotificationSettings>>,
) {
  if (channel === "IN_APP") return settings.inAppEnabled;
  if (channel === "EMAIL") return settings.emailEnabled;
  if (channel === "SMS") return settings.smsEnabled;
  return settings.whatsappEnabled;
}

function channelEnabledByPreference(
  channel: AppNotificationDeliveryChannel,
  preference: Awaited<ReturnType<typeof getAppNotificationPreference>>,
) {
  if (!preference) return true;
  if (channel === "IN_APP") return preference.inAppEnabled;
  if (channel === "EMAIL") return preference.emailEnabled;
  if (channel === "SMS") return preference.smsEnabled;
  return preference.whatsappEnabled;
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function localMinutes(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function isWithinQuietHours(input: {
  at: Date;
  timezone: string;
  quietHoursStart: string;
  quietHoursEnd: string;
}) {
  const current = localMinutes(input.at, input.timezone);
  const start = timeToMinutes(input.quietHoursStart);
  const end = timeToMinutes(input.quietHoursEnd);

  if (start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

function canBypassQuietHours(input: {
  priority: AppNotificationPriority;
  settings: Awaited<ReturnType<typeof getAppNotificationSettings>>;
  preference: Awaited<ReturnType<typeof getAppNotificationPreference>>;
}) {
  if (input.priority !== "HIGH" && input.priority !== "URGENT") return false;
  if (!input.settings.highPriorityOverridesQuietHours) return false;
  if (input.preference && !input.preference.highPriorityOverridesQuietHours) return false;
  return true;
}

export async function isNotificationChannelAllowed(input: {
  schoolId: string;
  recipientType: AppNotificationRecipientType;
  recipientId: string;
  channel: AppNotificationDeliveryChannel;
  priority?: AppNotificationPriority;
  at?: Date;
}, client: PrismaClientOrTx = prisma) {
  const [settings, preference] = await Promise.all([
    getAppNotificationSettings(input.schoolId, client),
    getAppNotificationPreference(input, client),
  ]);
  const priority = input.priority ?? "NORMAL";

  if (!channelEnabledBySettings(input.channel, settings)) return false;
  if (!channelEnabledByPreference(input.channel, preference)) return false;

  const quietHoursStart = preference?.quietHoursStart ?? settings.quietHoursStart;
  const quietHoursEnd = preference?.quietHoursEnd ?? settings.quietHoursEnd;
  const isQuiet = isWithinQuietHours({
    at: input.at ?? new Date(),
    timezone: settings.timezone,
    quietHoursStart,
    quietHoursEnd,
  });

  if (!isQuiet) return true;
  return canBypassQuietHours({ priority, settings, preference });
}

async function recipientsForRole(
  schoolIdInput: string,
  recipientType: AppNotificationRecipientType,
  client: PrismaClientOrTx,
): Promise<RoleRecipient[]> {
  const schoolId = cleanText(schoolIdInput, "schoolId");

  if (recipientType === "ADMIN" || recipientType === "OWNER") {
    const admins = await client.admin.findMany({
      where: { schoolId },
      select: { id: true },
    });
    return admins.map((admin) => ({ id: admin.id, recipientType }));
  }

  if (recipientType === "TEACHER") {
    const teachers = await client.teacher.findMany({
      where: { schoolId, status: "ACTIVE" },
      select: { id: true, email: true, phone: true },
    });
    return teachers.map((teacher) => ({ ...teacher, recipientType }));
  }

  if (recipientType === "BURSAR") {
    const bursars = await client.bursar.findMany({
      where: { schoolId, status: "ACTIVE" },
      select: { id: true, email: true, phone: true },
    });
    return bursars.map((bursar) => ({ ...bursar, recipientType }));
  }

  const parents = await client.parent.findMany({
    where: { schoolId },
    select: { id: true, email: true, phone: true },
  });
  return parents.map((parent) => ({ ...parent, recipientType }));
}
