import "server-only";
import prisma from "@/src/lib/prisma";
import { AuthorizationError, type AuthzContext } from "@/src/lib/authz";
import { parentCanAccessStudent } from "@/src/lib/services/parent-student-relationships";
import { listLiveTimetableLessons } from "@/src/lib/services/timetable";

export async function assertAttendanceStatsAccess(context: AuthzContext, selection: { studentId?: string; classId?: number }) {
  const { role, userId, schoolId } = context;
  if (role === "admin") return;
  if (!["teacher", "parent", "student"].includes(role)) throw new AuthorizationError("Attendance is unavailable for this role.");
  if (role !== "teacher" && (!selection.studentId || selection.classId)) throw new AuthorizationError("Select an authorized student to review attendance.");
  const student = selection.studentId ? await prisma.student.findFirst({ where: { id: selection.studentId, schoolId, status: "ACTIVE", class: { is: { schoolId } } }, select: { id: true, classId: true } }) : null;
  if (selection.studentId && !student) throw new AuthorizationError("Attendance is unavailable for this student.");
  if (role === "student") {
    if (student?.id !== userId) throw new AuthorizationError("You can only review your own attendance.");
    return;
  }
  if (role === "parent") {
    if (!await parentCanAccessStudent({ schoolId, parentId: userId, studentId: student!.id })) throw new AuthorizationError("Attendance is unavailable for this ward.");
    return;
  }
  if (student && selection.classId && selection.classId !== student.classId) throw new AuthorizationError("This student does not belong to the selected class.");
  const classId = student?.classId ?? selection.classId;
  if (!classId) throw new AuthorizationError("Select a class in your teaching scope.");
  const cls = await prisma.class.findFirst({ where: { id: classId, schoolId }, select: { supervisorId: true } });
  if (!cls) throw new AuthorizationError("This class is outside your teaching scope.");
  const lessons = await listLiveTimetableLessons(schoolId, { classId, teacherId: userId });
  if (cls.supervisorId !== userId && !lessons.length) throw new AuthorizationError("This class is outside your published teaching scope.");
}
