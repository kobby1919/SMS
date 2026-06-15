import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { dashboardPathForRole, type AppRole } from "@/src/lib/roles";
import { resolveSessionRole } from "@/src/lib/roles.server";
import {
  AUTH_CALLBACK_PATH,
  MISSING_ROLE_QUERY,
  SIGN_IN_PATH,
} from "@/src/lib/auth/constants";

/**
 * Completes sign-in on the server: resolve role (JWT + Clerk fallback) and redirect.
 * Used by /auth/callback only — middleware must not call Clerk on the edge.
 */
export async function completePostSignIn(): Promise<never> {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect(SIGN_IN_PATH);
  }

  const role = await resolveSessionRole(userId, sessionClaims);
  if (role) {
    redirect(dashboardPathForRole(role));
  }

  redirect(`${SIGN_IN_PATH}?error=${MISSING_ROLE_QUERY}`);
}

export function signInUrlWithMissingRole(): string {
  return `${SIGN_IN_PATH}?error=${MISSING_ROLE_QUERY}`;
}

export function isAuthCallbackPath(pathname: string): boolean {
  return pathname === AUTH_CALLBACK_PATH || pathname.startsWith(`${AUTH_CALLBACK_PATH}/`);
}

export function dashboardPathForResolvedRole(role: AppRole): string {
  return dashboardPathForRole(role);
}
