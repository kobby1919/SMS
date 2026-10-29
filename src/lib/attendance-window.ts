type AttendanceWindowSettings = {
  allowEarlyAttendanceMarking: boolean;
  attendanceOpenMinutesBeforeLesson: number;
  attendanceGraceMinutesAfterLesson: number;
  attendanceEscalateMinutesAfterLesson: number;
};

export function attendanceWindowForLesson({ date, lesson, settings, now = new Date(), publishedAt }: {
  date: Date;
  lesson: { startTime: Date; endTime: Date };
  settings: AttendanceWindowSettings;
  now?: Date;
  publishedAt?: Date;
}) {
  const at = (time: Date) => {
    const value = new Date(date);
    value.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return value;
  };
  const add = (value: Date, minutes: number) => new Date(value.getTime() + minutes * 60_000);
  const startAt = at(lesson.startTime);
  const endAt = at(lesson.endTime);
  const openAt = settings.allowEarlyAttendanceMarking ? add(startAt, -settings.attendanceOpenMinutesBeforeLesson) : startAt;
  const deadlineAt = add(endAt, settings.attendanceGraceMinutesAfterLesson);
  const missedAt = add(endAt, settings.attendanceEscalateMinutesAfterLesson);
  const times = { openAt, deadlineAt, missedAt };
  if (publishedAt && publishedAt > startAt) {
    return { ...times, allowed: false, status: "NOT_REQUIRED" as const,
      message: "The timetable was published after this lesson started. No attendance duty or penalty applies for this lesson date." };
  }
  if (now < openAt) {
    return { ...times, allowed: false, status: "UPCOMING" as const,
      message: `Attendance opens at ${openAt.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" })}.` };
  }
  if (now > missedAt) {
    return { ...times, allowed: false, status: "MISSED" as const,
      message: "This attendance window has closed. Ask an admin to correct or approve late entry." };
  }
  return { ...times, allowed: true, status: now > deadlineAt ? "LATE" as const : "OPEN" as const, message: undefined };
}
