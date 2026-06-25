// src/app/(dashboard)/admin/ca-config/page.tsx
// Admin page to configure CA weights per academic year

import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import CAConfigForm from "@/src/components/CAConfigForm";
import { Settings2, Info } from "lucide-react";

export const dynamic = "force-dynamic";

const CAConfigPage = async () => {
  const { schoolId } = await requirePageSession(["admin"]);

  const configs = await prisma.cAConfig.findMany({
    where: { schoolId },
    orderBy: { academicYear: "desc" },
  });

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4 max-w-2xl">

      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
            <Settings2 size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tight">CA Weight Configuration</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">
              Set how CA scores are weighted per academic year
            </p>
          </div>
        </div>
      </div>

      {/* Info card */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
        <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700 leading-relaxed">
          <p className="font-black mb-1">How CA weights work</p>
          <p>
            The <strong>Classwork Weight</strong> is the percentage contribution from class activities
            (exercises, tests, homework, midterms, etc.) and the <strong>Exam Weight</strong> is the
            percentage from the end-of-term exam. They must always sum to <strong>100%</strong>.
          </p>
          <p className="mt-1.5">
            Example: 30% classwork + 70% exam means a student who scores 80 on classwork and 60 on
            the exam gets a total of <strong>{Math.round(80 * 0.3 + 60 * 0.7)}%</strong>.
          </p>
          <p className="mt-1.5 font-semibold">
            ⚠️ Changing weights after CA records have been saved will NOT retroactively update those
            records. Existing records retain the weights that were active when they were saved.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <CAConfigForm existingConfigs={configs.map((c) => ({
          id:              c.id,
          academicYear:    c.academicYear,
          classworkWeight: c.classworkWeight,
          examWeight:      c.examWeight,
        }))} />
      </div>

      {/* Existing configs */}
      {configs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">Saved Configurations</p>
          </div>
          <div className="divide-y divide-gray-50">
            {configs.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-bold text-gray-800">{c.academicYear}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Classwork: {c.classworkWeight}% · Exam: {c.examWeight}%
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center h-2 w-32 rounded-full overflow-hidden bg-gray-100">
                    <div
                      className="h-full bg-indigo-400 rounded-l-full"
                      style={{ width: `${c.classworkWeight}%` }}
                    />
                    <div
                      className="h-full bg-emerald-400 rounded-r-full"
                      style={{ width: `${c.examWeight}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
                      CW
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                      EX
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CAConfigPage;
