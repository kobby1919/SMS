import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { dashboardPathForRole, type AppRole } from "@/src/lib/roles";
import { resolveSessionRole, resolveSessionSchoolId } from "@/src/lib/roles.server";
import {
  acceptSchoolInviteForUser,
  getSchoolOnboardingState,
} from "@/src/lib/services/onboarding";
import {
  AUTH_CALLBACK_PATH,
  MISSING_ROLE_QUERY,
  SIGN_IN_PATH,
} from "@/src/lib/auth/constants";

/**
 * Completes sign-in on the server: resolve role (JWT + Clerk fallback) and redirect.
 * Used by /auth/callback only — middleware must not call Clerk on the edge.
 */
export async function completePostSignIn(inviteToken?: string | null): Promise<never> {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect(SIGN_IN_PATH);
  }

  if (inviteToken) {
    try {
      const inviteSession = await acceptSchoolInviteForUser({
        token: inviteToken,
        userId,
      });
      if (inviteSession.role === "admin") {
        redirect("/onboarding/setup");
      }
      redirect(dashboardPathForRole(inviteSession.role));
    } catch {
      redirect(`${SIGN_IN_PATH}?error=invalid_invite`);
    }
  }

  const role = await resolveSessionRole(userId, sessionClaims);
  if (role) {
    if (role === "admin") {
      const schoolId = await resolveSessionSchoolId(userId, sessionClaims);
      const school = await getSchoolOnboardingState(schoolId);
      if (school && school.onboardingStatus !== "COMPLETED") {
        redirect("/onboarding/setup");
      }
    }
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
