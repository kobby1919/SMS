// src/app/(dashboard)/list/finance/fee-structures/new/page.tsx
// Create a new fee structure. After creation redirects to the detail/edit page
// so fee items can be added immediately.

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/src/lib/prisma";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import FeeStructureCreateForm from "@/src/components/FeeStructureCreateForm";

export const dynamic = "force-dynamic";

const NewFeeStructurePage = async () => {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin" && role !== "bursar") redirect("/");

  const [grades, configs] = await Promise.all([
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
          <Link
            href="/list/finance/fee-structures"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors shrink-0"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="w-11 h-11 bg-violet-50 rounded-2xl flex items-center justify-center shrink-0">
            <FileText size={20} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tight">New Fee Structure</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">
              Define the scope, then add fee items on the next screen
            </p>
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 p-4 bg-violet-50 border border-violet-100 rounded-2xl">
        <FileText size={15} className="text-violet-500 shrink-0 mt-0.5" />
        <div className="text-xs text-violet-700 leading-relaxed">
          <p className="font-black mb-1">How fee structures work</p>
          <p>
            A fee structure is a <strong>template</strong> of charges for a specific grade, term,
            and academic year. After creating it, you add individual fee items (tuition, PTA levy,
            sports, etc.). Once all items are added, you <strong>publish</strong> the structure —
            which locks it — and then generate bills for the students in that grade.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <FeeStructureCreateForm
          grades={grades.map((g) => ({ id: g.id, level: g.level }))}
          academicYears={academicYears}
        />
      </div>
    </div>
  );
};

export default NewFeeStructurePage;