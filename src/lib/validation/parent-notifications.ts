import { z } from "zod";

const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm time format.");

export const parentDeliveryChannelSchema = z.enum(["EMAIL", "SMS", "WHATSAPP"]);

export const schoolNotificationSettingsSchema = z.object({
  timezone: z.string().min(3).max(80).default("Africa/Accra"),
  openingTime: timeStringSchema,
  closingTime: timeStringSchema,
  dailySummarySendTime: timeStringSchema,
  activeDays: z
    .array(z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]))
    .min(1, "Select at least one active day."),
  emailEnabled: z.boolean().default(true),
  smsEnabled: z.boolean().default(true),
  whatsappEnabled: z.boolean().default(false),
  urgentAlertsImmediate: z.boolean().default(true),
  quietHoursStart: timeStringSchema,
  quietHoursEnd: timeStringSchema,
});

export const parentNotificationPreferenceSchema = z.object({
  dailySummaryEnabled: z.boolean().default(true),
  urgentAlertsEnabled: z.boolean().default(true),
  preferredChannel: parentDeliveryChannelSchema,
  fallbackChannel: parentDeliveryChannelSchema,
  emailEnabled: z.boolean().default(true),
  smsEnabled: z.boolean().default(true),
  whatsappEnabled: z.boolean().default(true),
});

export const parentUpdatesQuerySchema = z.object({
  date: z.string().date().optional(),
});
