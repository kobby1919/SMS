import prisma from "@/src/lib/prisma";

const DEFAULT_SCHOOL_HOURS = {
  timezone: "Africa/Accra",
  openingTime: "07:30",
  closingTime: "15:00",
  activeDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
};

function timeToMinutes(value: string) {
  const [hour = 0, minute = 0] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function localTimeInMinutes(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone || DEFAULT_SCHOOL_HOURS.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function localDayName(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: timezone || DEFAULT_SCHOOL_HOURS.timezone,
  }).format(date).toUpperCase();
}

function readableDay(day: string) {
  return day.charAt(0) + day.slice(1).toLowerCase();
}

function dayRangeLabel(days: string[]) {
  const normalized = days.length > 0 ? days : DEFAULT_SCHOOL_HOURS.activeDays;
  if (
    normalized.length === 5 &&
    normalized[0] === "MONDAY" &&
    normalized[4] === "FRIDAY"
  ) {
    return "Monday to Friday";
  }

  return normalized.map(readableDay).join(", ");
}

async function getOrCreateSchoolOperatingSettings(schoolId: string) {
  return prisma.schoolNotificationSetting.upsert({
    where: { schoolId },
    create: {
      schoolId,
      ...DEFAULT_SCHOOL_HOURS,
    },
    update: {},
  });
}

export async function getSchoolOperatingWindowStatus(schoolId: string, now = new Date()) {
  const settings = await getOrCreateSchoolOperatingSettings(schoolId);
  const timezone = settings.timezone || DEFAULT_SCHOOL_HOURS.timezone;
  const openingTime = settings.openingTime || DEFAULT_SCHOOL_HOURS.openingTime;
  const closingTime = settings.closingTime || DEFAULT_SCHOOL_HOURS.closingTime;
  const activeDays = settings.activeDays.length > 0 ? settings.activeDays : DEFAULT_SCHOOL_HOURS.activeDays;
  const localDay = localDayName(now, timezone);
  const currentMinutes = localTimeInMinutes(now, timezone);
  const openingMinutes = timeToMinutes(openingTime);
  const closingMinutes = timeToMinutes(closingTime);
  const schoolDayAllowed = activeDays.includes(localDay);
  const timeAllowed =
    openingMinutes <= closingMinutes
      ? currentMinutes >= openingMinutes && currentMinutes <= closingMinutes
      : currentMinutes >= openingMinutes || currentMinutes <= closingMinutes;
  const label = `${dayRangeLabel(activeDays)}, ${openingTime}-${closingTime}`;

  if (!schoolDayAllowed) {
    return {
      allowed: false,
      label,
      timezone,
      openingTime,
      closingTime,
      activeDays,
      currentDay: localDay,
      isActiveDay: false,
      isWithinSchoolHours: false,
      reason: `This action is only allowed on school days (${dayRangeLabel(activeDays)}).`,
    };
  }

  if (!timeAllowed) {
    return {
      allowed: false,
      label,
      timezone,
      openingTime,
      closingTime,
      activeDays,
      currentDay: localDay,
      isActiveDay: true,
      isWithinSchoolHours: false,
      reason: `This action is only allowed during school hours (${openingTime}-${closingTime}, ${timezone}).`,
    };
  }

  return {
    allowed: true,
    label,
    timezone,
    openingTime,
    closingTime,
    activeDays,
    currentDay: localDay,
    isActiveDay: true,
    isWithinSchoolHours: true,
    reason: null,
  };
}

export async function assertWithinSchoolOperatingHours(schoolId: string, actionLabel = "This action") {
  const status = await getSchoolOperatingWindowStatus(schoolId);
  if (!status.allowed) {
    throw new Error(`${actionLabel} is locked outside school hours. ${status.reason}`);
  }
  return status;
}
