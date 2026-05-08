// src/app/(dashboard)/list/finance/fee-structures/page.tsx


import { redirect } from "next/navigation";
import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import Link from "next/link";
import {
  FileText, Plus, Eye, Trash2,
  CheckCircle2, Clock, Lock, ChevronRight,
} from "lucide-react";
import { formatGHS } from "@/src/lib/constants/finance";
import FeeStructureDeleteButton from "@/src/components/FeeStructureDeleteButton";

export const dynamic = "force-dynamic";

const TERM_LABELS: Record<string, string> = {
  TERM_1: "Term 1", TERM_2: "Term 2", TERM_3: "Term 3",
};

const FeeStructuresPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { schoolId } = await requirePageSession(["admin", "bursar"]);

  const sp           = await searchParams;
  const filterGrade  = sp.grade  ? parseInt(sp.grade) : undefined;
  const filterTerm   = sp.term   as string | undefined;
  const filterYear   = sp.year   as string | undefined;
  const filterStatus = sp.status as string | undefined;

  const where: any = { schoolId };
  if (filterGrade)  where.gradeId      = filterGrade;
  if (filterTerm)   where.term         = filterTerm;
  if (filterYear)   where.academicYear = filterYear;
  if (filterStatus) where.status       = filterStatus;

  const [structures, grades] = await Promise.all([
    prisma.feeStructure.findMany({
      where,
      include: {
        grade:    { select: { level: true } },
        feeItems: { select: { amount: true, isOptional: true } },
        bills:    { select: { id: true } },
      },
      orderBy: [{ academicYear: "desc" }, { grade: { order: "asc" } }, { term: "asc" }],
    }),
    prisma.grade.findMany({ where: { schoolId }, orderBy: { order: "asc" } }),
  ]);

  // Derive academic years from existing structures for the filter
  const years = [...new Set(structures.map((s) => s.academicYear))].sort().reverse();

  const totalPublished = structures.filter((s) => s.status === "PUBLISHED").length;
  const totalDraft     = structures.filter((s) => s.status === "DRAFT").length;

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">

      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-violet-50 rounded-2xl flex items-center justify-center shrink-0">
              <FileText size={20} className="text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 tracking-tight">Fee Structures</h1>
              <p className="text-sm text-gray-400 mt-0.5 font-medium">
                {structures.length} total · {totalPublished} published · {totalDraft} draft
              </p>
            </div>
          </div>
          <Link
            href="/list/finance/fee-structures/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors shadow-sm shrink-0"
          >
            <Plus size={16} /> New Structure
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <form className="flex flex-wrap gap-2 items-center">
          <select name="grade" defaultValue={filterGrade ?? ""} className="appearance-none ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 outline-none bg-white">
            <option value="">All Grades</option>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.level}</option>)}
          </select>
          <select name="term" defaultValue={filterTerm ?? ""} className="appearance-none ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 outline-none bg-white">
            <option value="">All Terms</option>
            {Object.entries(TERM_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select name="year" defaultValue={filterYear ?? ""} className="appearance-none ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 outline-none bg-white">
            <option value="">All Years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select name="status" defaultValue={filterStatus ?? ""} className="appearance-none ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 outline-none bg-white">
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
          <button type="submit" className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors">Apply</button>
          <Link href="/list/finance/fee-structures" className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors">Clear</Link>
        </form>
      </div>

      {/* List */}
      {structures.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <FileText size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-400">No fee structures yet</p>
          <Link href="/list/finance/fee-structures/new" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700">
            <Plus size={13} /> Create your first fee structure
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {structures.map((s) => {
            const isPublished    = s.status === "PUBLISHED";
            const mandatoryItems = s.feeItems.filter((i) => !i.isOptional);
            const optionalItems  = s.feeItems.filter((i) => i.isOptional);
            const mandatoryTotal = mandatoryItems.reduce((sum, i) => sum + Number(i.amount), 0);
            const hasBills       = s.bills.length > 0;

            return (
              <div
                key={s.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Status strip */}
                <div className={`h-1 w-full ${isPublished ? "bg-emerald-500" : "bg-amber-400"}`} />

                <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0
                    ${isPublished ? "bg-emerald-50" : "bg-amber-50"}`}>
                    {isPublished
                      ? <Lock size={18} className="text-emerald-600" />
                      : <Clock size={18} className="text-amber-600" />}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-black text-gray-800">{s.title}</h2>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg
                        ${isPublished ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {isPublished ? "Published" : "Draft"}
                      </span>
                      {hasBills && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600">
                          {s.bills.length} bill{s.bills.length !== 1 ? "s" : ""} generated
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 font-medium mt-0.5">
                      {s.grade.level} · {TERM_LABELS[s.term]} · {s.academicYear}
                    </p>
                    {/* Fee item summary */}
                    <div className="flex flex-wrap gap-3 mt-2">
                      <span className="text-xs text-gray-500">
                        <span className="font-black text-gray-800">{mandatoryItems.length}</span> mandatory fee{mandatoryItems.length !== 1 ? "s" : ""}
                        {" · "}
                        <span className="font-black text-violet-700">{formatGHS(mandatoryTotal)}</span> base total
                      </span>
                      {optionalItems.length > 0 && (
                        <span className="text-xs text-gray-400">
                          + {optionalItems.length} optional item{optionalItems.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/list/finance/fee-structures/${s.id}`}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors text-xs font-bold"
                    >
                      <Eye size={13} />
                      {isPublished ? "View" : "Edit"}
                    </Link>
                    {!hasBills && (
                      <FeeStructureDeleteButton id={s.id} title={s.title} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FeeStructuresPage;