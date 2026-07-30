import prisma from "@/src/lib/prisma";
import type {
  ParentDeliveryChannel,
  ParentNotification,
  ParentNotificationPreference,
  SchoolNotificationSetting,
} from "@/src/generated/prisma";
import { rebuildParentDailySummary } from "@/src/lib/services/parent-daily-summary";
import { getParentNotificationPreference } from "@/src/lib/services/parent-notification-preferences";

const DEFAULT_SETTINGS = {
  timezone: "Africa/Accra",
  openingTime: "07:30",
  closingTime: "15:00",
  dailySummarySendTime: "15:15",
  activeDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
  emailEnabled: true,
  smsEnabled: true,
  whatsappEnabled: false,
  urgentAlertsImmediate: true,
  quietHoursStart: "20:00",
  quietHoursEnd: "06:00",
};

type ParentWithPreference = {
  id: string;
  email: string | null;
  phone: string | null;
  notificationPreference: ParentNotificationPreference | null;
};

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function timeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function dayName(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Africa/Accra",
  }).format(date).toUpperCase();
}

function localTimeInMinutes(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone || "Africa/Accra",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function isChannelEnabled(channel: ParentDeliveryChannel, settings: SchoolNotificationSetting) {
  if (channel === "EMAIL") return settings.emailEnabled;
  if (channel === "SMS") return settings.smsEnabled;
  return settings.whatsappEnabled;
}

function isParentChannelEnabled(channel: ParentDeliveryChannel, preference?: ParentNotificationPreference | null) {
  if (!preference) return true;
  if (channel === "EMAIL") return preference.emailEnabled;
  if (channel === "SMS") return preference.smsEnabled;
  return preference.whatsappEnabled;
}

function recipientForChannel(channel: ParentDeliveryChannel, parent: ParentWithPreference) {
  if (channel === "EMAIL") return parent.email;
  return parent.phone;
}

function channelOrder(parent: ParentWithPreference): ParentDeliveryChannel[] {
  const preference = parent.notificationPreference;
  const preferred = preference?.preferredChannel ?? "WHATSAPP";
  const fallback = preference?.fallbackChannel ?? "SMS";
  const all: ParentDeliveryChannel[] = [preferred, fallback, "EMAIL", "SMS", "WHATSAPP"];
  return [...new Set(all)];
}

async function getOrCreateSettings(schoolId: string) {
  return prisma.schoolNotificationSetting.upsert({
    where: { schoolId },
    create: { schoolId, ...DEFAULT_SETTINGS },
    update: {},
  });
}

async function logDelivery(input: {
  schoolId: string;
  parentId: string;
  notificationId: string;
  channel: ParentDeliveryChannel;
  recipient?: string | null;
  status: "SENT" | "FAILED" | "SKIPPED";
  messagePreview: string;
  errorMessage?: string;
}) {
  return prisma.parentNotificationDeliveryLog.create({
    data: {
      schoolId: input.schoolId,
      parentId: input.parentId,
      notificationId: input.notificationId,
      channel: input.channel,
      recipient: input.recipient ?? null,
      status: input.status,
      provider: "edujay-console",
      messagePreview: input.messagePreview.slice(0, 240),
      errorMessage: input.errorMessage,
      sentAt: input.status === "SENT" ? new Date() : null,
    },
  });
}

export async function deliverParentDailySummary(input: {
  schoolId: string;
  parentId: string;
  notification: ParentNotification;
}) {
  const [settings, parent, notificationPreference] = await Promise.all([
    getOrCreateSettings(input.schoolId),
    prisma.parent.findFirst({
      where: { id: input.parentId, schoolId: input.schoolId },
      select: {
        id: true,
        email: true,
        phone: true,
      },
    }),
    getParentNotificationPreference({ parentId: input.parentId }),
  ]);

  if (!parent) return null;
  const parentWithPreference = { ...parent, notificationPreference };

  if (notificationPreference?.dailySummaryEnabled === false) {
    return logDelivery({
      schoolId: input.schoolId,
      parentId: parent.id,
      notificationId: input.notification.id,
      channel: notificationPreference.preferredChannel,
      status: "SKIPPED",
      messagePreview: input.notification.body,
      errorMessage: "Daily summaries disabled by parent preference.",
    });
  }

  for (const channel of channelOrder(parentWithPreference)) {
    if (!isChannelEnabled(channel, settings)) continue;
    if (!isParentChannelEnabled(channel, notificationPreference)) continue;

    const recipient = recipientForChannel(channel, parentWithPreference);
    if (!recipient) continue;

    return logDelivery({
      schoolId: input.schoolId,
      parentId: parent.id,
      notificationId: input.notification.id,
      channel,
      recipient,
      status: "SENT",
      messagePreview: `Edujay daily update: ${input.notification.body}`,
    });
  }

  return logDelivery({
    schoolId: input.schoolId,
    parentId: parent.id,
    notificationId: input.notification.id,
    channel: notificationPreference?.preferredChannel ?? "SMS",
    status: "SKIPPED",
    messagePreview: input.notification.body,
    errorMessage: "No enabled delivery channel with a reachable parent contact.",
  });
}

async function processSchoolDailySummaries(schoolId: string, date: Date) {
  const parentIds = await prisma.parentActivityEvent.findMany({
    where: {
      schoolId,
      occurredAt: {
        gte: new Date(`${dateKey(date)}T00:00:00.000Z`),
        lt: new Date(`${dateKey(date)}T23:59:59.999Z`),
      },
    },
    distinct: ["parentId"],
    select: { parentId: true },
  });

  let delivered = 0;
  for (const row of parentIds) {
    const notification = await rebuildParentDailySummary({
      schoolId,
      parentId: row.parentId,
      date,
    });
    if (!notification) continue;
    await deliverParentDailySummary({ schoolId, parentId: row.parentId, notification });
    delivered += 1;
  }

  await prisma.schoolNotificationSetting.update({
    where: { schoolId },
    data: { lastDailySummaryRunAt: new Date() },
  });

  return { parentCount: parentIds.length, delivered };
}

export async function runDueParentDailySummaries(now = new Date()) {
  const schools = await prisma.school.findMany({ select: { id: true } });
  const settings = await Promise.all(
    schools.map((school) => getOrCreateSettings(school.id)),
  );

  const results = [];
  for (const setting of settings) {
    const currentDay = dayName(now);
    if (!setting.activeDays.includes(currentDay)) continue;

    const sendTimeReached = localTimeInMinutes(now, setting.timezone) >= timeToMinutes(setting.dailySummarySendTime);
    if (!sendTimeReached) continue;

    const lastRunKey = setting.lastDailySummaryRunAt ? dateKey(setting.lastDailySummaryRunAt) : null;
    if (lastRunKey === dateKey(now)) continue;

    const result = await processSchoolDailySummaries(setting.schoolId, now);
    results.push({ schoolId: setting.schoolId, ...result });
  }

  return results;
}

export async function ensureDefaultSchoolNotificationSettings(schoolId: string) {
  return getOrCreateSettings(schoolId);
}
