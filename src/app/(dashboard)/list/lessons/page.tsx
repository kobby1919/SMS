import Pagination from "@/src/components/pagination";
import { requirePageSession } from "@/src/lib/authz";
import TableSearch from "@/src/components/TableSearch";
import { Filter, ArrowUpDown, BookOpen } from "lucide-react";
import { ITEM_PER_PAGE } from "@/src/lib/settings";
import {
  getActiveTimetablePublication,
  listLiveTimetableLessons,
} from "@/src/lib/services/timetable";

const LessonListPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  // 1. Fetch Auth and Role
  const { role, schoolId, userId } = await requirePageSession();
  const { page, ...queryParams } = await searchParams;
  const p = page ? parseInt(page) : 1;

  const [publication, liveLessons] = await Promise.all([
    getActiveTimetablePublication(schoolId),
    listLiveTimetableLessons(
      schoolId,
      role === "teacher" ? { teacherId: userId } : {},
    ),
  ]);

  const search = queryParams.search?.trim().toLowerCase();
  const classIdFilter = queryParams.classId ? Number(queryParams.classId) : null;
  const teacherIdFilter = queryParams.teacherId;

  const filteredLessons = liveLessons.filter((lesson) => {
    if (classIdFilter && lesson.classId !== classIdFilter) return false;
    if (teacherIdFilter && lesson.teacherId !== teacherIdFilter) return false;
    if (!search) return true;

    return [
      lesson.name,
      lesson.subject.name,
      lesson.class.name,
      `${lesson.teacher.name} ${lesson.teacher.surname}`,
      lesson.day,
    ]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });

  const count = filteredLessons.length;
  const lessons = filteredLessons.slice(
    ITEM_PER_PAGE * (p - 1),
    ITEM_PER_PAGE * p,
  );

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">
      {/* ── Page header ── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tight">
              Lessons
            </h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">
              {publication
                ? `${count} published lessons available`
                : "No published timetable is active yet"}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <TableSearch />
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors">
                <Filter size={14} />
                <span className="hidden sm:inline">Filter</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors">
                <ArrowUpDown size={14} />
                <span className="hidden sm:inline">Sort</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total Lessons",
            value: count,
            icon: <BookOpen size={16} />,
            color: "bg-indigo-50 text-indigo-600",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3"
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}
            >
              {stat.icon}
            </div>
            <div>
              <p className="text-xl font-black text-gray-800 leading-none">
                {stat.value}
              </p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                {stat.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">
                  Lesson Name
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">
                  Class
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">
                  Teacher
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden lg:table-cell">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lessons.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-indigo-50/30 transition-colors duration-150 group"
                >
                  <td className="px-5 py-4">
                    <p className="font-bold text-sm text-gray-800 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-400 font-semibold md:hidden">
                      {item.class.name} · {item.day}
                    </p>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-sm text-gray-500">
                      {item.class.name}
                    </span>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-sm text-gray-500">
                      {item.teacher.name + " " + item.teacher.surname}
                    </span>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <span className="text-sm text-gray-500">
                      {item.day} ·{" "}
                      {item.startTime.toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      -
                      {item.endTime.toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </td>
                </tr>
              ))}
              {lessons.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-10 text-center text-sm font-semibold text-gray-400"
                  >
                    {publication
                      ? "No published lessons match this view."
                      : "The master timetable must be published before lessons appear here."}
                  </td>
                </tr>
              )}
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

export default LessonListPage;
