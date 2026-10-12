import type { AttendanceStatus, Day } from "@/src/generated/prisma";

export type DayPosition = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED" | "UNKNOWN" | "NO_LESSONS";
export type ReviewMark = { id: number; studentId: string; lessonId: number; date: Date; status: AttendanceStatus; updatedAt: Date };
export type ReviewLesson = { sourceId: number; classId: number; className: string; subjectName: string; teacherName: string; teacherId: string; day: Day; startTime: Date; endTime: Date };
export type ReviewPublication = { id: string; publishedAt: Date; archivedAt: Date | null; lessons: ReviewLesson[] };
export function eligibleAttendanceStudentIds(students: { id: string; createdAt: Date }[], starts: Date, recordedIds: Iterable<string>) {
  const recorded = new Set(recordedIds);
  return new Set(students.filter((student) => student.createdAt <= starts || recorded.has(student.id)).map((student) => student.id));
}
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timezone: string) {
  let value = dateFormatters.get(timezone);
  if (!value) { value = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }); dateFormatters.set(timezone, value); }
  return value;
}
function parts(date: Date, timezone: string) {
  return Object.fromEntries(formatter(timezone).formatToParts(date).map((part) => [part.type, part.value]));
}
export function schoolAttendanceDate(date: Date, timezone: string) {
  const p = parts(date, timezone);
  return `${p.year}-${p.month}-${p.day}`;
}
export function shiftAttendanceDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function attendanceDateBounds(date: string, timezone: string) {
  function start(key: string) {
    const center = Date.parse(`${key}T12:00:00Z`);
    let low = center - 36 * 3600000, high = center + 36 * 3600000;
    while (low < high) { const middle = Math.floor((low + high) / 2); if (schoolAttendanceDate(new Date(middle), timezone) < key) low = middle + 1; else high = middle; }
    if (schoolAttendanceDate(new Date(low), timezone) !== key) throw new Error("This calendar date does not exist in the school timezone.");
    return new Date(low);
  }
  return { start: start(date), end: start(shiftAttendanceDate(date, 1)) };
}
export function attendanceClock(date: string, clock: Date, timezone: string) {
  const target = new Date(`${date}T${clock.toISOString().slice(11, 19)}Z`).getTime();
  let candidate = target;
  for (let index = 0; index < 4; index++) {
    const p = parts(new Date(candidate), timezone);
    const observed = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
    const difference = target - observed;
    if (!difference) return new Date(candidate);
    candidate += difference;
  }
  throw new Error("The lesson time cannot be resolved in the school timezone.");
}
export function attendanceWeekday(date: string) {
  return ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][new Date(`${date}T12:00:00Z`).getUTCDay()];
}
export function latestAttendanceMarks(rows: ReviewMark[]) {
  const latest = new Map<string, ReviewMark>();
  for (const row of rows) {
    const key = `${row.studentId}:${row.lessonId}`;
    const existing = latest.get(key);
    if (!existing || row.updatedAt > existing.updatedAt || (row.updatedAt.getTime() === existing.updatedAt.getTime() && row.id > existing.id)) latest.set(key, row);
  }
  return [...latest.values()];
}
export function schoolDayPosition(rows: ReviewMark[], expectedLessonIds: number[], absenceCanBeConfirmed = true): DayPosition {
  const marks = latestAttendanceMarks(rows).filter((row) => expectedLessonIds.includes(row.lessonId));
  if (!expectedLessonIds.length) return "NO_LESSONS";
  if (marks.some((row) => row.status === "LATE")) return "LATE";
  if (marks.some((row) => row.status === "PRESENT")) return "PRESENT";
  if (!absenceCanBeConfirmed || marks.length !== new Set(expectedLessonIds).size) return "UNKNOWN";
  if (marks.every((row) => row.status === "ABSENT")) return "ABSENT";
  if (marks.every((row) => row.status === "EXCUSED")) return "EXCUSED";
  return "UNKNOWN";
}
export function attendanceSchedule(publications: ReviewPublication[], date: string, timezone: string, activeDays: string[], now: Date) {
  const bounds = attendanceDateBounds(date, timezone);
  const cutoff = new Date(Math.min(bounds.end.getTime() - 1, now.getTime()));
  const eligible = publications.filter((pub) => pub.publishedAt <= cutoff && (!pub.archivedAt || pub.archivedAt > bounds.start));
  const publication = [...eligible].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())[0] ?? null;
  const weekday = attendanceWeekday(date);
  const operatingDay = activeDays.includes(weekday);
  const lessons = publication && operatingDay ? publication.lessons.filter((lesson) => lesson.day === weekday && publication.publishedAt <= attendanceClock(date, lesson.startTime, timezone)) : [];
  const ambiguous = eligible.length > 1 || Boolean(publication?.archivedAt && publication.archivedAt <= cutoff) || Boolean(publication && publication.publishedAt > bounds.start && publication.lessons.some((lesson) => lesson.day === weekday && publication.publishedAt > attendanceClock(date, lesson.startTime, timezone)));
  return { ...bounds, publication, lessons, operatingDay, ambiguous };
}
