import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { routeAccessMap } from "./lib/settings";
import { NextResponse } from "next/server";

const matchers = Object.keys(routeAccessMap).map((route) => ({
  matcher: createRouteMatcher([route]),
  allowedRoles: routeAccessMap[route],
}));


// src/middleware.ts
export default clerkMiddleware(async (auth, req) => {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  

  // Find ALL matching routes for the current path
  const matchingRoute = matchers.find(({ matcher }) => matcher(req));

  if (matchingRoute) {
    const { allowedRoles } = matchingRoute;
    
    // If user role is NOT in the allowed list for this specific match
    if (!role || !allowedRoles.includes(role)) {
      const redirectUrl = new URL(`/${role || "sign-in"}`, req.url);
      return NextResponse.redirect(redirectUrl);
    }
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
