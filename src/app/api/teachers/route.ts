import { NextRequest, NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { parseBody } from "@/src/lib/validation/parse";
import { teacherCreateSchema } from "@/src/lib/validation/users";
import {
  createTeacher,
  UserManagementError,
} from "@/src/lib/services/user-management";
import { enforceRateLimit } from "@/src/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin"]);
    const limited = await enforceRateLimit(req, {
      scope: "users:create-teacher",
      actorId: userId,
      limit: 20,
      windowMs: 10 * 60_000,
    });
    if (limited) return limited;
    const formData = await req.formData();
    const parsedSubjectIds = parseSubjectIds(formData.get("subjectIds"));
    if (!parsedSubjectIds.ok) return parsedSubjectIds.response;

    const parsed = parseBody(teacherCreateSchema, {
      username: formData.get("username"),
      email: formData.get("email"),
      password: formData.get("password"),
      name: formData.get("name"),
      surname: formData.get("surname"),
      phone: formData.get("phone") || null,
      address: formData.get("address"),
      bloodType: formData.get("bloodType"),
      sex: formData.get("sex"),
      subjectIds: parsedSubjectIds.data,
    });
    if (!parsed.ok) return parsed.response;

    return NextResponse.json(await createTeacher(schoolId, parsed.data), {
      status: 201,
    });
  } catch (error) {
    if (error instanceof UserManagementError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.name === "AuthorizationError") {
      return unauthorizedResponse(error);
    }
    console.error("[api/teachers] create failed", error);
    return NextResponse.json({ error: "Failed to create teacher." }, { status: 500 });
  }
}

function parseSubjectIds(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length === 0) {
    return { ok: true as const, data: [] };
  }
  try {
    return { ok: true as const, data: JSON.parse(value) };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: "Validation failed",
          issues: { subjectIds: ["Invalid subject list."] },
        },
        { status: 400 },
      ),
    };
  }
}
