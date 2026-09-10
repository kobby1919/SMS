import { z } from "zod";

const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm time format.");

export const schoolCommunicationPolicySchema = z
  .object({
    enabled: z.boolean().default(true),
    allowParentTeacherMessaging: z.boolean().default(false),
    allowInAppMessages: z.boolean().default(true),
    allowEmailMessages: z.boolean().default(true),
    allowSmsMessages: z.boolean().default(false),
    allowWhatsappMessages: z.boolean().default(false),
    exposeTeacherPhone: z.boolean().default(false),
    exposeTeacherEmail: z.boolean().default(false),
    requireParentReason: z.boolean().default(true),
    requireTeacherResponse: z.boolean().default(true),
    contactStartTime: timeStringSchema,
    contactEndTime: timeStringSchema,
    quietHoursStart: timeStringSchema,
    quietHoursEnd: timeStringSchema,
    responseSlaHours: z.coerce
      .number()
      .int()
      .min(1, "Response SLA must be at least 1 hour.")
      .max(168, "Response SLA cannot exceed 7 days."),
    escalationEnabled: z.boolean().default(true),
    escalateAfterHours: z.coerce
      .number()
      .int()
      .min(1, "Escalation time must be at least 1 hour.")
      .max(336, "Escalation time cannot exceed 14 days."),
    urgentBypassesQuietHours: z.boolean().default(true),
  })
  .refine((data) => data.escalateAfterHours >= data.responseSlaHours, {
    path: ["escalateAfterHours"],
    message: "Escalation time must be greater than or equal to the response SLA.",
  })
  .refine(
    (data) =>
      data.allowInAppMessages ||
      data.allowEmailMessages ||
      data.allowSmsMessages ||
      data.allowWhatsappMessages,
    {
      path: ["allowInAppMessages"],
      message: "Enable at least one communication channel.",
    },
  );

export const parentTeacherContactRouteTargetSchema = z.enum([
  "SUBJECT_TEACHER",
  "CLASS_TEACHER",
  "SELECTED_TEACHER",
  "SCHOOL_OFFICE",
]);

export const communicationRouteSchema = z
  .object({
    category: z.enum(["ATTENDANCE", "ACADEMIC_SUPPORT", "HOMEWORK", "WELLBEING", "GENERAL"]),
    target: parentTeacherContactRouteTargetSchema,
    selectedTeacherId: z.string().trim().optional().nullable(),
  })
  .refine(
    (data) => data.target !== "SELECTED_TEACHER" || Boolean(data.selectedTeacherId),
    {
      path: ["selectedTeacherId"],
      message: "Choose a teacher when the route target is selected teacher.",
    },
  );

export const communicationRoutesSchema = z.array(communicationRouteSchema).length(5);
