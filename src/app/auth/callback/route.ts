import { completePostSignIn } from "@/src/lib/auth/post-sign-in";
import { NextRequest } from "next/server";
import { enforceRateLimit } from "@/src/lib/rate-limit";

/** Post sign-in: resolve role from Clerk when JWT claims are not ready yet. */
export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, {
    scope: "auth:callback",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;
  return completePostSignIn(req.nextUrl.searchParams.get("invite"));
}
