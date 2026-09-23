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

async function withTransaction<T>(client: PrismaClientOrTx, action: (tx: Prisma.TransactionClient) => Promise<T>) {
  if ("$transaction" in client) {
    return client.$transaction(action);
  }

  return action(client);
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

function assertQueueableDeliveryStatus(status: AppNotificationDeliveryStatus) {
  if (status === "PENDING") return;
  if (status === "SENT") return;
  if (status === "RETRYING") throw new Error("Use markFailed to schedule retrying deliveries.");
  if (status === "CANCELLED") throw new Error("Cancelled deliveries should be handled by a cancellation workflow.");
  if (status === "DELIVERED") throw new Error("Use markDelivered to mark a delivery as delivered.");
  if (status === "FAILED") throw new Error("Use markFailed to mark a delivery as failed.");
}

function normalizeNotificationInput(input: CreateNotificationInput) {
  return {
    ...input,
    schoolId: cleanText(input.schoolId, "schoolId"),
    recipientId: cleanText(input.recipientId, "recipientId"),
    title: cleanText(input.title, "title").slice(0, 160),
    body: cleanText(input.body, "body"),
    href: safeHref(input.href),
    priority: input.priority ?? "NORMAL",
    sourceModel: cleanOptional(input.sourceModel),
    sourceId: cleanOptional(input.sourceId),
    idempotencyKey: cleanOptional(input.idempotencyKey),
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
  return `${schoolId}:${input.recipientType}:${recipientId}:${input.type}:${sourceModel}:${sourceId}`;
}

export async function dedupeNotification(input: CreateNotificationInput, client: PrismaClientOrTx = prisma) {
  const normalized = normalizeNotificationInput({
    ...input,
    idempotencyKey: input.idempotencyKey ?? sourceDedupeKey(input),
  });

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
  const normalized = normalizeNotificationInput({
    ...input,
    idempotencyKey: input.idempotencyKey ?? sourceDedupeKey(input),
  });

  return withTransaction(client, async (tx) => {
    const existing = await dedupeNotification(normalized, tx);
    if (existing) return existing;

    const notification = await tx.appNotification.create({
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
  if (input.recipients.length === 0) return [];

  return withTransaction(client, async (tx) => {
    const notifications = [];
    const seen = new Set<string>();

    for (const recipient of input.recipients) {
      const key = `${recipient.recipientType}:${recipient.recipientId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      notifications.push(
        await createNotification(
          {
            ...input,
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
