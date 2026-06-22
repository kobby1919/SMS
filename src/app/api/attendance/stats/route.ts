import { NextRequest, NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { attendanceStatsQuerySchema } from "@/src/lib/validation/attendance";
import { parseSearchParams } from "@/src/lib/validation/parse";
import { enforceRateLimit } from "@/src/lib/rate-limit";
import {
  getClassAttendanceStats,
  getSchoolAttendanceOverview,
  getStudentAttendanceStats,
} from "@/src/lib/services/attendance";

export async function GET(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole([
      "admin",
      "teacher",
      "student",
      "parent",
      "bursar",
    ]);
    const limited = await enforceRateLimit(req, {
      scope: "attendance:stats",
      actorId: userId,
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const parsed = parseSearchParams(attendanceStatsQuerySchema, req.nextUrl.searchParams);
    if (!parsed.ok) return parsed.response;

    if (parsed.data.studentId) {
      const stats = await getStudentAttendanceStats(schoolId, parsed.data.studentId);
      return stats
        ? NextResponse.json(stats)
        : NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    if (parsed.data.classId) {
      const students = await getClassAttendanceStats(schoolId, parsed.data.classId);
      return NextResponse.json({ students });
    }

    return NextResponse.json(await getSchoolAttendanceOverview(schoolId));
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
