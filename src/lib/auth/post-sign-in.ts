import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { dashboardPathForRole, type AppRole } from "@/src/lib/roles";
import { resolveSessionIdentity } from "@/src/lib/roles.server";
import {
  acceptSchoolInviteForUser,
} from "@/src/lib/services/onboarding";
import {
  AUTH_CALLBACK_PATH,
  MISSING_ROLE_QUERY,
  SIGN_IN_PATH,
} from "@/src/lib/auth/constants";
import prisma from "@/src/lib/prisma";

const INVALID_INVITE_URL = `${SIGN_IN_PATH}?error=invalid_invite`;

async function schoolAwareDashboardPath(role: AppRole, schoolId: string): Promise<string> {
  if (role === "platform_admin") {
    return dashboardPathForRole(role);
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true,
      onboardingStatus: true,
    },
  });

  if (!school) {
    return `${SIGN_IN_PATH}?error=missing_school`;
  }

  if (role === "admin" && school.onboardingStatus !== "COMPLETED") {
    return "/onboarding/setup";
  }

  return dashboardPathForRole(role);
}

/**
 * Completes sign-in on the server: resolve role (JWT + Clerk fallback) and redirect.
 * Used by /auth/callback only - middleware must not call Clerk on the edge.
 */
export async function completePostSignIn(
  inviteToken?: string | null,
  teacherInviteToken?: string | null,
  parentInviteToken?: string | null,
  bursarInviteToken?: string | null,
): Promise<never> {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect(SIGN_IN_PATH);
  }

  const inviteCount = [
    inviteToken,
    teacherInviteToken,
    parentInviteToken,
    bursarInviteToken,
  ].filter(Boolean).length;

  if (inviteCount > 1) {
    redirect(INVALID_INVITE_URL);
  }

  if (inviteToken) {
    let redirectPath: string;
    try {
      const inviteSession = await acceptSchoolInviteForUser({
        token: inviteToken,
        userId,
      });
      redirectPath = await schoolAwareDashboardPath(inviteSession.role, inviteSession.schoolId);
    } catch {
      redirect(INVALID_INVITE_URL);
    }

    redirect(redirectPath);
  }

  if (teacherInviteToken) {
    redirect(`/onboarding/teacher/accept?token=${encodeURIComponent(teacherInviteToken)}`);
  }

  if (parentInviteToken) {
    redirect(`/onboarding/parent/accept?token=${encodeURIComponent(parentInviteToken)}`);
  }

  if (bursarInviteToken) {
    redirect(`/onboarding/bursar/accept?token=${encodeURIComponent(bursarInviteToken)}`);
  }

  const { role, schoolId } = await resolveSessionIdentity(userId, sessionClaims);
  if (role) {
    redirect(await schoolAwareDashboardPath(role, schoolId));
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
