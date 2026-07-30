import prisma from "@/src/lib/prisma";
import type {
  ParentDeliveryChannel,
  ParentNotification,
  ParentNotificationPreference,
  SchoolNotificationSetting,
} from "@/src/generated/prisma";
import { rebuildParentDailySummary } from "@/src/lib/services/parent-daily-summary";
import { getParentNotificationPreference } from "@/src/lib/services/parent-notification-preferences";
import { appBaseUrl, sendEmail } from "@/src/lib/services/notifications";
import {
  getSchoolBranding,
  poweredByPlatformLine,
  type SchoolBranding,
} from "@/src/lib/services/school-branding";

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
  provider?: string;
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
      provider: input.provider ?? "edujay-console",
      messagePreview: input.messagePreview.slice(0, 240),
      errorMessage: input.errorMessage,
      sentAt: input.status === "SENT" ? new Date() : null,
    },
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function notificationUrl(notification: ParentNotification) {
  const href = notification.href || "/parent/updates";
  if (href.startsWith("http")) return href;
  return `${appBaseUrl()}${href.startsWith("/") ? href : `/${href}`}`;
}

function dailySummaryText(notification: ParentNotification, branding: SchoolBranding, studentLabel: string) {
  return [
    `${branding.displayName}: Daily School Update`,
    studentLabel ? `Student: ${studentLabel}` : "",
    "",
    notification.body,
    "",
    `View full update: ${notificationUrl(notification)}`,
    "",
    poweredByPlatformLine(),
  ].join("\n");
}

function dailySummaryHtml(notification: ParentNotification, branding: SchoolBranding, studentLabel: string) {
  const body = escapeHtml(notification.body).replace(/\n/g, "<br />");
  const url = notificationUrl(notification);
  const schoolName = escapeHtml(branding.displayName);
  const safeStudentLabel = escapeHtml(studentLabel);
  const primaryColor = escapeHtml(branding.primaryColor);

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <p style="margin:0 0 6px;color:${primaryColor};font-weight:700">${schoolName}</p>
      <h1 style="font-size:22px;margin:0 0 4px">Daily School Update</h1>
      ${safeStudentLabel ? `<p style="margin:0 0 12px;color:#64748b;font-size:14px">For ${safeStudentLabel}</p>` : ""}
      <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:0 0 16px">
        ${body}
      </div>
      <a href="${url}" style="display:inline-block;background:${primaryColor};color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">
        View full update
      </a>
      <p style="margin-top:18px;color:#64748b;font-size:13px">${poweredByPlatformLine()} You received this because ${schoolName} uses parent updates.</p>
    </div>
  `;
}

async function sendThroughChannel(input: {
  channel: ParentDeliveryChannel;
  recipient: string;
  notification: ParentNotification;
  branding: SchoolBranding;
  studentLabel: string;
}) {
  if (input.channel !== "EMAIL") {
    return {
      ok: false,
      skipped: true,
      provider: "not-configured",
      message: `${input.channel} delivery provider is not connected yet.`,
    };
  }

  const result = await sendEmail({
    to: input.recipient,
    subject: `${input.branding.displayName}: Daily update${input.studentLabel ? ` for ${input.studentLabel}` : ""}`,
    text: dailySummaryText(input.notification, input.branding, input.studentLabel),
    html: dailySummaryHtml(input.notification, input.branding, input.studentLabel),
  });

  if (result.ok) {
    return { ok: true, skipped: false, provider: result.provider };
  }

  return {
    ok: false,
    skipped: false,
    provider: result.provider,
    message: result.message,
  };
}

export async function deliverParentDailySummary(input: {
  schoolId: string;
  parentId: string;
  notification: ParentNotification;
}) {
  const [settings, parent, notificationPreference, branding] = await Promise.all([
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
    getSchoolBranding(input.schoolId),
  ]);

  if (!parent) return null;
  const parentWithPreference = { ...parent, notificationPreference };
  const dayStart = new Date(input.notification.occurredAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const students = await prisma.parentActivityEvent.findMany({
    where: {
      schoolId: input.schoolId,
      parentId: input.parentId,
      occurredAt: { gte: dayStart, lt: dayEnd },
    },
    distinct: ["studentId"],
    select: { student: { select: { name: true, surname: true } } },
  });
  const studentLabel = students
    .map((row) => row.student ? `${row.student.name} ${row.student.surname}` : null)
    .filter(Boolean)
    .join(", ");

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

    const result = await sendThroughChannel({
      channel,
      recipient,
      notification: input.notification,
      branding,
      studentLabel,
    });

    if (result.skipped) continue;

    return logDelivery({
      schoolId: input.schoolId,
      parentId: parent.id,
      notificationId: input.notification.id,
      channel,
      recipient,
      status: result.ok ? "SENT" : "FAILED",
      provider: result.provider,
      messagePreview: `${branding.displayName} daily update: ${input.notification.body}`,
      errorMessage: result.ok ? undefined : result.message,
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
