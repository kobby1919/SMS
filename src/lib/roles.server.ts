import { clerkClient } from "@clerk/nextjs/server";
import { DEFAULT_SCHOOL_ID } from "@/src/lib/constants/tenant";
import {
  normalizeAppRole,
  roleFromSessionClaims,
  type AppRole,
} from "@/src/lib/roles";

function schoolIdFromSessionClaims(sessionClaims: unknown): string | undefined {
  if (!sessionClaims || typeof sessionClaims !== "object") return undefined;

  const claims = sessionClaims as Record<string, unknown>;
  const metadata = claims.metadata as Record<string, unknown> | undefined;
  const publicMetadata = claims.publicMetadata as Record<string, unknown> | undefined;
  const public_metadata = claims.public_metadata as Record<string, unknown> | undefined;
  const privateMetadata = claims.privateMetadata as Record<string, unknown> | undefined;
  const private_metadata = claims.private_metadata as Record<string, unknown> | undefined;
  const unsafeMetadata = claims.unsafeMetadata as Record<string, unknown> | undefined;
  const unsafe_metadata = claims.unsafe_metadata as Record<string, unknown> | undefined;

  const schoolId =
    claims.schoolId ??
    claims.school_id ??
    metadata?.schoolId ??
    metadata?.school_id ??
    publicMetadata?.schoolId ??
    publicMetadata?.school_id ??
    public_metadata?.schoolId ??
    public_metadata?.school_id ??
    privateMetadata?.schoolId ??
    private_metadata?.schoolId ??
    unsafeMetadata?.schoolId ??
    unsafe_metadata?.schoolId;

  return typeof schoolId === "string" && schoolId.length > 0
    ? schoolId
    : undefined;
}

export type ResolveSessionRoleOptions = {
  /**
   * Middleware runs on the edge — avoid Clerk API calls there.
   * Without a JWT role, send the user to /auth/callback (Node) for full resolution.
   */
  jwtOnly?: boolean;
};

/** Resolve role from JWT, falling back to Clerk publicMetadata when claims lag after sign-in. */
export async function resolveSessionRole(
  userId: string | null | undefined,
  sessionClaims: unknown,
  options?: ResolveSessionRoleOptions,
): Promise<AppRole | undefined> {
  const fromClaims = roleFromSessionClaims(sessionClaims);
  if (fromClaims) return fromClaims;

  if (options?.jwtOnly || !userId) return undefined;

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return normalizeAppRole(user.publicMetadata?.role);
  } catch {
    return undefined;
  }
}

/** Resolve school tenant id from JWT, falling back to Clerk publicMetadata. */
export async function resolveSessionSchoolId(
  userId: string | null | undefined,
  sessionClaims: unknown,
): Promise<string> {
  const fromClaims = schoolIdFromSessionClaims(sessionClaims);
  if (fromClaims) return fromClaims;

  if (!userId) return DEFAULT_SCHOOL_ID;

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const schoolId = user.publicMetadata?.schoolId;
    if (typeof schoolId === "string" && schoolId.length > 0) {
      return schoolId;
    }
  } catch {
    // fall through to default tenant
  }

  return DEFAULT_SCHOOL_ID;
}
