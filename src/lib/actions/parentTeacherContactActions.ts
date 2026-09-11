"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/authz";
import { parseActionInput } from "@/src/lib/validation/parse";
import {
  adminContactRequestReviewSchema,
  parentTeacherContactRequestSchema,
  teacherContactRequestIdSchema,
  teacherContactResponseSchema,
} from "@/src/lib/validation/parent-teacher-contact";
import {
  communicationRouteDefaults,
  schoolCommunicationPolicyDefaults,
} from "@/src/lib/services/school-communication-policy";
import { deliverParentContactNotification } from "@/src/lib/services/parent-notification-delivery";

function formValue(data: FormData, key: string, fallback = "") {
  return String(data.get(key) ?? fallback);
}

function channelAllowed(
  channel: "IN_APP" | "EMAIL" | "SMS" | "WHATSAPP",
  policy: {
    allowInAppMessages: boolean;
    allowEmailMessages: boolean;
    allowSmsMessages: boolean;
    allowWhatsappMessages: boolean;
  },
) {
  switch (channel) {
    case "IN_APP":
      return policy.allowInAppMessages;
    case "EMAIL":
      return policy.allowEmailMessages;
    case "SMS":
      return policy.allowSmsMessages;
    case "WHATSAPP":
      return policy.allowWhatsappMessages;
  }
}

export async function createParentTeacherContactRequest(data: unknown) {
  const { userId, schoolId } = await requireRole(["parent"]);
  const input =
    data instanceof FormData
      ? {
          studentId: formValue(data, "studentId"),
          teacherId: formValue(data, "teacherId"),
          category: formValue(data, "category", "GENERAL"),
          preferredChannel: formValue(data, "preferredChannel", "IN_APP"),
          priority: formValue(data, "priority", "NORMAL"),
          subject: formValue(data, "subject"),
          message: formValue(data, "message"),
        }
      : data;
  const parsed = parseActionInput(parentTeacherContactRequestSchema, input);

  const [policy, route, student, teacherLesson] = await Promise.all([
    prisma.schoolCommunicationPolicy.findUnique({ where: { schoolId } }),
    prisma.schoolCommunicationRoute.findUnique({
      where: {
        schoolId_category: {
          schoolId,
          category: parsed.category,
        },
      },
    }),
    prisma.student.findFirst({
      where: {
        id: parsed.studentId,
        parentId: userId,
        schoolId,
      },
      select: {
        id: true,
        classId: true,
        class: {
          select: {
            supervisorId: true,
          },
        },
      },
    }),
    prisma.lesson.findFirst({
      where: {
        schoolId,
        teacherId: parsed.teacherId,
        class: {
          students: {
            some: {
              id: parsed.studentId,
              parentId: userId,
              schoolId,
            },
          },
        },
      },
      select: {
        id: true,
        classId: true,
        subject: { select: { name: true } },
      },
    }),
  ]);

  if (!student) {
    throw new Error("This ward was not found for your account.");
  }

  const effectivePolicy = policy ?? schoolCommunicationPolicyDefaults;
  if (!effectivePolicy.enabled || !effectivePolicy.allowParentTeacherMessaging) {
    throw new Error("Parent-teacher messaging is currently disabled by the school.");
  }

  if (!channelAllowed(parsed.preferredChannel, effectivePolicy)) {
    throw new Error("The selected contact channel is not enabled by the school.");
  }

  const routeTarget = route?.target ?? communicationRouteDefaults[parsed.category];
  let routedTeacherId = parsed.teacherId;
  let routedSubjectName = teacherLesson?.subject.name ?? null;

  if (routeTarget === "SUBJECT_TEACHER") {
    if (!teacherLesson || teacherLesson.classId !== student.classId) {
      throw new Error("This teacher is not assigned to this ward's class.");
    }
  } else if (routeTarget === "CLASS_TEACHER") {
    if (!student.class.supervisorId) {
      throw new Error("No class teacher has been assigned for this ward's class yet.");
    }
    routedTeacherId = student.class.supervisorId;
  } else if (routeTarget === "SELECTED_TEACHER") {
    if (!route?.selectedTeacherId) {
      throw new Error("The school has not selected a teacher for this contact category yet.");
    }
    const selectedTeacher = await prisma.teacher.findFirst({
      where: {
        id: route.selectedTeacherId,
        schoolId,
      },
      select: { id: true },
    });
    if (!selectedTeacher) {
      throw new Error("The selected contact teacher is no longer available.");
    }
    routedTeacherId = selectedTeacher.id;
  } else {
    routedTeacherId = route?.selectedTeacherId ?? student.class.supervisorId ?? parsed.teacherId;
    const fallbackTeacher = await prisma.teacher.findFirst({
      where: {
        id: routedTeacherId,
        schoolId,
      },
      select: { id: true },
    });
    if (!fallbackTeacher) {
      throw new Error("The school office route is not ready yet. Please contact the school office directly.");
    }
  }

  const responseDueAt = new Date();
  responseDueAt.setHours(responseDueAt.getHours() + effectivePolicy.responseSlaHours);

  await prisma.parentTeacherContactRequest.create({
    data: {
      schoolId,
      parentId: userId,
      studentId: parsed.studentId,
      teacherId: routedTeacherId,
      category: parsed.category,
      preferredChannel: parsed.preferredChannel,
      priority: parsed.priority,
      subject: parsed.subject,
      message: parsed.message,
      responseDueAt,
      metadata: {
        requestedTeacherId: parsed.teacherId,
        routeTarget,
        routedTeacherId,
        lessonId: teacherLesson?.id ?? null,
        subjectName: routedSubjectName,
      },
      messages: {
        create: {
          schoolId,
          parentId: userId,
          senderRole: "PARENT",
          senderId: userId,
          body: parsed.message,
        },
      },
    },
  });

  revalidatePath(`/parent/children/${parsed.studentId}`);
  revalidatePath("/parent");
}

async function getTeacherOwnedContactRequest({
  schoolId,
  teacherId,
  requestId,
}: {
  schoolId: string;
  teacherId: string;
  requestId: string;
}) {
  const request = await prisma.parentTeacherContactRequest.findFirst({
    where: {
      id: requestId,
      schoolId,
      teacherId,
    },
    select: {
      id: true,
      status: true,
      subject: true,
      parentId: true,
      studentId: true,
    },
  });

  if (!request) {
    throw new Error("This contact request was not found for your teacher account.");
  }

  if (request.status === "CLOSED" || request.status === "CANCELLED") {
    throw new Error("This contact request is already closed.");
  }

  return request;
}

async function getAdminOwnedContactRequest({
  schoolId,
  requestId,
}: {
  schoolId: string;
  requestId: string;
}) {
  const request = await prisma.parentTeacherContactRequest.findFirst({
    where: {
      id: requestId,
      schoolId,
    },
    select: {
      id: true,
      status: true,
      subject: true,
      parentId: true,
      studentId: true,
      teacherId: true,
    },
  });

  if (!request) {
    throw new Error("This contact request was not found for your school.");
  }

  if (request.status === "CLOSED" || request.status === "CANCELLED") {
    throw new Error("This contact request is already closed.");
  }

  return request;
}

export async function acknowledgeParentTeacherContactRequest(data: unknown) {
  const { userId, schoolId } = await requireRole(["teacher"]);
  const input =
    data instanceof FormData
      ? { requestId: formValue(data, "requestId") }
      : data;
  const parsed = parseActionInput(teacherContactRequestIdSchema, input);
  const request = await getTeacherOwnedContactRequest({
    schoolId,
    teacherId: userId,
    requestId: parsed.requestId,
  });

  if (request.status === "PENDING") {
    await prisma.parentTeacherContactRequest.update({
      where: { id: request.id },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedAt: new Date(),
      },
    });
  }

  revalidatePath("/teacher/communications");
  revalidatePath(`/parent/children/${request.studentId}`);
}

export async function respondToParentTeacherContactRequest(data: unknown) {
  const { userId, schoolId } = await requireRole(["teacher"]);
  const input =
    data instanceof FormData
      ? {
          requestId: formValue(data, "requestId"),
          response: formValue(data, "response"),
        }
      : data;
  const parsed = parseActionInput(teacherContactResponseSchema, input);
  const request = await getTeacherOwnedContactRequest({
    schoolId,
    teacherId: userId,
    requestId: parsed.requestId,
  });
  const now = new Date();

  const notification = await prisma.$transaction(async (tx) => {
    await tx.parentTeacherContactRequest.update({
      where: { id: request.id },
      data: {
        status: "RESPONDED",
        acknowledgedAt: request.status === "PENDING" ? now : undefined,
        respondedAt: now,
        lastTeacherResponseAt: now,
      },
    });

    const message = await tx.parentTeacherContactMessage.create({
      data: {
          schoolId,
          teacherId: userId,
          senderRole: "TEACHER",
          senderId: userId,
          body: parsed.response,
        requestId: request.id,
      },
    });

    return tx.parentNotification.create({
      data: {
        schoolId,
        parentId: request.parentId,
        studentId: request.studentId,
        type: "CONTACT",
        priority: "NORMAL",
        title: "Teacher response received",
        body: `A teacher responded to: ${request.subject}`,
        href: `/parent/children/${request.studentId}#teachers`,
        sourceModel: "ParentTeacherContactMessage",
        sourceId: message.id,
        sourceKey: `parent-contact-response:${message.id}`,
        occurredAt: now,
        payload: {
          requestId: request.id,
          messageId: message.id,
        },
      },
    });
  });

  await deliverParentContactNotification({
    schoolId,
    parentId: request.parentId,
    notification,
  });

  revalidatePath("/teacher/communications");
  revalidatePath(`/parent/children/${request.studentId}`);
  revalidatePath("/parent/updates");
  revalidatePath("/parent");
}

export async function closeParentTeacherContactRequest(data: unknown) {
  const { userId, schoolId } = await requireRole(["teacher"]);
  const input =
    data instanceof FormData
      ? { requestId: formValue(data, "requestId") }
      : data;
  const parsed = parseActionInput(teacherContactRequestIdSchema, input);
  const request = await getTeacherOwnedContactRequest({
    schoolId,
    teacherId: userId,
    requestId: parsed.requestId,
  });

  await prisma.parentTeacherContactRequest.update({
    where: { id: request.id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      messages: {
        create: {
          schoolId,
          teacherId: userId,
          senderRole: "SYSTEM",
          senderId: userId,
          body: "The teacher marked this parent contact request as closed.",
          internalOnly: false,
        },
      },
    },
  });

  revalidatePath("/teacher/communications");
  revalidatePath(`/parent/children/${request.studentId}`);
}

export async function escalateParentTeacherContactRequestAsAdmin(data: unknown) {
  const { userId, schoolId } = await requireRole(["admin"]);
  const input =
    data instanceof FormData
      ? {
          requestId: formValue(data, "requestId"),
          note: formValue(data, "note"),
        }
      : data;
  const parsed = parseActionInput(adminContactRequestReviewSchema, input);
  const request = await getAdminOwnedContactRequest({
    schoolId,
    requestId: parsed.requestId,
  });

  const notification = await prisma.$transaction(async (tx) => {
    const message = await tx.parentTeacherContactMessage.create({
      data: {
          schoolId,
          requestId: request.id,
          teacherId: request.teacherId,
          parentId: request.parentId,
          studentId: request.studentId,
          senderRole: "ADMIN",
          senderId: userId,
          body: parsed.note
            ? `The school has escalated this contact request. Note: ${parsed.note}`
            : "The school has escalated this contact request for follow-up.",
          internalOnly: false,
        },
    });

    await tx.parentTeacherContactRequest.update({
      where: { id: request.id },
      data: {
        status: "ESCALATED",
      },
    });

    return tx.parentNotification.upsert({
      where: {
        schoolId_parentId_sourceKey: {
          schoolId,
          parentId: request.parentId,
          sourceKey: `parent-contact-admin-escalated:${request.id}`,
        },
      },
      create: {
        schoolId,
        parentId: request.parentId,
        studentId: request.studentId,
        type: "CONTACT",
        priority: "NORMAL",
        title: "School follow-up started",
        body: `The school escalated your contact request: ${request.subject}`,
        href: `/parent/children/${request.studentId}#teachers`,
        sourceModel: "ParentTeacherContactMessage",
        sourceId: message.id,
        sourceKey: `parent-contact-admin-escalated:${request.id}`,
        occurredAt: new Date(),
        payload: {
          requestId: request.id,
          messageId: message.id,
          action: "ADMIN_ESCALATED",
        },
      },
      update: {},
    });
  });

  await deliverParentContactNotification({
    schoolId,
    parentId: request.parentId,
    notification,
  });

  revalidatePath("/admin/communications");
  revalidatePath("/teacher/communications");
  revalidatePath(`/parent/children/${request.studentId}`);
}

export async function closeParentTeacherContactRequestAsAdmin(data: unknown) {
  const { userId, schoolId } = await requireRole(["admin"]);
  const input =
    data instanceof FormData
      ? {
          requestId: formValue(data, "requestId"),
          note: formValue(data, "note"),
        }
      : data;
  const parsed = parseActionInput(adminContactRequestReviewSchema, input);
  const request = await getAdminOwnedContactRequest({
    schoolId,
    requestId: parsed.requestId,
  });

  const notification = await prisma.$transaction(async (tx) => {
    const message = await tx.parentTeacherContactMessage.create({
      data: {
          schoolId,
          requestId: request.id,
          teacherId: request.teacherId,
          parentId: request.parentId,
          studentId: request.studentId,
          senderRole: "ADMIN",
          senderId: userId,
          body: parsed.note
            ? `The school closed this contact request. Note: ${parsed.note}`
            : "The school closed this contact request after review.",
          internalOnly: false,
        },
    });

    await tx.parentTeacherContactRequest.update({
      where: { id: request.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
      },
    });

    return tx.parentNotification.create({
      data: {
        schoolId,
        parentId: request.parentId,
        studentId: request.studentId,
        type: "CONTACT",
        priority: "NORMAL",
        title: "Contact request closed",
        body: `The school closed your contact request: ${request.subject}`,
        href: `/parent/children/${request.studentId}#teachers`,
        sourceModel: "ParentTeacherContactMessage",
        sourceId: message.id,
        sourceKey: `parent-contact-admin-closed:${message.id}`,
        occurredAt: new Date(),
        payload: {
          requestId: request.id,
          messageId: message.id,
          action: "ADMIN_CLOSED",
        },
      },
    });
  });

  await deliverParentContactNotification({
    schoolId,
    parentId: request.parentId,
    notification,
  });

  revalidatePath("/admin/communications");
  revalidatePath("/teacher/communications");
  revalidatePath(`/parent/children/${request.studentId}`);
}

export type ParentTeacherContactActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function createParentTeacherContactRequestWithState(
  _state: ParentTeacherContactActionState,
  data: FormData,
): Promise<ParentTeacherContactActionState> {
  try {
    await createParentTeacherContactRequest(data);
    return {
      status: "success",
      message: "Contact request sent. The school can now track the follow-up.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not send contact request.",
    };
  }
}

export async function acknowledgeParentTeacherContactRequestWithState(
  _state: ParentTeacherContactActionState,
  data: FormData,
): Promise<ParentTeacherContactActionState> {
  try {
    await acknowledgeParentTeacherContactRequest(data);
    return {
      status: "success",
      message: "Request acknowledged.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not acknowledge request.",
    };
  }
}

export async function respondToParentTeacherContactRequestWithState(
  _state: ParentTeacherContactActionState,
  data: FormData,
): Promise<ParentTeacherContactActionState> {
  try {
    await respondToParentTeacherContactRequest(data);
    return {
      status: "success",
      message: "Response sent.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not send response.",
    };
  }
}

export async function closeParentTeacherContactRequestWithState(
  _state: ParentTeacherContactActionState,
  data: FormData,
): Promise<ParentTeacherContactActionState> {
  try {
    await closeParentTeacherContactRequest(data);
    return {
      status: "success",
      message: "Request closed.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not close request.",
    };
  }
}

export async function escalateParentTeacherContactRequestAsAdminWithState(
  _state: ParentTeacherContactActionState,
  data: FormData,
): Promise<ParentTeacherContactActionState> {
  try {
    await escalateParentTeacherContactRequestAsAdmin(data);
    return {
      status: "success",
      message: "Request escalated for school follow-up.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not escalate request.",
    };
  }
}

export async function closeParentTeacherContactRequestAsAdminWithState(
  _state: ParentTeacherContactActionState,
  data: FormData,
): Promise<ParentTeacherContactActionState> {
  try {
    await closeParentTeacherContactRequestAsAdmin(data);
    return {
      status: "success",
      message: "Request closed after school review.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not close request.",
    };
  }
}
