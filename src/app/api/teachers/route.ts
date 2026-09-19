import { NextRequest, NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { enforceRateLimit } from "@/src/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireRole(["admin"]);
    const limited = await enforceRateLimit(req, {
      scope: "users:create-teacher",
      actorId: userId,
      limit: 20,
      windowMs: 10 * 60_000,
    });
    if (limited) return limited;

    return NextResponse.json(
      {
        error:
          "Direct teacher creation is disabled. Invite teachers from the Teachers page so Edujay can verify the email, link the Clerk account, and keep the onboarding audit trail.",
      },
      { status: 410 },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AuthorizationError") {
      return unauthorizedResponse(error);
    }
    console.error("[api/teachers] create failed", error);
    return NextResponse.json({ error: "Failed to create teacher." }, { status: 500 });
  }
}
