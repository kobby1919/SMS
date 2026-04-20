import prisma from "@/src/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { Megaphone } from "lucide-react";

const colorMap = [
  "bg-jaySkyLight border-l-4 border-jaySky",
  "bg-jayPurpleLight border-l-4 border-jayPurple",
  "bg-jayYellowLight border-l-4 border-jayYellow",
];

const Announcements = async () => {
  const user = await currentUser();
  const role = user?.publicMetadata?.role as string;

  // Build the where clause based on role:
  // - admin   → all announcements (no filter)
  // - teacher → global (classId null) + their supervised classes
  // - student → global (classId null) + their own class
  // - parent  → global (classId null) + their children's classes
  let where: object = {};

  if (role === "teacher") {
    const teacher = await prisma.teacher.findUnique({
      where: { id: user!.id },
      select: { classes: { select: { id: true } } },
    });
    const classIds = teacher?.classes.map((c) => c.id) ?? [];
    where = { OR: [{ classId: null }, { classId: { in: classIds } }] };

  } else if (role === "student") {
    const student = await prisma.student.findUnique({
      where: { id: user!.id },
      select: { classId: true },
    });
    where = { OR: [{ classId: null }, { classId: student?.classId }] };

  } else if (role === "parent") {
    const parent = await prisma.parent.findUnique({
      where: { id: user!.id },
      include: { students: { select: { classId: true } } },
    });
    const classIds = parent?.students.map((s) => s.classId) ?? [];
    where = { OR: [{ classId: null }, { classId: { in: classIds } }] };
  }
  // admin: where = {} → fetches everything

  const announcements = await prisma.announcement.findMany({
    where,
    orderBy: { date: "desc" },
    take: 3,
    include: { class: { select: { name: true } } },
  });

  const formatDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-nunito font-extrabold text-lg text-gray-800">Announcements</h1>
        <span className="text-xs text-jayPurple font-semibold cursor-pointer hover:underline">View All</span>
      </div>

      {announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <Megaphone size={32} className="text-gray-200" />
          <p className="text-sm text-gray-400 font-medium">No announcements yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {announcements.map((a, i) => (
            <div key={a.id} className={`rounded-xl p-4 ${colorMap[i % colorMap.length]}`}>
              <div className="flex items-center justify-between mb-1 gap-2">
                <h2 className="font-semibold text-sm text-gray-700 truncate">{a.title}</h2>
                <div className="flex items-center gap-1.5 shrink-0">
                  {a.class && (
                    <span className="text-[10px] font-semibold text-jayPurple bg-white rounded-full px-2 py-0.5">
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
