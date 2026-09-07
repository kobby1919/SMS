import prisma from "@/src/lib/prisma";
import { requirePageSession } from "@/src/lib/authz";
import type { Prisma } from "@/src/generated/prisma";
import Link from "next/link";
import { AlertTriangle, Megaphone } from "lucide-react";

const colorMap = [
  "bg-edujay-soft border-l-4 border-edujay-primary",
  "bg-slate-50 border-l-4 border-edujay-border",
  "bg-white border-l-4 border-edujay-ring",
];

const priorityMeta = {
  NORMAL: { label: "Normal", className: "text-slate-500 bg-white" },
  IMPORTANT: { label: "Important", className: "text-amber-700 bg-amber-50" },
  URGENT: { label: "Urgent", className: "text-rose-700 bg-rose-50" },
} as const;

const Announcements = async () => {
  const { userId, role, schoolId } = await requirePageSession();

  // Build the where clause based on role:
  // - admin   → all announcements (no filter)
  // - teacher → global (classId null) + their supervised classes
  // - student → global (classId null) + their own class
  // - parent  → global (classId null) + their children's classes
  let where: Prisma.AnnouncementWhereInput = { schoolId };

  if (role === "teacher") {
    const teacher = await prisma.teacher.findFirst({
      where: { id: userId, schoolId },
      select: {
        classes: { select: { id: true } },
        lessons: { select: { classId: true } },
      },
    });
    const classIds = Array.from(
      new Set([
        ...(teacher?.classes.map((c) => c.id) ?? []),
        ...(teacher?.lessons.map((lesson) => lesson.classId) ?? []),
      ]),
    );
    where = { schoolId, OR: [{ classId: null }, { classId: { in: classIds } }] };

  } else if (role === "student") {
    const student = await prisma.student.findFirst({
      where: { id: userId, schoolId },
      select: { classId: true },
    });
    where = { schoolId, OR: [{ classId: null }, { classId: student?.classId }] };

  } else if (role === "parent") {
    const parent = await prisma.parent.findFirst({
      where: { id: userId, schoolId },
      include: { students: { where: { schoolId }, select: { classId: true } } },
    });
    const classIds = parent?.students.map((s) => s.classId) ?? [];
    where = { schoolId, OR: [{ classId: null }, { classId: { in: classIds } }] };
  }
  // admin: where = {} → fetches everything

  const announcements = await prisma.announcement.findMany({
    where: {
      AND: [
        where,
        {
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: new Date() } },
          ],
        },
      ],
    },
    orderBy: [{ priority: "desc" }, { date: "desc" }],
    take: 3,
    include: { class: { select: { name: true } } },
  });

  const formatDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-nunito text-base font-extrabold text-edujay-ink">Notices</h1>
        <Link href="/list/announcements" className="text-xs font-bold text-edujay-primary hover:underline">
          View All
        </Link>
      </div>

      {announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <Megaphone size={32} className="text-gray-200" />
          <p className="text-sm text-gray-400 font-medium">No announcements yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {announcements.map((a, i) => (
            <div key={a.id} className={`rounded-xl p-3 ${colorMap[i % colorMap.length]}`}>
              <div className="flex items-center justify-between mb-1 gap-2">
                <h2 className="font-semibold text-sm text-gray-700 truncate flex items-center gap-1.5">
                  {a.priority === "URGENT" && <AlertTriangle size={13} className="text-rose-600" />}
                  {a.title}
                </h2>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${priorityMeta[a.priority].className}`}>
                    {priorityMeta[a.priority].label}
                  </span>
                  {a.class && (
                    <span className="text-[10px] font-semibold text-edujay-primary bg-white rounded-full px-2 py-0.5">
                      {a.class.name}
                    </span>
                  )}
                  {!a.class && (
                    <span className="text-[10px] font-semibold text-gray-400 bg-white rounded-full px-2 py-0.5">
                      All
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400 bg-white rounded-full px-2 py-0.5">
                    {formatDate(a.date)}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{a.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Announcements;
