import { Prisma } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";

type AuditMetadata = Record<string, unknown>;

function asMetadata(value: Prisma.JsonValue): AuditMetadata {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as AuditMetadata) }
    : {};
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function markMigrationBatchProblematic({
  schoolId,
  actorId,
  auditLogId,
  note,
}: {
  schoolId: string;
  actorId: string;
  auditLogId: number;
  note: string;
}) {
  const auditLog = await prisma.onboardingAuditLog.findFirst({
    where: { id: auditLogId, schoolId, action: "IMPORT_RECORDED" },
    select: { id: true, metadata: true },
  });

  if (!auditLog) {
    throw new Error("Import audit record was not found for this school.");
  }

  const metadata = asMetadata(auditLog.metadata);

  if (metadata.problematic === true) {
    return { id: auditLog.id, alreadyMarked: true };
  }

  await prisma.onboardingAuditLog.update({
    where: { id: auditLog.id },
    data: {
      metadata: {
        ...metadata,
        status: "PROBLEMATIC",
        problematic: true,
        problemNote: note.trim() || "Marked for review by admin.",
        markedProblematicAt: new Date().toISOString(),
        markedProblematicBy: actorId,
      } satisfies Prisma.InputJsonValue,
    },
  });

  return { id: auditLog.id, alreadyMarked: false };
}

export async function buildMigrationErrorReportCsv({
  schoolId,
  auditLogId,
}: {
  schoolId: string;
  auditLogId: number;
}) {
  const auditLog = await prisma.onboardingAuditLog.findFirst({
    where: { id: auditLogId, schoolId, action: "IMPORT_RECORDED" },
    select: { metadata: true, createdAt: true, performedBy: true },
  });

  if (!auditLog) {
    throw new Error("Import audit record was not found for this school.");
  }

  const metadata = asMetadata(auditLog.metadata);
  const errors = Array.isArray(metadata.errors) ? metadata.errors : [];
  const rows = [
    ["batchId", "fileName", "importType", "importedAt", "performedBy", "rowNumber", "status", "severity", "field", "message"],
    ...errors.map((entry) => {
      const error = entry && typeof entry === "object" ? (entry as AuditMetadata) : {};
      return [
        metadata.batchId,
        metadata.fileName,
        metadata.importType,
        auditLog.createdAt.toISOString(),
        auditLog.performedBy,
        error.rowNumber,
        error.status,
        error.severity,
        error.field,
        error.message,
      ];
    }),
  ];

  if (errors.length === 0) {
    rows.push([
      metadata.batchId,
      metadata.fileName,
      metadata.importType,
      auditLog.createdAt.toISOString(),
      auditLog.performedBy,
      "",
      "CLEAN",
      "INFO",
      "",
      "No skipped or correction rows were recorded for this import batch.",
    ]);
  }

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}
