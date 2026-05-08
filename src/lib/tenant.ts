import { AuthorizationError } from "@/src/lib/authz";

export type SchoolScoped = { schoolId: string };

/** Merge tenant filter into an existing Prisma where clause. */
export function withSchool<T extends Record<string, unknown>>(
  where: T,
  schoolId: string,
): T & { schoolId: string } {
  return { ...where, schoolId };
}

/** Ensure a loaded record belongs to the active school (throws 403 if not). */
export function assertSameSchool(
  record: SchoolScoped | null | undefined,
  schoolId: string,
  message = "Resource not found or access denied.",
): asserts record is SchoolScoped {
  if (!record || record.schoolId !== schoolId) {
    throw new AuthorizationError(message, 403);
  }
}
