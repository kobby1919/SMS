import { NextRequest, NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { parseBody } from "@/src/lib/validation/parse";
import { parentUpdateSchema } from "@/src/lib/validation/users";
import { enforceRateLimit } from "@/src/lib/rate-limit";
import {
  updateParent,
  UserManagementError,
} from "@/src/lib/services/user-management";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, schoolId } = await requireRole(["admin"]);
    const limited = await enforceRateLimit(req, {
      scope: "users:update-parent",
      actorId: userId,
      limit: 40,
      windowMs: 10 * 60_000,
    });
    if (limited) return limited;

    const { id } = await params;
    const parsed = parseBody(parentUpdateSchema, await req.json());
    if (!parsed.ok) return parsed.response;
    return NextResponse.json(await updateParent(schoolId, id, parsed.data));
  } catch (error) {
    if (error instanceof UserManagementError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return unauthorizedResponse(error);
  }
}
