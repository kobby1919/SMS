// src/app/(dashboard)/list/finance/fee-structures/[id]/page.tsx
  

import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import prisma from "@/src/lib/prisma";
import Link from "next/link";
import {
  ArrowLeft, FileText, Lock, Clock,
  CheckCircle2, AlertCircle, Users,
} from "lucide-react";
import { formatGHS, FEE_CATEGORY_LABELS } from "@/src/lib/constants/finance";
import PublishFeeStructureButton from "@/src/components/PublishFeeStructureButton";
import FeeItemManager from "@/src/components/FeeItemManager";

export const dynamic = "force-dynamic";

const TERM_LABELS: Record<string, string> = {
  TERM_1: "Term 1", TERM_2: "Term 2", TERM_3: "Term 3",
};

const FeeStructureDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin" && role !== "bursar") redirect("/");

  const { id } = await params;
  const structureId = parseInt(id);

  const structure = await prisma.feeStructure.findUnique({
    where:   { id: structureId },
    include: {
      grade:    { select: { level: true } },
      feeItems: { orderBy: { createdAt: "asc" } },
      bills:    { select: { id: true, status: true } },
    },
  });

  if (!structure) notFound();

  const isPublished    = structure.status === "PUBLISHED";
  const mandatoryItems = structure.feeItems.filter((i) => !i.isOptional);
  const optionalItems  = structure.feeItems.filter((i) => i.isOptional);
  const mandatoryTotal = mandatoryItems.reduce((sum, i) => sum + Number(i.amount), 0);
  const optionalTotal  = optionalItems.reduce((sum,  i) => sum + Number(i.amount), 0);
  const grandTotal     = mandatoryTotal + optionalTotal;

  // Bill status breakdown if bills exist
  const billStats = {
    total:   structure.bills.length,
    unpaid:  structure.bills.filter((b) => b.status === "UNPAID").length,
    partial: structure.bills.filter((b) => b.status === "PARTIAL").length,
    paid:    structure.bills.filter((b) => b.status === "PAID").length,
  };

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">

      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/list/finance/fee-structures"
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors shrink-0"
            >
              <ArrowLeft size={16} />
            </Link>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0
              ${isPublished ? 'bg-emerald-50' : 'bg-amber-50'}">
              {isPublished
                ? <Lock size={20} className="text-emerald-600" />
                : <Clock size={20} className="text-amber-600" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-gray-800 tracking-tight">{structure.title}</h1>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg
                  ${isPublished ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {isPublished ? "Published" : "Draft"}
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-0.5 font-medium">
                {structure.grade.level} · {TERM_LABELS[structure.term]} · {structure.academicYear}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {!isPublished && (
              <PublishFeeStructureButton
                id={structureId}
                hasItems={structure.feeItems.length > 0}
                hasMandatory={mandatoryItems.length > 0}
              />
            )}
            {isPublished && structure.bills.length === 0 && (
              <Link
                href={`/list/finance/fee-structures/${structureId}/generate-bills`}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Users size={15} /> Generate Bills
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {structure.description && (
        <div className="p-4 bg-violet-50 border border-violet-100 rounded-2xl">
          <p className="text-xs font-black uppercase tracking-wider text-violet-400 mb-1">Overview</p>
          <p className="text-sm text-violet-800">{structure.description}</p>
        </div>
      )}

      {/* Published lock notice */}
      {isPublished && (
        <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <Lock size={15} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black text-emerald-800">This structure is published and locked</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Fee items cannot be edited after publishing. Published on{" "}
              {structure.publishedAt
                ? new Date(structure.publishedAt).toLocaleDateString("en-GH", { day: "numeric", month: "long", year: "numeric" })
                : "—"}.
              {structure.bills.length === 0
                ? " No bills generated yet — click Generate Bills to create bills for students in this grade."
                : ` ${billStats.total} bills generated.`}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">

        {/* Left — fee items manager */}
        <div className="flex-1">
          <FeeItemManager
            feeStructureId={structureId}
            isPublished={isPublished}
            feeItems={structure.feeItems.map((item) => ({
              id:          item.id,
              name:        item.name,
              amount:      Number(item.amount),
              category:    item.category,
              isOptional:  item.isOptional,
              description: item.description ?? "",
            }))}
          />
        </div>

        {/* Right sidebar — summary */}
        <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4">

          {/* Totals card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-xs font-black uppercase tracking-wider text-gray-400">Fee Summary</p>
            </div>
            <div className="p-5 flex flex-col gap-3">
              {/* Mandatory */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-700">Mandatory Fees</p>
                  <p className="text-[10px] text-gray-400">{mandatoryItems.length} item{mandatoryItems.length !== 1 ? "s" : ""}</p>
                </div>
                <p className="text-sm font-black text-gray-800">{formatGHS(mandatoryTotal)}</p>
              </div>
              {/* Optional */}
              {optionalItems.length > 0 && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-500">Optional Fees</p>
                    <p className="text-[10px] text-gray-400">{optionalItems.length} item{optionalItems.length !== 1 ? "s" : ""}</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-500">{formatGHS(optionalTotal)}</p>
                </div>
              )}
              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-gray-800">Base Total</p>
                  <p className="text-lg font-black text-violet-700">{formatGHS(mandatoryTotal)}</p>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Per student (mandatory fees only)
                </p>
              </div>
            </div>
          </div>

          {/* Category breakdown */}
          {structure.feeItems.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs font-black uppercase tracking-wider text-gray-400">By Category</p>
              </div>
              <div className="divide-y divide-gray-50">
                {Object.entries(
                  structure.feeItems.reduce((acc, item) => {
                    const cat = item.category;
                    if (!acc[cat]) acc[cat] = 0;
                    acc[cat] += Number(item.amount);
                    return acc;
                  }, {} as Record<string, number>)
                )
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, total]) => (
                    <div key={category} className="flex items-center justify-between px-5 py-2.5">
                      <p className="text-xs font-semibold text-gray-600">
                        {FEE_CATEGORY_LABELS[category] ?? category}
                      </p>
                      <p className="text-xs font-black text-gray-800">{formatGHS(total)}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Bills snapshot (if bills exist) */}
          {billStats.total > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <p className="text-xs font-black uppercase tracking-wider text-gray-400">Bills Generated</p>
                <Link
                  href={`/list/finance/bills?structureId=${structureId}`}
                  className="text-xs font-bold text-violet-600 hover:text-violet-700"
                >
                  View →
                </Link>
              </div>
              <div className="p-4 grid grid-cols-3 gap-2">
                {[
                  { label: "Unpaid",  value: billStats.unpaid,  color: "bg-rose-50 text-rose-700"    },
                  { label: "Partial", value: billStats.partial, color: "bg-amber-50 text-amber-700"   },
                  { label: "Paid",    value: billStats.paid,    color: "bg-emerald-50 text-emerald-700" },
                ].map((s) => (
                  <div key={s.label} className={`rounded-xl p-2.5 text-center ${s.color}`}>
                    <p className="text-lg font-black leading-none">{s.value}</p>
                    <p className="text-[9px] font-bold uppercase mt-0.5 opacity-70">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeeStructureDetailPage;