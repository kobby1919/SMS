import { completePostSignIn } from "@/src/lib/auth/post-sign-in";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { enforceRateLimit } from "@/src/lib/rate-limit";
import { AUTH_PARENT_INVITE_COOKIE, AUTH_SCHOOL_INVITE_COOKIE, AUTH_TEACHER_INVITE_COOKIE } from "@/src/lib/auth/constants";

/** Post sign-in: resolve role from Clerk when JWT claims are not ready yet. */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const { userId, sessionId } = await auth();
  const hasInviteContext = Boolean(
    req.nextUrl.searchParams.get("invite") ||
      req.nextUrl.searchParams.get("teacherInvite") ||
      req.nextUrl.searchParams.get("parentInvite") ||
      cookieStore.get(AUTH_SCHOOL_INVITE_COOKIE)?.value ||
      cookieStore.get(AUTH_TEACHER_INVITE_COOKIE)?.value ||
      cookieStore.get(AUTH_PARENT_INVITE_COOKIE)?.value,
  );
  const limited = await enforceRateLimit(req, {
    scope: hasInviteContext ? "auth:callback:invite" : "auth:callback",
    limit: hasInviteContext ? 40 : 20,
    windowMs: 60_000,
    actorId: userId ?? sessionId ?? undefined,
  });
  if (limited) return limited;
  const inviteToken =
    req.nextUrl.searchParams.get("invite") ??
    cookieStore.get(AUTH_SCHOOL_INVITE_COOKIE)?.value ??
    null;
  const teacherInviteToken =
    req.nextUrl.searchParams.get("teacherInvite") ??
    cookieStore.get(AUTH_TEACHER_INVITE_COOKIE)?.value ??
    null;
  const parentInviteToken =
    req.nextUrl.searchParams.get("parentInvite") ??
    cookieStore.get(AUTH_PARENT_INVITE_COOKIE)?.value ??
    null;

  if (inviteToken) cookieStore.delete(AUTH_SCHOOL_INVITE_COOKIE);
  if (teacherInviteToken) cookieStore.delete(AUTH_TEACHER_INVITE_COOKIE);
  if (parentInviteToken) cookieStore.delete(AUTH_PARENT_INVITE_COOKIE);

  return completePostSignIn(inviteToken, teacherInviteToken, parentInviteToken);
}
