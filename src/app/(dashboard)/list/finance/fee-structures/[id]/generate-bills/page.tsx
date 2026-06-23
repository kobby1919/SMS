// src/app/(dashboard)/list/finance/fee-structures/[id]/generate-bills/page.tsx

import { redirect, notFound } from "next/navigation";
import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { formatGHS } from "@/src/lib/constants/finance";
import GenerateBillsForm from "@/src/components/GenerateBillsForm";

export const dynamic = "force-dynamic";

const TERM_LABELS: Record<string, string> = {
  TERM_1: "Term 1", TERM_2: "Term 2", TERM_3: "Term 3",
};

const GenerateBillsPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { schoolId } = await requirePageSession(["admin", "bursar"]);

  const { id } = await params;
  const feeStructureId = parseInt(id);

  const structure = await prisma.feeStructure.findFirst({
    where:   { id: feeStructureId, schoolId },
    include: {
      grade:    { select: { id: true, level: true } },
      feeItems: { orderBy: { isOptional: "asc" } },
    },
  });

  if (!structure) notFound();
  if (structure.status !== "PUBLISHED") redirect(`/list/finance/fee-structures/${feeStructureId}`);

  // Classes at this grade level
  const classes = await prisma.class.findMany({
    where:   { schoolId, gradeId: structure.gradeId },
    include: {
      students: { select: { id: true } },
      _count:   { select: { students: true } },
    },
    orderBy: { name: "asc" },
  });

  const studentIds = classes.flatMap((cls) => cls.students.map((student) => student.id));
  const existingBills = await prisma.studentBill.findMany({
    where: { schoolId, feeStructureId, studentId: { in: studentIds } },
    select: { studentId: true },
  });
  const billedStudentIds = new Set(existingBills.map((bill) => bill.studentId));
  const classData = classes.map((cls) => {
    const alreadyBilled = cls.students.reduce(
      (count, student) => count + Number(billedStudentIds.has(student.id)),
      0,
    );
    return {
      id: cls.id,
      name: cls.name,
      studentCount: cls._count.students,
      alreadyBilled,
      newCount: cls._count.students - alreadyBilled,
    };
  });

  const mandatoryItems = structure.feeItems.filter((i) => !i.isOptional);
  const optionalItems  = structure.feeItems.filter((i) => i.isOptional);
  const mandatoryTotal = mandatoryItems.reduce((s, i) => s + Number(i.amount), 0);
  const optionalTotal  = optionalItems.reduce((s,  i) => s + Number(i.amount), 0);

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4 max-w-3xl">

      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            href={`/list/finance/fee-structures/${feeStructureId}`}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors shrink-0"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="w-11 h-11 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
            <Users size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tight">Generate Student Bills</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">
              {structure.title} · {structure.grade.level} · {TERM_LABELS[structure.term]} · {structure.academicYear}
            </p>
          </div>
        </div>
      </div>

      {/* Fee summary */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">
          What will be billed per student
        </p>
        <div className="flex flex-col gap-2">
          {mandatoryItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-50">
              <div>
                <p className="text-sm font-bold text-gray-700">{item.name}</p>
                <p className="text-[10px] text-gray-400">{item.category} · Mandatory</p>
              </div>
              <p className="text-sm font-black text-gray-800">{formatGHS(item.amount)}</p>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1">
            <p className="text-sm font-black text-gray-800">Mandatory Total</p>
            <p className="text-base font-black text-indigo-700">{formatGHS(mandatoryTotal)}</p>
          </div>
          {optionalItems.length > 0 && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
              <p className="text-xs font-black text-amber-700 mb-1">
                Optional items ({optionalItems.length}) — can be included
              </p>
              {optionalItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs text-amber-700 py-0.5">
                  <span>{item.name}</span>
                  <span className="font-bold">{formatGHS(item.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Generate form */}
      <GenerateBillsForm
        feeStructureId={feeStructureId}
        classes={classData}
        mandatoryTotal={mandatoryTotal}
        optionalTotal={optionalTotal}
        hasOptionalItems={optionalItems.length > 0}
      />
    </div>
  );
};

export default GenerateBillsPage;
