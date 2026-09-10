import prisma from "@/src/lib/prisma";

export const schoolCommunicationPolicyDefaults = {
  enabled: true,
  allowParentTeacherMessaging: false,
  allowInAppMessages: true,
  allowEmailMessages: true,
  allowSmsMessages: false,
  allowWhatsappMessages: false,
  exposeTeacherPhone: false,
  exposeTeacherEmail: false,
  requireParentReason: true,
  requireTeacherResponse: true,
  contactStartTime: "07:00",
  contactEndTime: "17:00",
  quietHoursStart: "20:00",
  quietHoursEnd: "06:00",
  responseSlaHours: 24,
  escalationEnabled: true,
  escalateAfterHours: 48,
  urgentBypassesQuietHours: true,
};

export async function ensureSchoolCommunicationPolicy(schoolId: string) {
  return prisma.schoolCommunicationPolicy.upsert({
    where: { schoolId },
    create: {
      schoolId,
      ...schoolCommunicationPolicyDefaults,
    },
    update: {},
  });
}
