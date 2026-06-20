import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { AUTH_CALLBACK_PATH, SIGN_IN_PATH } from "@/src/lib/auth/constants";
import { dashboardPathForRole, isAppRole, type AppRole } from "@/src/lib/roles";
import { resolveSessionIdentity } from "@/src/lib/roles.server";

import { DEFAULT_SCHOOL_ID } from "@/src/lib/constants/tenant";

export type { AppRole };
export { DEFAULT_SCHOOL_ID };

export type AuthzContext = {
  userId: string;
  role: AppRole;
  schoolId: string;
};

export class AuthorizationError extends Error {
  status: 401 | 403;

  constructor(message: string, status: 401 | 403 = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

/** Resolve tenant school id from Clerk session (for server components/pages). */
export function resolveSchoolId(sessionClaims: unknown): string {
  const claims = sessionClaims as {
    metadata?: { schoolId?: string };
    publicMetadata?: { schoolId?: string };
    public_metadata?: { schoolId?: string };
  } | null | undefined;

  return (
    claims?.metadata?.schoolId ??
    claims?.publicMetadata?.schoolId ??
    claims?.public_metadata?.schoolId ??
    DEFAULT_SCHOOL_ID
  );
}

export async function getAuthzContext(): Promise<AuthzContext | null> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;

  const { role, schoolId } = await resolveSessionIdentity(userId, sessionClaims);

  if (!role) return null;

  return { userId, role, schoolId };
}

/** Server pages: same identity + tenant resolution as middleware and server actions. */
export async function resolvePageSession(): Promise<AuthzContext | null> {
  return getAuthzContext();
}

/** Server pages: require sign-in; optionally restrict to roles (redirects on failure). */
export async function requirePageSession(
  allowedRoles?: AppRole[],
): Promise<AuthzContext> {
  const { userId } = await auth();

  if (!userId) {
    redirect(SIGN_IN_PATH);
  }

  const session = await resolvePageSession();

  if (!session) {
    redirect(AUTH_CALLBACK_PATH);
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    redirect(dashboardPathForRole(session.role));
  }

  return session;
}

export async function requireRole(allowedRoles: AppRole[]): Promise<AuthzContext> {
  const context = await getAuthzContext();

  if (!context) {
    throw new AuthorizationError("You must be signed in to perform this action.", 401);
  }

  if (!allowedRoles.includes(context.role)) {
    throw new AuthorizationError("You are not allowed to perform this action.", 403);
  }

  return context;
}

/** Finance routes: admin or bursar only. */
export async function requireFinanceAccess(): Promise<AuthzContext> {
  return requireRole(["admin", "bursar"]);
}

/** Verify a record belongs to the caller's school before mutating it. */
export function requireResourceAccess<T extends { schoolId: string }>(
  record: T | null | undefined,
  context: AuthzContext,
  message = "Resource not found or access denied.",
): T {
  if (!record || record.schoolId !== context.schoolId) {
    throw new AuthorizationError(message, 403);
  }
  return record;
}

export function unauthorizedResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export { isAppRole };
