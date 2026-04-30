// src/app/(dashboard)/list/syllabus/new/page.tsx


import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/src/lib/prisma";
import { BookMarked, ArrowLeft } from "lucide-react";
import Link from "next/link";
import SyllabusCreateForm from "@/src/components/SyllabusCreateForm";

export const dynamic = "force-dynamic";

const NewSyllabusPage = async () => {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") redirect("/list/syllabus");

  const [subjects, grades, configs] = await Promise.all([
    prisma.subject.findMany({ orderBy: { name: "asc" } }),
    prisma.grade.findMany({ orderBy: { order: "asc" } }),
    prisma.cAConfig.findMany({ orderBy: { academicYear: "desc" } }),
  ]);

  const academicYears = configs.length > 0
    ? configs.map((c) => c.academicYear)
    : ["2024/25", "2025/26"];

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4 max-w-2xl">

      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/list/syllabus" className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors shrink-0">
            <ArrowLeft size={16} />
          </Link>
          <div className="w-11 h-11 bg-violet-50 rounded-2xl flex items-center justify-center shrink-0">
            <BookMarked size={20} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tight">New Syllabus</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">
              Define the scope, then add topics on the next screen
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <SyllabusCreateForm
          subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
          grades={grades.map((g) => ({ id: g.id, level: g.level }))}
          academicYears={academicYears}
        />
      </div>
    </div>
  );
};

export default NewSyllabusPage;