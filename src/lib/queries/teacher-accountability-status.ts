import type {
  TeacherObligationPriority,
  TeacherObligationStatus,
} from "@/src/generated/prisma";

export type AccountabilityMetadata = {
  missedAt?: string;
};

function readMetadata(metadata: unknown): AccountabilityMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as AccountabilityMetadata;
}

function parseMetadataDate(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function effectiveObligationStatus(
  obligation: {
    status: TeacherObligationStatus;
    expectedAt: Date;
    completedAt: Date | null;
    metadata: unknown;
  },
  now: Date,
): TeacherObligationStatus {
  if (
    obligation.status === "COMPLETED" ||
    obligation.status === "COMPLETED_LATE" ||
    obligation.status === "ESCALATED" ||
    obligation.status === "CANCELLED"
  ) {
    return obligation.status;
  }

  if (obligation.completedAt) {
    return obligation.completedAt > obligation.expectedAt
      ? "COMPLETED_LATE"
      : "COMPLETED";
  }

  const missedAt =
    parseMetadataDate(readMetadata(obligation.metadata).missedAt) ??
    obligation.expectedAt;

  return missedAt <= now ? "MISSED" : obligation.status;
}

export function effectiveObligationPriority(
  status: TeacherObligationStatus,
  priority: TeacherObligationPriority,
): TeacherObligationPriority {
  if (status === "ESCALATED") return "HIGH";
  if (status === "MISSED") return priority === "CRITICAL" ? "CRITICAL" : "HIGH";
  return priority;
}

export function isAccountabilityIssue(status: TeacherObligationStatus) {
  return (
    status === "COMPLETED_LATE" ||
    status === "MISSED" ||
    status === "ESCALATED"
  );
}
