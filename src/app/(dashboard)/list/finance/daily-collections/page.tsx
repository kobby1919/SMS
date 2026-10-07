import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, ShieldCheck, Users } from "lucide-react";
import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import DailyCollectionSetupPanel from "@/src/components/DailyCollectionSetupPanel";
import DailyCollectionReviewPanel from "@/src/components/DailyCollectionReviewPanel";

export const dynamic = "force-dynamic";

export default async function DailyCollectionsSetupPage() {
  const { schoolId } = await requirePageSession(["admin", "bursar"]);

  const [collectionTypes, activeCollectorCount, auditCount, reviewSessions] = await Promise.all([
    prisma.dailyCollectionType.findMany({
      where: { schoolId },
      include: {
        collectors: {
          select: {
            collector: {
              select: { id: true, name: true, surname: true, status: true },
            },
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    }),
    prisma.collector.count({ where: { schoolId, status: "ACTIVE" } }),
    prisma.dailyCollectionAuditLog.count({ where: { schoolId } }),
    prisma.dailyCollectionSession.findMany({
      where: { schoolId },
      include: {
        collectionType: { select: { name: true, category: true } },
        collector: { select: { name: true, surname: true } },
        _count: { select: { entries: true } },
      },
      orderBy: [{ status: "asc" }, { collectionDate: "desc" }, { createdAt: "desc" }],
      take: 20,
    }),
  ]);

  return (
    <main className="flex-1 m-4 mt-0 flex flex-col gap-4">
      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <Link
              href="/list/finance"
              className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 transition hover:bg-gray-200"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-blue-500">Finance Setup</p>
              <h1 className="mt-1 text-xl font-black tracking-tight text-gray-900 sm:text-2xl">
                Daily Collections
              </h1>
              <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-gray-500">
                Configure collections that happen daily outside student term bills. Examples: feeding collected at the gate, daily transport, or one-day levy collection.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[420px]">
            <SummaryTile icon={<Banknote size={15} />} label="Setups" value={collectionTypes.length} />
            <SummaryTile icon={<Users size={15} />} label="Collectors" value={activeCollectorCount} />
            <SummaryTile icon={<ShieldCheck size={15} />} label="Audit logs" value={auditCount} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-sm font-black text-blue-900">Daily collection control rule</p>
        <p className="mt-1 text-sm font-semibold leading-6 text-blue-800">
          Setup defines what can be collected. Collector sessions record what was collected. Bursar confirmation locks the session only after the received amount is checked.
        </p>
      </section>

      <DailyCollectionReviewPanel
        sessions={reviewSessions.map((session) => ({
          id: session.id,
          collectionDate: session.collectionDate.toISOString(),
          status: session.status,
          expectedAmount: Number(session.expectedAmount),
          reportedAmount: Number(session.reportedAmount),
          confirmedAmount: session.confirmedAmount === null ? null : Number(session.confirmedAmount),
          mismatchReason: session.mismatchReason,
          collectionType: session.collectionType,
          collector: session.collector,
          counts: { entries: session._count.entries },
        }))}
      />

      <DailyCollectionSetupPanel
        collectionTypes={collectionTypes.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          amount: Number(item.amount),
          description: item.description,
          isActive: item.isActive,
          requiresBursarConfirmation: item.requiresBursarConfirmation,
          collectors: item.collectors,
        }))}
        activeCollectorCount={activeCollectorCount}
      />
    </main>
  );
}

function SummaryTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
      <div className="flex items-center gap-2 text-gray-400">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 text-xl font-black text-gray-900">{value}</p>
    </div>
  );
}
