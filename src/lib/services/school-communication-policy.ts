import prisma from "@/src/lib/prisma";

export const communicationRouteCategories = [
  "ATTENDANCE",
  "ACADEMIC_SUPPORT",
  "HOMEWORK",
  "WELLBEING",
  "GENERAL",
] as const;

export const communicationRouteDefaults = {
  ATTENDANCE: "CLASS_TEACHER",
  ACADEMIC_SUPPORT: "SUBJECT_TEACHER",
  HOMEWORK: "SUBJECT_TEACHER",
  WELLBEING: "CLASS_TEACHER",
  GENERAL: "CLASS_TEACHER",
} as const;

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
  const [policy] = await prisma.$transaction([
    prisma.schoolCommunicationPolicy.upsert({
      where: { schoolId },
      create: {
        schoolId,
        ...schoolCommunicationPolicyDefaults,
      },
      update: {},
    }),
    ...communicationRouteCategories.map((category) =>
      prisma.schoolCommunicationRoute.upsert({
        where: {
          schoolId_category: {
            schoolId,
            category,
          },
        },
        create: {
          schoolId,
          category,
          target: communicationRouteDefaults[category],
        },
        update: {},
      }),
    ),
  ]);

  return policy;
}

export async function ensureSchoolCommunicationRoutes(schoolId: string) {
  await ensureSchoolCommunicationPolicy(schoolId);
  return prisma.schoolCommunicationRoute.findMany({
    where: { schoolId },
    orderBy: { category: "asc" },
  });
}
