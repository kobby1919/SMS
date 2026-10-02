import { z } from "zod";

import { MIGRATION_AREAS } from "@/src/lib/migration/column-mapping";

const migrationAreaKeys = MIGRATION_AREAS.map((area) => area.key) as [
  (typeof MIGRATION_AREAS)[number]["key"],
  ...(typeof MIGRATION_AREAS)[number]["key"][],
];

export const migrationValidationPayloadSchema = z.object({
  areaKey: z.enum(migrationAreaKeys),
  headers: z.array(z.string().max(200)).min(1).max(120),
  mapping: z.record(z.string().max(80), z.string().max(200)).default({}),
  rows: z
    .array(z.array(z.string().max(2_000)).max(120))
    .min(1)
    .max(2_000),
});

export type MigrationValidationPayload = z.infer<typeof migrationValidationPayloadSchema>;
