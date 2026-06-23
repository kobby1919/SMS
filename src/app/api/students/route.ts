import { NextRequest, NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { parseBody } from "@/src/lib/validation/parse";
import { studentCreateSchema } from "@/src/lib/validation/users";
import {
  createStudent,
  UserManagementError,
} from "@/src/lib/services/user-management";
import { enforceRateLimit } from "@/src/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin"]);
    const limited = await enforceRateLimit(req, {
      scope: "users:create-student",
      actorId: userId,
      limit: 40,
      windowMs: 10 * 60_000,
    });
    if (limited) return limited;
    const formData = await req.formData();
    const parsed = parseBody(studentCreateSchema, {
      username: formData.get("username"),
      email: formData.get("email") || "",
      password: formData.get("password"),
      name: formData.get("name"),
      surname: formData.get("surname"),
      phone: formData.get("phone") || null,
      address: formData.get("address"),
      bloodType: formData.get("bloodType"),
      sex: formData.get("sex"),
      classId: formData.get("classId"),
      parentId: formData.get("parentId"),
    });
    if (!parsed.ok) return parsed.response;

    return NextResponse.json(await createStudent(schoolId, parsed.data), {
      status: 201,
    });
  } catch (error) {
    if (error instanceof UserManagementError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.name === "AuthorizationError") {
      return unauthorizedResponse(error);
    }
    console.error("[api/students] create failed", error);
    return NextResponse.json({ error: "Failed to create student." }, { status: 500 });
  }
}
