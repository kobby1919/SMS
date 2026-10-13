export type ExamEvidence = { examScore: number; examRecordedAt?: Date | string | null };

export function validAssessmentWeights(config: { classworkWeight: number; examWeight: number } | null | undefined) {
  return Boolean(config && Number.isFinite(config.classworkWeight) && Number.isFinite(config.examWeight) && config.classworkWeight >= 0 && config.examWeight >= 0 && config.classworkWeight <= 100 && config.examWeight <= 100 && Math.abs(config.classworkWeight + config.examWeight - 100) < 0.005);
}

export function hasRecordedExam(record: ExamEvidence | null | undefined): boolean {
  if (!record || !Number.isFinite(record.examScore) || record.examScore < 0) return false;
  if (record.examRecordedAt != null && !Number.isFinite(new Date(record.examRecordedAt).getTime())) return false;
  // Positive legacy marks are evidence; a default zero never is.
  return record.examScore > 0 || Boolean(record.examRecordedAt && Number.isFinite(new Date(record.examRecordedAt).getTime()));
}

export function examEvidenceState(record: ExamEvidence | null | undefined, maximum: number) {
  if (!Number.isFinite(maximum) || maximum < 0 || maximum > 100) return "INVALID";
  if (maximum === 0) return "NOT_REQUIRED";
  if (!record) return "MISSING";
  if (!Number.isFinite(record.examScore) || record.examScore < 0 || record.examScore > maximum ||
    record.examRecordedAt != null && !Number.isFinite(new Date(record.examRecordedAt).getTime())) return "INVALID";
  return hasRecordedExam(record) ? "RECORDED" : "MISSING";
}

export function examEntryState(examWeight: number, window: { status: string; openedAt?: Date | null; closedAt?: Date | null } | null) {
  if (examWeight === 0) return "NOT_REQUIRED";
  if (!Number.isFinite(examWeight) || examWeight < 0 || examWeight > 100) return "NEEDS_REVIEW";
  if (!window) return "NOT_CONFIGURED";
  if (!["OPEN", "CLOSED", "LOCKED"].includes(window.status) || window.openedAt && !Number.isFinite(new Date(window.openedAt).getTime())) return "NEEDS_REVIEW";
  if (window.closedAt && (!Number.isFinite(new Date(window.closedAt).getTime()) || window.openedAt && window.closedAt < window.openedAt)) return "NEEDS_REVIEW";
  if (window.status === "LOCKED") return window.openedAt || window.closedAt ? "NEEDS_REVIEW" : "NOT_OPENED";
  if (window.status === "OPEN") return window.openedAt && !window.closedAt ? "OPEN" : "NEEDS_REVIEW";
  return window.openedAt ? "CLOSED" : "NOT_OPENED";
}

export function activityEligibility(student: { createdAt: Date; classJoinedAt?: Date | null }, activityDate: Date) {
  const joined = student.classJoinedAt;
  if (!joined || !Number.isFinite(joined.getTime()) || !Number.isFinite(student.createdAt.getTime()) || !Number.isFinite(activityDate.getTime())) return "PLACEMENT_UNKNOWN";
  const joinedAt = Math.max(joined.getTime(), student.createdAt.getTime());
  // Do not assign earlier activities, including those earlier on admission day.
  return joinedAt <= activityDate.getTime() ? "ELIGIBLE" : "NOT_YET_JOINED";
}

export function caRecordingDeadline(activityDate: Date, schoolDays: number, closeoutTime: string,
  options: { timezone?: string; activeDays?: readonly string[] } = {}) {
  if (!Number.isInteger(schoolDays) || schoolDays < 0 || schoolDays > 365 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(closeoutTime)) throw new Error("CA deadline configuration is invalid.");
  const timezone = options.timezone ?? "Africa/Accra";
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const parts = (date: Date) => Object.fromEntries(formatter.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]));
  const p = parts(activityDate);
  const calendar = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const activeDays = options.activeDays?.length ? options.activeDays : dayNames.slice(1, 6);
  if (!activeDays.every((d) => dayNames.includes(d))) throw new Error("CA deadlines require valid school operating days.");
  let remaining = schoolDays;
  while (remaining > 0) {
    calendar.setUTCDate(calendar.getUTCDate() + 1);
    if (activeDays.includes(dayNames[calendar.getUTCDay()])) remaining--;
  }
  const [hours, minutes] = closeoutTime.split(":").map(Number);
  const desired = Date.UTC(calendar.getUTCFullYear(), calendar.getUTCMonth(), calendar.getUTCDate(), hours, minutes);
  let candidate = desired;
  for (let attempt = 0; attempt < 4; attempt++) {
    const local = parts(new Date(candidate));
    const difference = desired - Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
    if (difference === 0) return new Date(candidate);
    candidate += difference;
  }
  throw new Error("CA closeout time is not valid in the school timezone.");
}
