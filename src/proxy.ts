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

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/features(.*)",
  "/pricing(.*)",
  "/waitlist(.*)",
  "/onboarding/accept(.*)",
  "/howItWorks(.*)",
  "/about(.*)",
  "/auth/callback",
]);

export default clerkMiddleware(async (auth, req) => {
  const { sessionClaims, userId } = await auth();
  // Edge-safe: JWT only. Full role resolution (Clerk API) runs on /auth/callback and RSC.
  const role = await resolveSessionRole(userId, sessionClaims, { jwtOnly: true });
  const pathname = req.nextUrl.pathname;

  if (isPublicRoute(req)) {
    if (isAuthCallbackPath(pathname)) {
      return NextResponse.next();
    }

    if (userId && role === "admin" && pathname.startsWith("/sign-in")) {
      return NextResponse.redirect(new URL(AUTH_CALLBACK_PATH, req.url));
    }

    if (userId && role && pathname.startsWith("/sign-in")) {
      return NextResponse.redirect(new URL(dashboardPathForRole(role), req.url));
    }

    if (
      userId &&
      !role &&
      pathname.startsWith("/sign-in") &&
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
