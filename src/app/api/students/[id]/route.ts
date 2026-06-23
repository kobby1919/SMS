import { NextRequest, NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { parseBody } from "@/src/lib/validation/parse";
import { studentUpdateSchema } from "@/src/lib/validation/users";
import { enforceRateLimit } from "@/src/lib/rate-limit";
import {
  updateStudent,
  UserManagementError,
} from "@/src/lib/services/user-management";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, schoolId } = await requireRole(["admin"]);
    const limited = await enforceRateLimit(req, {
      scope: "users:update-student",
      actorId: userId,
      limit: 60,
      windowMs: 10 * 60_000,
    });
    if (limited) return limited;

    const { id } = await params;
    const formData = await req.formData();
    const parsed = parseBody(studentUpdateSchema, {
      name: formData.get("name"),
      surname: formData.get("surname"),
      phone: formData.get("phone"),
      address: formData.get("address"),
      bloodType: formData.get("bloodType"),
      sex: formData.get("sex"),
      classId: formData.get("classId"),
      parentId: formData.get("parentId"),
    });
    if (!parsed.ok) return parsed.response;
    return NextResponse.json(await updateStudent(schoolId, id, parsed.data));
  } catch (error) {
    if (error instanceof UserManagementError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.name === "AuthorizationError") {
      return unauthorizedResponse(error);
    }
    console.error("[api/students/:id] update failed", error);
    return NextResponse.json({ error: "Failed to update student." }, { status: 500 });
  }
}
