import { z } from "zod";
import { migrationValidationPayloadSchema } from "@/src/lib/validation/data-migration";

export const stageUploadSchema = z.object({
  areaKey: migrationValidationPayloadSchema.shape.areaKey,
  fileName: z.string().trim().min(1).max(255).regex(/^[^\\/\u0000-\u001f]+\.csv$/i, "Choose a CSV filename without path characters."),
  csv: z.string().min(1).max(1000000),
  mapping: migrationValidationPayloadSchema.shape.mapping,
}).strict();
export const stagedUploadIdSchema = z.string().uuid();
export const stagedImportSchema = z.object({ uploadId: stagedUploadIdSchema }).strict();

export class MigrationStagingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
