import { completePostSignIn } from "@/src/lib/auth/post-sign-in";

/** Post sign-in: resolve role from Clerk when JWT claims are not ready yet. */
export async function GET() {
  return completePostSignIn();
}
