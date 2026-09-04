// ... (imports remain the same)

import FormModal from "@/src/components/FormModal";
import Pagination from "@/src/components/pagination";
import TableSearch from "@/src/components/TableSearch";
import { Prisma } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { ITEM_PER_PAGE } from "@/src/lib/settings";
import { requirePageSession } from "@/src/lib/authz";
import { AlertTriangle, Megaphone } from "lucide-react";

const priorityMeta = {
  NORMAL: { label: "Normal", className: "bg-slate-50 text-slate-600" },
  IMPORTANT: { label: "Important", className: "bg-amber-50 text-amber-700" },
  URGENT: { label: "Urgent", className: "bg-rose-50 text-rose-700" },
} as const;

const AnnouncementListPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { userId, role, schoolId } = await requirePageSession();
  const currentUserId = userId;

  const { page, ...queryParams } = await searchParams;
  const p = page ? parseInt(page) : 1;

  const andConditions: Prisma.AnnouncementWhereInput[] = [
    { OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] },
  ];

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value.trim()) {
        switch (key) {
          case "search":
            andConditions.push({
              OR: [
                { title: { contains: value.trim(), mode: "insensitive" } },
                { description: { contains: value.trim(), mode: "insensitive" } },
                { class: { name: { contains: value.trim(), mode: "insensitive" } } },
              ],
            });
            break;
        }
      }
    }
  }

  // ROLE CONDITIONS
  if (role !== "admin") {
    const roleCondition: Prisma.ClassWhereInput | null =
      role === "teacher"
        ? { lessons: { some: { teacherId: currentUserId } } }
        : role === "student"
          ? { students: { some: { id: currentUserId } } }
          : role === "parent"
            ? { students: { some: { parentId: currentUserId } } }
            : null;

    andConditions.push(
      roleCondition
        ? {
            OR: [
              { classId: null },
              { class: roleCondition },
            ],
          }
        : { classId: null },
    );
  }

  const query: Prisma.AnnouncementWhereInput = {
    schoolId,
    AND: andConditions,
  };


  const [announcements, count] = await Promise.all([
    prisma.announcement.findMany({
      where: query,
      include: {
        class: true,
      },
      orderBy: [{ priority: "desc" }, { date: "desc" }],
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
    }),
    prisma.announcement.count({
      where: query,
    }),
  ]);

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">
      {/* ── Page header ── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tight">
              Announcements
            </h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">
              {count} active notice{count === 1 ? "" : "s"} published
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <TableSearch />
            <div className="flex items-center gap-2">
              {role === "admin" && (
                <FormModal table="announcement" type="create" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-600">
            <Megaphone size={16} />
          </div>
          <div>
            <p className="text-xl font-black text-gray-800 leading-none">
              {count}
            </p>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              Total Posts
            </p>
          </div>
        </div>
      </div>

      {/* ── Table card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">
                  Title
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">
                  Class
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">
                  Date
                </th>
                {/* ── CONDITIONALLY RENDER ACTIONS HEADER ── */}
                {role === "admin" && (
                  <th className="text-right px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 w-[100px]">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {announcements.map((item) => {
                const meta = priorityMeta[item.priority];
                const expired = item.expiresAt ? item.expiresAt < new Date() : false;
                return (
                <tr
                  key={item.id}
                  className="hover:bg-indigo-50/30 transition-colors duration-150 group"
                >
                  <td className="px-5 py-4 font-bold text-sm text-gray-800">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {item.priority === "URGENT" && <AlertTriangle size={14} className="text-rose-600" />}
                        <span>{item.title}</span>
                      </div>
                      <p className="line-clamp-2 text-xs font-semibold text-gray-400">{item.description}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500">
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold">{item.class?.name || "Whole school"}</span>
                      <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-black ${meta.className}`}>
                        {meta.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell text-sm text-gray-500">
                    <div className="flex flex-col">
                      <span>{new Intl.DateTimeFormat("en-GH").format(item.date)}</span>
                      {item.expiresAt && (
                        <span className={`text-xs font-semibold ${expired ? "text-rose-500" : "text-gray-400"}`}>
                          Expires {new Intl.DateTimeFormat("en-GH").format(item.expiresAt)}
                        </span>
                      )}
                    </div>
                  </td>
                  
                  {/* ── CONDITIONALLY RENDER ACTIONS DATA CELL ── */}
                  {role === "admin" && (
                    <td className="px-5 py-4 w-[100px]">
                      <div className="flex items-center justify-end gap-2">
                        <FormModal
                          table="announcement"
                          type="update"
                          data={item}
                        />
                        <FormModal
                          table="announcement"
                          type="delete"
                          id={item.id}
                        />
                      </div>
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100">
          <Pagination page={p} count={count} />
        </div>
      </div>
    </div>
  );
};

export default AnnouncementListPage;
