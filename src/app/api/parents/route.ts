import { NextRequest, NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { parseBody } from "@/src/lib/validation/parse";
import { parentCreateSchema } from "@/src/lib/validation/users";
import {
  createParent,
  listParents,
  UserManagementError,
} from "@/src/lib/services/user-management";
import { enforceRateLimit } from "@/src/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin"]);
    const limited = await enforceRateLimit(req, {
      scope: "users:create-parent",
      actorId: userId,
      limit: 30,
      windowMs: 10 * 60_000,
    });
    if (limited) return limited;
    const parsed = parseBody(parentCreateSchema, await req.json());
    if (!parsed.ok) return parsed.response;
    return NextResponse.json(await createParent(schoolId, parsed.data), {
      status: 201,
    });
  } catch (error) {
    if (error instanceof UserManagementError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return unauthorizedResponse(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin"]);
    const limited = await enforceRateLimit(req, {
      scope: "users:list-parents",
      actorId: userId,
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;
    return NextResponse.json(await listParents(schoolId));
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
