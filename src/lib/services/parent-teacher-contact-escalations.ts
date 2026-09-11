import prisma from "@/src/lib/prisma";
import { schoolCommunicationPolicyDefaults } from "@/src/lib/services/school-communication-policy";

export type ParentTeacherContactEscalationResult = {
  schoolId: string;
  checkedRequests: number;
  escalatedRequests: number;
  skipped: number;
};

function subtractHours(date: Date, hours: number) {
  const value = new Date(date);
  value.setHours(value.getHours() - hours);
  return value;
}

function escalationMessage(subject: string) {
  return `The school has escalated this parent contact request because it has not been resolved within the expected response time. Subject: ${subject}`;
}

export async function processParentTeacherContactEscalationsForSchool({
  schoolId,
  now = new Date(),
  limit = 100,
}: {
  schoolId: string;
  now?: Date;
  limit?: number;
}): Promise<ParentTeacherContactEscalationResult> {
  const policy = await prisma.schoolCommunicationPolicy.findUnique({
    where: { schoolId },
    select: {
      enabled: true,
      allowParentTeacherMessaging: true,
      escalationEnabled: true,
      escalateAfterHours: true,
    },
  });
  const effectivePolicy = policy ?? schoolCommunicationPolicyDefaults;

  if (
    !effectivePolicy.enabled ||
    !effectivePolicy.allowParentTeacherMessaging ||
    !effectivePolicy.escalationEnabled
  ) {
    return {
      schoolId,
      checkedRequests: 0,
      escalatedRequests: 0,
      skipped: 0,
    };
  }

  const escalationCutoff = subtractHours(now, effectivePolicy.escalateAfterHours);
  const requests = await prisma.parentTeacherContactRequest.findMany({
    where: {
      schoolId,
      status: { in: ["PENDING", "ACKNOWLEDGED"] },
      createdAt: { lte: escalationCutoff },
    },
    select: {
      id: true,
      subject: true,
      status: true,
      schoolId: true,
      parentId: true,
      studentId: true,
      teacherId: true,
      responseDueAt: true,
      createdAt: true,
    },
    orderBy: [{ responseDueAt: "asc" }, { createdAt: "asc" }],
    take: limit,
  });

  let escalatedRequests = 0;
  let skipped = 0;

  for (const request of requests) {
    const message = escalationMessage(request.subject);
    const existingSystemMessage = await prisma.parentTeacherContactMessage.findFirst({
      where: {
        schoolId,
        requestId: request.id,
        senderRole: "SYSTEM",
        body: message,
      },
      select: { id: true },
    });

    if (existingSystemMessage) {
      skipped += 1;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.parentTeacherContactRequest.update({
        where: { id: request.id },
        data: { status: "ESCALATED" },
      });

      const threadMessage = await tx.parentTeacherContactMessage.create({
        data: {
          schoolId,
          requestId: request.id,
          parentId: request.parentId,
          studentId: request.studentId,
          teacherId: request.teacherId,
          senderRole: "SYSTEM",
          senderId: "system",
          body: message,
          internalOnly: false,
        },
      });

      const sourceKey = `parent-contact-auto-escalated:${request.id}`;
      await tx.parentNotification.upsert({
        where: {
          schoolId_parentId_sourceKey: {
            schoolId,
            parentId: request.parentId,
            sourceKey,
          },
        },
        create: {
          schoolId,
          parentId: request.parentId,
          studentId: request.studentId,
          type: "CONTACT",
          priority: "NORMAL",
          title: "School follow-up started",
          body: `The school has escalated your contact request: ${request.subject}`,
          href: `/parent/children/${request.studentId}#teachers`,
          sourceModel: "ParentTeacherContactMessage",
          sourceId: threadMessage.id,
          sourceKey,
          occurredAt: now,
          payload: {
            requestId: request.id,
            escalatedAt: now.toISOString(),
            previousStatus: request.status,
          },
        },
        update: {},
      });
    });

    escalatedRequests += 1;
  }

  return {
    schoolId,
    checkedRequests: requests.length,
    escalatedRequests,
    skipped,
  };
}

export async function runParentTeacherContactEscalationWorker({
  schoolId,
  now = new Date(),
  limit = 100,
}: {
  schoolId?: string;
  now?: Date;
  limit?: number;
} = {}) {
  const schools = await prisma.school.findMany({
    where: schoolId ? { id: schoolId } : undefined,
    select: { id: true },
    orderBy: { id: "asc" },
  });

  const results: ParentTeacherContactEscalationResult[] = [];
  for (const school of schools) {
    results.push(
      await processParentTeacherContactEscalationsForSchool({
        schoolId: school.id,
        now,
        limit,
      }),
    );
  }

  return {
    processedSchools: results.length,
    results,
  };
}
