import {
  AppNotificationCategory,
  AppNotificationDeliveryChannel,
  AppNotificationPriority,
  AppNotificationType,
  Prisma,
} from "@/src/generated/prisma";

export type NotificationProviderPayload = {
  schoolId: string;
  notificationId: string;
  deliveryId: string;
  channel: AppNotificationDeliveryChannel;
  destination: string;
  provider?: string | null;
  title: string;
  body: string;
  href?: string | null;
  priority: AppNotificationPriority;
  category: AppNotificationCategory;
  type: AppNotificationType;
  payload?: Prisma.JsonValue | null;
};

export type NotificationProviderResult =
  | {
      ok: true;
      provider: string;
      providerMessageId?: string | null;
      delivered?: boolean;
      raw?: unknown;
    }
  | {
      ok: false;
      provider: string;
      error: string;
      retryAt?: Date | null;
      raw?: unknown;
    };

export interface NotificationProviderAdapter {
  readonly channel: AppNotificationDeliveryChannel;
  readonly name: string;
  send(payload: NotificationProviderPayload): Promise<NotificationProviderResult>;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function emailFromAddress() {
  return process.env.EMAIL_FROM ?? "Edujay <onboarding@edujay.app>";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function notificationUrl(href?: string | null) {
  if (!href) return null;
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("/") && !href.startsWith("//")) return `${appBaseUrl()}${href}`;
  return null;
}

function notificationEmailHtml(payload: NotificationProviderPayload) {
  const link = notificationUrl(payload.href);
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(payload.title)}</h1>
      <p>${escapeHtml(payload.body)}</p>
      ${
        link
          ? `<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#1d4ed8;color:white;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:700">Open in Edujay</a></p>`
          : ""
      }
      <p style="color:#6b7280;font-size:12px;margin-top:20px">This message was sent by Edujay for your school workspace.</p>
    </div>
  `;
}

function notificationText(payload: NotificationProviderPayload) {
  const link = notificationUrl(payload.href);
  return [payload.title, "", payload.body, link ? `Open in Edujay: ${link}` : null]
    .filter(Boolean)
    .join("\n");
}

function retryIn(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

class InAppProvider implements NotificationProviderAdapter {
  readonly channel = "IN_APP" as const;
  readonly name = "edujay-in-app";

  async send(payload: NotificationProviderPayload): Promise<NotificationProviderResult> {
    return {
      ok: true,
      provider: this.name,
      providerMessageId: payload.deliveryId,
      delivered: true,
    };
  }
}

class EmailProvider implements NotificationProviderAdapter {
  readonly channel = "EMAIL" as const;
  readonly name = process.env.APP_NOTIFICATION_EMAIL_PROVIDER || "resend";

  async send(payload: NotificationProviderPayload): Promise<NotificationProviderResult> {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      if (process.env.NODE_ENV === "production") {
        return {
          ok: false,
          provider: this.name,
          error: "Email provider is not configured.",
          retryAt: retryIn(30),
        };
      }

      console.info("[notification-email:console]", {
        to: payload.destination,
        subject: payload.title,
        text: notificationText(payload),
      });

      return {
        ok: true,
        provider: "console",
        providerMessageId: `console:${payload.deliveryId}`,
        delivered: true,
      };
    }

    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFromAddress(),
        to: payload.destination,
        subject: payload.title,
        html: notificationEmailHtml(payload),
        text: notificationText(payload),
      }),
    });

    let raw: unknown = null;
    try {
      raw = await response.json();
    } catch {
      raw = await response.text();
    }

    if (!response.ok) {
      return {
        ok: false,
        provider: this.name,
        error: typeof raw === "string" ? raw : `Email provider rejected the message with status ${response.status}.`,
        retryAt: response.status >= 500 || response.status === 429 ? retryIn(30) : null,
        raw,
      };
    }

    const providerMessageId = typeof raw === "object" && raw && "id" in raw ? String(raw.id) : null;
    return {
      ok: true,
      provider: this.name,
      providerMessageId,
      delivered: false,
      raw,
    };
  }
}

class UnconfiguredExternalProvider implements NotificationProviderAdapter {
  readonly channel: AppNotificationDeliveryChannel;
  readonly name: string;

  constructor(channel: "SMS" | "WHATSAPP", name: string) {
    this.channel = channel;
    this.name = name;
  }

  async send(): Promise<NotificationProviderResult> {
    return {
      ok: false,
      provider: this.name,
      error: `${this.channel} provider is not configured yet.`,
      retryAt: null,
    };
  }
}

const inAppProvider = new InAppProvider();
const emailProvider = new EmailProvider();
const smsProvider = new UnconfiguredExternalProvider("SMS", "sms-not-configured");
const whatsappProvider = new UnconfiguredExternalProvider("WHATSAPP", "whatsapp-not-configured");

export function getNotificationProvider(channel: AppNotificationDeliveryChannel): NotificationProviderAdapter {
  if (channel === "IN_APP") return inAppProvider;
  if (channel === "EMAIL") return emailProvider;
  if (channel === "SMS") return smsProvider;
  return whatsappProvider;
}

export async function sendNotificationWithProvider(payload: NotificationProviderPayload) {
  return getNotificationProvider(payload.channel).send(payload);
}