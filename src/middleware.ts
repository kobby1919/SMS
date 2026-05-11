// src/middleware.ts



import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { routeAccessMap } from "./lib/settings";
import { NextResponse } from "next/server";

const matchers = Object.keys(routeAccessMap).map((route) => ({
  matcher:      createRouteMatcher([route]),
  allowedRoles: routeAccessMap[route],
}));

export default clerkMiddleware(async (auth, req) => {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;

  const matchingRoute = matchers.find(({ matcher }) => matcher(req));

  if (matchingRoute) {
    const { allowedRoles } = matchingRoute;

    if (!role || !allowedRoles.includes(role)) {
      // Redirect to their own dashboard, or sign-in if not logged in
      const destination = role ?? "sign-in";
      const redirectUrl = new URL(`/${destination}`, req.url);
      return NextResponse.redirect(redirectUrl);
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