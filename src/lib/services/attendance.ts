import prisma from "@/src/lib/prisma";
import type { AttendanceFollowUpStatus, AttendanceStatus } from "@/src/generated/prisma";
import { recordParentActivityEvents } from "@/src/lib/services/parent-activity-events";
import {
  attendanceObligationSourceKey,
  evaluateAttendanceWindow,
  syncAttendanceObligationsForDate,
} from "@/src/lib/services/teacher-attendance-obligations";

const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
};

export type AttendanceStatusCounts = Record<AttendanceStatus, number>;

export type AttendanceStatusCountRow = {
  status: AttendanceStatus;
  _count: { _all: number };
};

export type AttendanceFlagStudent = {
  id: string;
  name: string;
  surname: string;
  class: { name: string };
};

export type FlaggedAttendanceStudent = {
  id: string;
  name: string;
  surname: string;
  className: string;
  streak: number;
};

const EMPTY_STATUS_COUNTS: AttendanceStatusCounts = {
  PRESENT: 0,
  ABSENT: 0,
  LATE: 0,
  EXCUSED: 0,
};

export function normalizeAttendanceStatusCounts(
  rows: AttendanceStatusCountRow[],
): AttendanceStatusCounts {
  const counts = { ...EMPTY_STATUS_COUNTS };
  for (const row of rows) {
    counts[row.status] = row._count._all;
  }
  return counts;
}

export async function getAttendanceStatusCounts({
  schoolId,
  start,
  end,
}: {
  schoolId: string;
  start: Date;
  end: Date;
}): Promise<AttendanceStatusCounts> {
  const grouped = await prisma.attendance.groupBy({
    by: ["status"],
    where: { schoolId, date: { gte: start, lte: end } },
    _count: { _all: true },
  });

  return normalizeAttendanceStatusCounts(grouped);
}

export async function getFlaggedAttendanceStudents({
  schoolId,
  students,
  since,
  minStreak = 3,
  maxRecordsPerStudent = 5,
}: {
  schoolId: string;
  students: AttendanceFlagStudent[];
  since: Date;
  minStreak?: number;
  maxRecordsPerStudent?: number;
}): Promise<FlaggedAttendanceStudent[]> {
  const studentIds = students.map((student) => student.id);
  if (studentIds.length === 0) return [];

  const recentRows = await prisma.attendance.findMany({
    where: {
      schoolId,
      studentId: { in: studentIds },
      date: { gte: since },
    },
    orderBy: [{ studentId: "asc" }, { date: "desc" }],
    select: { studentId: true, status: true },
  });

  const recentByStudent = new Map<string, { status: AttendanceStatus }[]>();
  for (const row of recentRows) {
    const recent = recentByStudent.get(row.studentId) ?? [];
    if (recent.length < maxRecordsPerStudent) {
      recent.push({ status: row.status });
      recentByStudent.set(row.studentId, recent);
    }
  }

  const flagged: FlaggedAttendanceStudent[] = [];
  for (const student of students) {
    const recent = recentByStudent.get(student.id) ?? [];
    let streak = 0;
    for (const record of recent) {
      if (record.status === "ABSENT") streak += 1;
      else break;
    }
    if (streak >= minStreak) {
      flagged.push({
        id: student.id,
        name: student.name,
        surname: student.surname,
        className: student.class.name,
        streak,
      });
    }
  }

  return flagged.sort((a, b) => b.streak - a.streak);
}

export async function getAttendanceRecords({
  schoolId,
  lessonId,
  date,
}: {
  schoolId: string;
  lessonId: number;
  date: Date;
}) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  return prisma.attendance.findMany({
    where: { schoolId, lessonId, date: { gte: dayStart, lte: dayEnd } },
    include: {
      student: { select: { id: true, name: true, surname: true, img: true } },
    },
  });
}

export async function saveAttendance({
  schoolId,
  lessonId,
  date,
  records,
  actorId,
  actorRole,
}: {
  schoolId: string;
  lessonId: number;
  date: Date;
  records: {
    studentId: string;
    status: AttendanceStatus;
    note?: string | null;
    arrivalTime?: string | null;
  }[];
  actorId: string;
  actorRole: string;
}) {
  const attendanceDate = new Date(date);
  attendanceDate.setHours(12, 0, 0, 0);
  const dayStart = new Date(attendanceDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(attendanceDate);
  dayEnd.setHours(23, 59, 59, 999);
  const attendanceDayKey = dayStart.toISOString().slice(0, 10);
  const attendanceEventBaseKey = `attendance:${lessonId}:${attendanceDayKey}`;
  const studentIds = [...new Set(records.map((record) => record.studentId))];

  if (studentIds.length !== records.length) {
    throw new Error("Each student may appear only once in an attendance submission.");
  }
  const lateWithoutNote = records.find((record) => record.status === "LATE" && !record.note?.trim());
  if (lateWithoutNote) {
    throw new Error("Late attendance requires a note.");
  }
  const lateWithoutArrivalTime = records.find((record) => record.status === "LATE" && !record.arrivalTime?.trim());
  if (lateWithoutArrivalTime) {
    throw new Error("Late attendance requires arrival time.");
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedDay = new Date(attendanceDate);
  selectedDay.setHours(0, 0, 0, 0);
  if (actorRole === "teacher" && selectedDay < today) {
    throw new Error("Past attendance is locked for teachers. Please ask an admin to correct it.");
  }
  const cleanedRecords = records.map((record) => ({
    ...record,
    note: record.note?.trim() || null,
    arrivalTime: record.status === "LATE" ? record.arrivalTime?.trim() ?? null : null,
    followUpStatus: attendanceFollowUpStatus(record.status, record.note),
  }));

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, schoolId },
    select: { id: true, classId: true, teacherId: true },
  });
  if (!lesson) throw new Error("Lesson not found.");
  if (actorRole === "teacher" && lesson.teacherId !== actorId) {
    throw new Error("You can only submit attendance for lessons assigned to you.");
  }
  if (actorRole === "teacher") {
    const attendanceObligation = await prisma.teacherObligation.findUnique({
      where: {
        schoolId_teacherId_sourceKey: {
          schoolId,
          teacherId: lesson.teacherId,
          sourceKey: attendanceObligationSourceKey(lessonId, attendanceDate),
        },
      },
      select: {
        status: true,
        escalations: {
          where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (
      attendanceObligation?.status === "ESCALATED" ||
      (attendanceObligation?.escalations.length ?? 0) > 0
    ) {
      throw new Error("This attendance duty has been escalated. Ask an admin to review or approve the correction.");
    }

    const window = await evaluateAttendanceWindow({
      schoolId,
      lessonId,
      date: attendanceDate,
    });
    if (!window.allowed) {
      await syncAttendanceObligationsForDate({
        schoolId,
        teacherId: lesson.teacherId,
        date: attendanceDate,
      });
      throw new Error(window.message ?? "Attendance is not open for this lesson.");
    }
  }

  const validStudents = await prisma.student.findMany({
    where: { schoolId, classId: lesson.classId, id: { in: studentIds } },
    select: { id: true, name: true, surname: true },
  });
  if (validStudents.length !== studentIds.length) {
    throw new Error("One or more students do not belong to this lesson's class.");
  }
  const validStudentById = new Map(validStudents.map((student) => [student.id, student]));

  const existingRecords = await prisma.attendance.findMany({
    where: {
      schoolId,
      lessonId,
      date: { gte: dayStart, lte: dayEnd },
      studentId: { in: studentIds },
    },
    orderBy: [
      { updatedAt: "desc" },
      { id: "desc" },
    ],
  });
  const existingByStudent = new Map<string, typeof existingRecords[number]>();
  const duplicateAttendanceIds: number[] = [];
  for (const record of existingRecords) {
    if (!existingByStudent.has(record.studentId)) {
      existingByStudent.set(record.studentId, record);
    } else {
      duplicateAttendanceIds.push(record.id);
    }
  }

  await prisma.$transaction(
    [
      ...(duplicateAttendanceIds.length
        ? [
            prisma.attendance.deleteMany({
              where: {
                schoolId,
                id: { in: duplicateAttendanceIds },
              },
            }),
      ]
        : []),
      ...cleanedRecords.flatMap((record) => {
        const existing = existingByStudent.get(record.studentId);
        const nextData = {
          schoolId,
          studentId: record.studentId,
          lessonId,
          date: attendanceDate,
          status: record.status,
          present: record.status === "PRESENT",
          note: record.note,
          arrivalTime: record.arrivalTime,
          followUpStatus: record.followUpStatus,
        };

        if (!existing) {
          return [
            prisma.attendance.create({ data: nextData }),
          ];
        }

        const changed = existing.status !== record.status ||
          (existing.note ?? null) !== record.note ||
          (existing.arrivalTime ?? null) !== record.arrivalTime ||
          existing.followUpStatus !== record.followUpStatus;

        if (!changed) return [];

        return [
          prisma.attendance.update({
            where: { id: existing.id },
            data: {
              status: record.status,
              present: record.status === "PRESENT",
              note: record.note,
              arrivalTime: record.arrivalTime,
              followUpStatus: record.followUpStatus,
              correctionCount: { increment: 1 },
              lastCorrectedAt: new Date(),
            },
          }),
          prisma.attendanceAuditLog.create({
            data: {
              schoolId,
              attendanceId: existing.id,
              studentId: record.studentId,
              lessonId,
              actorId,
              action: selectedDay < today ? "PAST_ATTENDANCE_CORRECTED" : "ATTENDANCE_CORRECTED",
              previousStatus: existing.status,
              newStatus: record.status,
              previousNote: existing.note,
              newNote: record.note,
              previousArrivalTime: existing.arrivalTime,
              newArrivalTime: record.arrivalTime,
              previousFollowUp: existing.followUpStatus,
              newFollowUp: record.followUpStatus,
              reason: record.note ?? "No note provided.",
            },
          }),
        ];
      }),
    ],
  );
  const savedAttendanceRows = await prisma.attendance.findMany({
    where: {
      schoolId,
      lessonId,
      date: { gte: dayStart, lte: dayEnd },
      studentId: { in: studentIds },
    },
    select: { id: true, studentId: true },
  });
  const savedAttendanceByStudent = new Map(savedAttendanceRows.map((row) => [row.studentId, row.id]));

  const lessonForEvent = await prisma.lesson.findFirst({
    where: { id: lessonId, schoolId },
    select: {
      teacherId: true,
      teacher: { select: { name: true, surname: true } },
      subject: { select: { name: true } },
    },
  });

  if (lessonForEvent) {
    const teacherName = `${lessonForEvent.teacher.name} ${lessonForEvent.teacher.surname}`;
    const attendanceSourceKeys = studentIds.map((studentId) => `${attendanceEventBaseKey}:${studentId}`);
    await prisma.parentActivityEvent.deleteMany({
      where: {
        schoolId,
        type: "ATTENDANCE",
        sourceModel: "Attendance",
        OR: [
          { sourceKey: { in: attendanceSourceKeys } },
          { sourceId: { in: savedAttendanceRows.map((row) => String(row.id)) } },
        ],
        studentId: { in: studentIds },
      },
    });
    await prisma.parentNotification.deleteMany({
      where: {
        schoolId,
        type: "ATTENDANCE",
        sourceModel: "Attendance",
        OR: [
          { sourceKey: { in: attendanceSourceKeys } },
          { sourceId: { in: savedAttendanceRows.map((row) => String(row.id)) } },
        ],
        studentId: { in: studentIds },
      },
    });
    await Promise.all(
      cleanedRecords.map((record) => {
        const attendanceId = savedAttendanceByStudent.get(record.studentId);
        if (!attendanceId) return Promise.resolve([]);
        const student = validStudentById.get(record.studentId);
        const studentName = student ? `${student.name} ${student.surname}` : "Your child";
        const statusLabel = ATTENDANCE_STATUS_LABELS[record.status];
        const note = record.note;
        const needsReason = record.status === "ABSENT" || record.status === "LATE";
        const body = [
          `${statusLabel} for ${lessonForEvent.subject.name}${record.arrivalTime ? ` at ${record.arrivalTime}` : ""}.`,
          `Teacher: ${teacherName}`,
          note
            ? `Note: ${note}`
            : needsReason
              ? "Note: No reason provided yet."
              : null,
        ].filter(Boolean).join("\n");

        return recordParentActivityEvents({
          schoolId,
          studentIds: [record.studentId],
          teacherId: lessonForEvent.teacherId,
          type: "ATTENDANCE",
          title: `${lessonForEvent.subject.name} attendance: ${statusLabel}`,
          body,
          href: "/parent/updates",
          sourceModel: "Attendance",
          sourceId: String(attendanceId),
          sourceKey: attendanceEventBaseKey,
          occurredAt: attendanceDate,
          payload: {
            studentName,
            status: record.status,
            statusLabel,
            note: note ?? null,
            arrivalTime: record.arrivalTime,
            followUpStatus: record.followUpStatus,
            subjectName: lessonForEvent.subject.name,
            teacherName,
          },
        });
      }),
    );
  }

  await syncAttendanceObligationsForDate({
    schoolId,
    teacherId: lesson.teacherId,
    date: attendanceDate,
  });

  return records.length;
}

function attendanceFollowUpStatus(
  status: AttendanceStatus,
  note?: string | null,
): AttendanceFollowUpStatus {
  if (status !== "ABSENT") return "NOT_REQUIRED";
  return note?.trim() ? "REASON_PROVIDED" : "PENDING_REASON";
}

export async function deleteAttendanceRecord({
  schoolId,
  id,
}: {
  schoolId: string;
  id: number;
}) {
  return prisma.attendance.deleteMany({ where: { id, schoolId } });
}

export async function getStudentAttendanceStats(schoolId: string, studentId: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    select: { id: true },
  });
  if (!student) return null;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [grouped, recentHistory] = await Promise.all([
    prisma.attendance.groupBy({
      by: ["status"],
      where: { schoolId, studentId },
      _count: { _all: true },
    }),
    prisma.attendance.findMany({
      where: { schoolId, studentId, date: { gte: thirtyDaysAgo } },
      orderBy: { date: "desc" },
      select: {
        date: true,
        status: true,
        lesson: { select: { subject: { select: { name: true } } } },
      },
    }),
  ]);

  const counts = normalizeAttendanceStatusCounts(grouped);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  let consecutiveAbsences = 0;
  for (const record of recentHistory) {
    if (record.status !== "ABSENT") break;
    consecutiveAbsences += 1;
  }

  return {
    total,
    present: counts.PRESENT,
    absent: counts.ABSENT,
    late: counts.LATE,
    excused: counts.EXCUSED,
    attendanceRate: total > 0 ? Math.round((counts.PRESENT / total) * 100) : 0,
    consecutiveAbsences,
    recentHistory: [...recentHistory].reverse(),
  };
}

export async function getClassAttendanceStats(schoolId: string, classId: number) {
  const students = await prisma.student.findMany({
    where: { schoolId, classId },
    select: { id: true, name: true, surname: true, img: true },
  });
  if (students.length === 0) return [];

  const grouped = await prisma.attendance.groupBy({
    by: ["studentId", "status"],
    where: { schoolId, studentId: { in: students.map((student) => student.id) } },
    _count: { _all: true },
  });
  const countsByStudent = new Map<string, Record<string, number>>();
  for (const row of grouped) {
    const counts = countsByStudent.get(row.studentId) ?? {};
    counts[row.status] = row._count._all;
    countsByStudent.set(row.studentId, counts);
  }

  return students.map((student) => {
    const counts = countsByStudent.get(student.id) ?? {};
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const present = counts.PRESENT ?? 0;
    return {
      ...student,
      total,
      present,
      absent: counts.ABSENT ?? 0,
      rate: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  });
}

export async function getSchoolAttendanceOverview(schoolId: string) {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const since = new Date(today);
  since.setDate(since.getDate() - 30);

  const [counts, students] = await Promise.all([
    getAttendanceStatusCounts({ schoolId, start: today, end: todayEnd }),
    prisma.student.findMany({
      where: { schoolId },
      select: { id: true, name: true, surname: true, class: { select: { name: true } } },
    }),
  ]);
  const flagged = await getFlaggedAttendanceStudents({ schoolId, students, since });

  return {
    todayTotal: Object.values(counts).reduce((sum, count) => sum + count, 0),
    todayPresent: counts.PRESENT,
    todayAbsent: counts.ABSENT,
    todayLate: counts.LATE,
    flagged,
  };
}
