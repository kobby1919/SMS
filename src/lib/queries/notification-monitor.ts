import type {
  AppNotificationDeliveryChannel,
  AppNotificationDeliveryStatus,
  AppNotificationRecipientType,
  Prisma,
} from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";

export const DELIVERY_STATUSES = ["PENDING", "SENT", "DELIVERED", "FAILED", "RETRYING", "CANCELLED"] as const;
export const DELIVERY_CHANNELS = ["IN_APP", "EMAIL", "SMS", "WHATSAPP"] as const;
export const RECIPIENT_TYPES = ["ADMIN", "TEACHER", "PARENT", "BURSAR", "OWNER"] as const;

type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
export type NotificationMonitorFilters = {
  status?: string;
  channel?: string;
  recipientType?: string;
  from?: string;
  to?: string;
};

function emptyDeliveryCounts() {
  return DELIVERY_STATUSES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as Record<DeliveryStatus, number>);
}

function parseEnum<T extends string>(value: string | undefined, allowed: readonly T[]) {
  if (!value) return undefined;
  return allowed.includes(value as T) ? (value as T) : undefined;
}

function parseDateStart(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parseDateEnd(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function normalizeNotificationMonitorFilters(input: NotificationMonitorFilters = {}) {
  const status = parseEnum(input.status, DELIVERY_STATUSES);
  const channel = parseEnum(input.channel, DELIVERY_CHANNELS);
  const recipientType = parseEnum(input.recipientType, RECIPIENT_TYPES);
  const fromDate = parseDateStart(input.from);
  const toDate = parseDateEnd(input.to);

  return {
    status,
    channel,
    recipientType,
    from: fromDate ? input.from : undefined,
    to: toDate ? input.to : undefined,
    fromDate,
    toDate,
  };
}

export async function getNotificationMonitorSummary(schoolId: string) {
  const [deliveryGroups, totalNotifications, unreadNotifications] = await Promise.all([
    prisma.appNotificationDelivery.groupBy({
      by: ["status"],
      where: { schoolId },
      _count: { _all: true },
    }),
    prisma.appNotification.count({ where: { schoolId } }),
    prisma.appNotification.count({ where: { schoolId, readAt: null } }),
  ]);

  const deliveryCounts = emptyDeliveryCounts();
  for (const group of deliveryGroups) {
    deliveryCounts[group.status as DeliveryStatus] = group._count._all;
  }

  return {
    totalNotifications,
    unreadNotifications,
    deliveryCounts,
    attentionCount: deliveryCounts.FAILED + deliveryCounts.RETRYING,
    activeQueueCount: deliveryCounts.PENDING + deliveryCounts.RETRYING,
  };
}

export async function getNotificationMonitorData(schoolId: string, rawFilters: NotificationMonitorFilters = {}) {
  const summary = await getNotificationMonitorSummary(schoolId);
  const filters = normalizeNotificationMonitorFilters(rawFilters);
  const deliveryWhere: Prisma.AppNotificationDeliveryWhereInput = {
    schoolId,
    ...(filters.status ? { status: filters.status as AppNotificationDeliveryStatus } : {}),
    ...(filters.channel ? { channel: filters.channel as AppNotificationDeliveryChannel } : {}),
    ...(filters.fromDate || filters.toDate
      ? {
          createdAt: {
            ...(filters.fromDate ? { gte: filters.fromDate } : {}),
            ...(filters.toDate ? { lte: filters.toDate } : {}),
          },
        }
      : {}),
    notification: {
      schoolId,
      ...(filters.recipientType ? { recipientType: filters.recipientType as AppNotificationRecipientType } : {}),
    },
  };

  const [deliveries, filteredCount] = await Promise.all([
    prisma.appNotificationDelivery.findMany({
      where: deliveryWhere,
      select: {
        id: true,
        channel: true,
        status: true,
        provider: true,
        destination: true,
        attempts: true,
        lastError: true,
        providerMessageId: true,
        sentAt: true,
        deliveredAt: true,
        failedAt: true,
        nextAttemptAt: true,
        createdAt: true,
        notification: {
          select: {
            id: true,
            title: true,
            body: true,
            href: true,
            recipientType: true,
            recipientId: true,
            type: true,
            category: true,
            priority: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
    }),
    prisma.appNotificationDelivery.count({ where: deliveryWhere }),
  ]);

  return {
    summary,
    deliveries,
    filteredCount,
    filters,
  };
}
