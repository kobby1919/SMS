import { completePostSignIn } from "@/src/lib/auth/post-sign-in";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { createHash } from "crypto";
import { checkRateLimit, rateLimitKey } from "@/src/lib/rate-limit";
import {
  AUTH_BURSAR_INVITE_COOKIE,
  AUTH_PARENT_INVITE_COOKIE,
  AUTH_RATE_LIMITED_QUERY,
  AUTH_SCHOOL_INVITE_COOKIE,
  AUTH_TEACHER_INVITE_COOKIE,
  SIGN_IN_PATH,
} from "@/src/lib/auth/constants";

function shortHash(value: string) {
  return createHash("sha256").update(value).digest("base64url").slice(0, 32);
}

function callbackActorId(req: NextRequest, userId: string | null, sessionId: string | null) {
  if (userId) return `user:${userId}`;
  if (sessionId) return `session:${sessionId}`;

  const clerkSession = req.cookies.get("__session")?.value;
  if (clerkSession) return `clerk-session:${shortHash(clerkSession)}`;

  const clientHint = [
    req.cookies.get("__client_uat")?.value,
    req.headers.get("user-agent"),
    req.headers.get("x-forwarded-for"),
    req.headers.get("x-real-ip"),
    req.headers.get("cf-connecting-ip"),
  ]
    .filter(Boolean)
    .join("|");

  return clientHint ? `client:${shortHash(clientHint)}` : undefined;
}

function redirectToFriendlyThrottle(req: NextRequest, resetAt: number) {
  const retryAfter = Math.max(Math.ceil((resetAt - Date.now()) / 1000), 1);
  const url = new URL(SIGN_IN_PATH, req.url);
  url.searchParams.set("error", AUTH_RATE_LIMITED_QUERY);
  url.searchParams.set("retryAfter", String(retryAfter));
  return NextResponse.redirect(url);
}

/** Post sign-in: resolve role from Clerk when JWT claims are not ready yet. */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const { userId, sessionId } = await auth();
  const hasInviteContext = Boolean(
    req.nextUrl.searchParams.get("invite") ||
      req.nextUrl.searchParams.get("teacherInvite") ||
      req.nextUrl.searchParams.get("parentInvite") ||
      req.nextUrl.searchParams.get("bursarInvite") ||
      cookieStore.get(AUTH_SCHOOL_INVITE_COOKIE)?.value ||
      cookieStore.get(AUTH_TEACHER_INVITE_COOKIE)?.value ||
      cookieStore.get(AUTH_PARENT_INVITE_COOKIE)?.value ||
      cookieStore.get(AUTH_BURSAR_INVITE_COOKIE)?.value,
  );

  const limitResult = await checkRateLimit({
    key: rateLimitKey(
      req,
      hasInviteContext ? "auth:callback:invite" : "auth:callback",
      callbackActorId(req, userId, sessionId),
    ),
    limit: hasInviteContext ? 300 : 180,
    windowMs: 60_000,
  });
  if (!limitResult.allowed) return redirectToFriendlyThrottle(req, limitResult.resetAt);

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
  const bursarInviteToken =
    req.nextUrl.searchParams.get("bursarInvite") ??
    cookieStore.get(AUTH_BURSAR_INVITE_COOKIE)?.value ??
    null;

  if (inviteToken) cookieStore.delete(AUTH_SCHOOL_INVITE_COOKIE);
  if (teacherInviteToken) cookieStore.delete(AUTH_TEACHER_INVITE_COOKIE);
  if (parentInviteToken) cookieStore.delete(AUTH_PARENT_INVITE_COOKIE);
  if (bursarInviteToken) cookieStore.delete(AUTH_BURSAR_INVITE_COOKIE);

  return completePostSignIn(
    inviteToken,
    teacherInviteToken,
    parentInviteToken,
    bursarInviteToken,
  );
}
