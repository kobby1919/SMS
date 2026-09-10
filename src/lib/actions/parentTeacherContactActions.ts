"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/authz";
import { parseActionInput } from "@/src/lib/validation/parse";
import { parentTeacherContactRequestSchema } from "@/src/lib/validation/parent-teacher-contact";
import { schoolCommunicationPolicyDefaults } from "@/src/lib/services/school-communication-policy";

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

  const [policy, student, teacherLesson] = await Promise.all([
    prisma.schoolCommunicationPolicy.findUnique({ where: { schoolId } }),
    prisma.student.findFirst({
      where: {
        id: parsed.studentId,
        parentId: userId,
        schoolId,
      },
      select: {
        id: true,
        classId: true,
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

  if (!teacherLesson || teacherLesson.classId !== student.classId) {
    throw new Error("This teacher is not assigned to this ward's class.");
  }

  const effectivePolicy = policy ?? schoolCommunicationPolicyDefaults;
  if (!effectivePolicy.enabled || !effectivePolicy.allowParentTeacherMessaging) {
    throw new Error("Parent-teacher messaging is currently disabled by the school.");
  }

  if (!channelAllowed(parsed.preferredChannel, effectivePolicy)) {
    throw new Error("The selected contact channel is not enabled by the school.");
  }

  const responseDueAt = new Date();
  responseDueAt.setHours(responseDueAt.getHours() + effectivePolicy.responseSlaHours);

  await prisma.parentTeacherContactRequest.create({
    data: {
      schoolId,
      parentId: userId,
      studentId: parsed.studentId,
      teacherId: parsed.teacherId,
      category: parsed.category,
      preferredChannel: parsed.preferredChannel,
      priority: parsed.priority,
      subject: parsed.subject,
      message: parsed.message,
      responseDueAt,
      metadata: {
        lessonId: teacherLesson.id,
        subjectName: teacherLesson.subject.name,
      },
    },
  });

  revalidatePath(`/parent/children/${parsed.studentId}`);
  revalidatePath("/parent");
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
