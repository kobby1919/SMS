import { clerkClient } from "@clerk/nextjs/server";
import { DEFAULT_SCHOOL_ID } from "@/src/lib/constants/tenant";
import prisma from "@/src/lib/prisma";
import {
  normalizeAppRole,
  roleFromSessionClaims,
  type AppRole,
} from "@/src/lib/roles";

const CLERK_LOOKUP_TIMEOUT_MS = 5_000;

async function getClerkUserWithTimeout(userId: string) {
  const client = await clerkClient();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      client.users.getUser(userId),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Clerk metadata lookup timed out.")),
          CLERK_LOOKUP_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function getBursarIdentityFromDatabase(userId: string): Promise<{
  role: AppRole;
  schoolId: string;
} | null> {
  const bursar = await prisma.bursar.findUnique({
    where: { id: userId },
    select: { schoolId: true, status: true },
  });

  if (!bursar || bursar.status !== "ACTIVE") {
    return null;
  }

  return { role: "bursar", schoolId: bursar.schoolId };
}

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
   * Middleware runs on the edge - avoid Clerk API calls there.
   * Without a JWT role, send the user to /auth/callback (Node) for full resolution.
   */
  jwtOnly?: boolean;
};

export async function resolveSessionIdentity(
  userId: string | null | undefined,
  sessionClaims: unknown,
): Promise<{ role?: AppRole; schoolId: string }> {
  const roleFromClaims = roleFromSessionClaims(sessionClaims);
  const schoolIdFromClaims = schoolIdFromSessionClaims(sessionClaims);

  if ((roleFromClaims && schoolIdFromClaims) || !userId) {
    return {
      role: roleFromClaims,
      schoolId: schoolIdFromClaims ?? DEFAULT_SCHOOL_ID,
    };
  }

  try {
    const user = await getClerkUserWithTimeout(userId);
    const metadataRole = normalizeAppRole(user.publicMetadata?.role);
    const metadataSchoolId = user.publicMetadata?.schoolId;
    const resolvedRole = roleFromClaims ?? metadataRole;
    const resolvedSchoolId =
      schoolIdFromClaims ??
      (typeof metadataSchoolId === "string" && metadataSchoolId.length > 0
        ? metadataSchoolId
        : undefined);

    if (resolvedRole) {
      return {
        role: resolvedRole,
        schoolId: resolvedSchoolId ?? DEFAULT_SCHOOL_ID,
      };
    }
  } catch {
    // Fall back to database identity checks below.
  }

  if (!roleFromClaims) {
    const bursarIdentity = await getBursarIdentityFromDatabase(userId);
    if (bursarIdentity) {
      return bursarIdentity;
    }
  }

  return {
    role: roleFromClaims,
    schoolId: schoolIdFromClaims ?? DEFAULT_SCHOOL_ID,
  };
}

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
    const user = await getClerkUserWithTimeout(userId);
    const metadataRole = normalizeAppRole(user.publicMetadata?.role);
    if (metadataRole) return metadataRole;
  } catch {
    // Fall back to database identity checks below.
  }

  const bursarIdentity = await getBursarIdentityFromDatabase(userId);
  return bursarIdentity?.role;
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
    const user = await getClerkUserWithTimeout(userId);
    const schoolId = user.publicMetadata?.schoolId;
    if (typeof schoolId === "string" && schoolId.length > 0) {
      return schoolId;
    }
  } catch {
    // fall through to database/default tenant
  }

  const bursarIdentity = await getBursarIdentityFromDatabase(userId);
  if (bursarIdentity) return bursarIdentity.schoolId;

  return DEFAULT_SCHOOL_ID;
}
