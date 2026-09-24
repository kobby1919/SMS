import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { routeAccessMap } from "./lib/settings";
import { NextResponse } from "next/server";
import { dashboardPathForRole } from "./lib/roles";
import { resolveSessionRole } from "./lib/roles.server";
import {
  AUTH_CALLBACK_PATH,
  SIGN_IN_PATH,
} from "./lib/auth/constants";
import { isAuthCallbackPath } from "./lib/auth/post-sign-in";

const matchers = Object.keys(routeAccessMap).map((route) => ({
  matcher: createRouteMatcher([route]),
  allowedRoles: routeAccessMap[route],
}));

const isInternalSecretRoute = createRouteMatcher([
  "/api/webhooks/payments(.*)",
  "/api/webhooks/notifications(.*)",
  "/api/internal/finance/jobs/run",
  "/api/internal/parent-summaries/run",
  "/api/internal/teacher-accountability/run",
]);

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/features(.*)",
  "/pricing(.*)",
  "/waitlist(.*)",
  "/onboarding/accept(.*)",
  "/onboarding/teacher/accept(.*)",
  "/onboarding/parent/accept(.*)",
  "/onboarding/bursar/accept(.*)",
  "/api/webhooks/payments(.*)",
  "/api/webhooks/notifications(.*)",
  "/api/internal/finance/jobs/run",
  "/api/internal/parent-summaries/run",
  "/api/internal/teacher-accountability/run",
  "/howItWorks(.*)",
  "/about(.*)",
  "/auth/callback",
]);

export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname;

  function authCallbackUrlWithInvite() {
    const callbackUrl = new URL(AUTH_CALLBACK_PATH, req.url);
    const schoolInvite = req.nextUrl.searchParams.get("invite");
    const teacherInvite = req.nextUrl.searchParams.get("teacherInvite");
    const parentInvite = req.nextUrl.searchParams.get("parentInvite");
    const bursarInvite = req.nextUrl.searchParams.get("bursarInvite");

    if (schoolInvite) callbackUrl.searchParams.set("invite", schoolInvite);
    if (teacherInvite) callbackUrl.searchParams.set("teacherInvite", teacherInvite);
    if (parentInvite) callbackUrl.searchParams.set("parentInvite", parentInvite);
    if (bursarInvite) callbackUrl.searchParams.set("bursarInvite", bursarInvite);

    return callbackUrl;
  }

  if (isInternalSecretRoute(req)) {
    return NextResponse.next();
  }

  const { sessionClaims, userId } = await auth();
  // Edge-safe: JWT only. Full role resolution (Clerk API) runs on /auth/callback and RSC.
  const role = await resolveSessionRole(userId, sessionClaims, { jwtOnly: true });

  if (isPublicRoute(req)) {
    if (isAuthCallbackPath(pathname)) {
      return NextResponse.next();
    }

    if (
      userId &&
      (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) &&
      (req.nextUrl.searchParams.has("invite") ||
        req.nextUrl.searchParams.has("teacherInvite") ||
        req.nextUrl.searchParams.has("parentInvite") ||
        req.nextUrl.searchParams.has("bursarInvite"))
    ) {
      return NextResponse.redirect(authCallbackUrlWithInvite());
    }

    if (userId && role === "admin" && (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up"))) {
      return NextResponse.redirect(new URL(AUTH_CALLBACK_PATH, req.url));
    }

    if (userId && role && (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up"))) {
      return NextResponse.redirect(new URL(dashboardPathForRole(role), req.url));
    }

    if (
      userId &&
      !role &&
      (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) &&
      !req.nextUrl.searchParams.has("error")
    ) {
      return NextResponse.redirect(new URL(AUTH_CALLBACK_PATH, req.url));
    }

    return NextResponse.next();
  }

  if (!userId) {
    return NextResponse.redirect(new URL(SIGN_IN_PATH, req.url));
  }

  if (!role) {
    return NextResponse.redirect(new URL(AUTH_CALLBACK_PATH, req.url));
  }

  const matchingRoute = matchers.find(({ matcher }) => matcher(req));
  if (matchingRoute) {
    const { allowedRoles } = matchingRoute;
    if (!allowedRoles.includes(role)) {
      return NextResponse.redirect(new URL(dashboardPathForRole(role), req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
