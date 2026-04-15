import Pagination from "@/src/components/pagination";
import TableSearch from "@/src/components/TableSearch";
import { role } from "@/src/lib/data";
import Image from "next/image";
import Link from "next/link";
import { Eye, Plus, BookOpen, Users } from "lucide-react";
import FormModal from "@/src/components/FormModal";
import prisma from "@/src/lib/prisma";
import { Subject, Class, Prisma } from "@/src/generated/prisma";
import { ITEM_PER_PAGE } from "@/src/lib/settings";



const StudentListPage = async ({searchParams}: {
  searchParams: Promise<{[key: string]: string | undefined }>
}) => {
  const { page, ...queryParams } = await searchParams;
  const p = page ? parseInt(page) : 1;

  const query: Prisma.StudentWhereInput = {};

  
 if (queryParams) {
  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined) {
      switch (key) {
        case "teacherId": { 
          query.class = {
            lessons: {
              some: {
                teacherId: value,
              }
            },
          };
          break;
        } // End block

        case "search": 
          query.name = { contains: value, mode: "insensitive" };
          break;
      }
    }
  }
}


  const [students, count] = await Promise.all([
    prisma.student.findMany({
      where: query,
      include: {
        class: true,
      },
      orderBy: {
        name: "asc",
      },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
    }),
    prisma.student.count({
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
              Students
            </h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">
              {count} members registered
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <TableSearch />
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors">
                {/* <Filter size={14} /> */}
                <Image src="/filter.png" alt="" width={16} height={16} />
                <span className="hidden sm:inline">Filter</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors">
                {/* <ArrowUpDown size={14} /> */}
                <Image src="/sort.png" alt="" width={16} height={16} />
                <span className="hidden sm:inline">Sort</span>
              </button>
              {role === "admin" && (
                // <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
                //   <Image src="/plus.png" alt="" width={16} height={16} />
                //   <span>Add</span>
                // </button>
                <FormModal table="student" type="create" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total Students",
            value: count,
            icon: <Users size={16} />,
            color: "bg-indigo-50 text-indigo-600",
          },
          {
            label: "Subjects",
            value: 6,
            icon: <BookOpen size={16} />,
            color: "bg-amber-50 text-amber-600",
          },
          {
            label: "Active Classes",
            value: 12,
            icon: <Users size={16} />,
            color: "bg-emerald-50 text-emerald-600",
          },
          {
            label: "New This Month",
            value: 50,
            icon: <Plus size={16} />,
            color: "bg-violet-50 text-violet-600",
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

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[360px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">
                  Student
                </th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">
                  ID
                </th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">
                  Grade
                </th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden lg:table-cell">
                  Phone
                </th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden xl:table-cell">
                  Address
                </th>
                <th className="text-right px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 sticky right-0 bg-gray-50/60 backdrop-blur-sm">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {students.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-indigo-50/30 transition-colors duration-150 group"
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <Image
                          src={item.img || "/noAvatar.png"}
                          alt={item.name}
                          width={38}
                          height={38}
                          className="w-9 h-9 rounded-xl object-cover ring-2 ring-gray-100"
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-gray-800 truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {item.class.name}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-3.5 hidden md:table-cell">
                    <span className="text-xs font-mono font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                      {item.username}
                    </span>
                  </td>

                  <td className="px-3 py-3.5 hidden md:table-cell">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600">
                      Grade {item.class.name}
                    </span>
                  </td>

                  <td className="px-3 py-3.5 hidden lg:table-cell">
                    <span className="text-sm text-gray-600 font-medium">
                      {item.phone}
                    </span>
                  </td>

                  <td className="px-3 py-3.5 hidden xl:table-cell">
                    <span className="text-sm text-gray-500 truncate max-w-[160px] block">
                      {item.address}
                    </span>
                  </td>

                  {/* Sticky actions */}
                  <td className="px-5 py-4 w-[100px]">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/list/students/${item.id}`}>
                        <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors">
                          <Eye size={14} />
                        </button>
                      </Link>
                      {role === "admin" && (
                        // <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors">
                        //   <Trash2 size={14} />
                        // </button>
                        <FormModal table="student" type="delete" id={item.id} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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

export default StudentListPage;
