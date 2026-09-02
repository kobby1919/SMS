import { z } from "zod";

const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm time format.");

export const syllabusUpdateExpectationSchema = z.enum([
  "SAME_DAY",
  "WEEKLY",
  "MANUAL",
]);

export const teacherAccountabilitySettingsSchema = z.object({
  attendanceOpenMinutesBeforeLesson: z.coerce.number().int().min(0).max(120),
  attendanceGraceMinutesAfterLesson: z.coerce.number().int().min(0).max(180),
  attendanceEscalateMinutesAfterLesson: z.coerce.number().int().min(0).max(360),
  allowEarlyAttendanceMarking: z.boolean().default(true),
  requireLateAttendanceNote: z.boolean().default(true),
  requireAttendanceCorrectionReason: z.boolean().default(true),
  caScorePublishWindowSchoolDays: z.coerce.number().int().min(1).max(20),
  caReminderAfterSchoolDays: z.coerce.number().int().min(1).max(20),
  caEscalateAfterSchoolDays: z.coerce.number().int().min(1).max(30),
  homeworkCheckWindowSchoolDays: z.coerce.number().int().min(0).max(20),
  homeworkEscalateAfterSchoolDays: z.coerce.number().int().min(0).max(30),
  syllabusUpdateExpectation: syllabusUpdateExpectationSchema.default("SAME_DAY"),
  teacherCloseoutTime: timeStringSchema,
  remindersEnabled: z.boolean().default(true),
  escalationsEnabled: z.boolean().default(true),
  correctionApprovalRequired: z.boolean().default(true),
}).superRefine((value, ctx) => {
  if (value.attendanceEscalateMinutesAfterLesson <= value.attendanceGraceMinutesAfterLesson) {
    ctx.addIssue({
      code: "custom",
      path: ["attendanceEscalateMinutesAfterLesson"],
      message: "Escalation must happen after the attendance grace period.",
    });
  }

  if (value.caReminderAfterSchoolDays >= value.caEscalateAfterSchoolDays) {
    ctx.addIssue({
      code: "custom",
      path: ["caEscalateAfterSchoolDays"],
      message: "CA escalation must happen after the reminder day.",
    });
  }

  if (value.homeworkCheckWindowSchoolDays >= value.homeworkEscalateAfterSchoolDays) {
    ctx.addIssue({
      code: "custom",
      path: ["homeworkEscalateAfterSchoolDays"],
      message: "Homework escalation must happen after the checking window.",
    });
  }
});

export type TeacherAccountabilitySettingsInput = z.infer<
  typeof teacherAccountabilitySettingsSchema
>;

export const teacherEscalationReviewSchema = z.object({
  escalationId: z.string().min(1, "Escalation is required."),
  action: z.enum(["ACKNOWLEDGE", "RESOLVE", "DISMISS"]),
  note: z
    .string()
    .trim()
    .min(5, "Add a short management note.")
    .max(500, "Keep the note below 500 characters."),
});

export type TeacherEscalationReviewInput = z.infer<
  typeof teacherEscalationReviewSchema
>;
