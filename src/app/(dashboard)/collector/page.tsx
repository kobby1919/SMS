import { ClipboardCheck, ShieldCheck } from "lucide-react";
import WelcomeBanner from "@/src/components/WelcomeBanner";
import DailyCollectionCollectorPanel from "@/src/components/DailyCollectionCollectorPanel";
import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";

export const dynamic = "force-dynamic";

function titledName(collector: { name: string; sex: "MALE" | "FEMALE" }) {
  const title = collector.sex === "FEMALE" ? "Ms." : "Mr.";
  return `${title} ${collector.name}`.trim();
}

export default async function CollectorDashboardPage() {
  const { userId, schoolId } = await requirePageSession(["collector"]);
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00.000Z`);

  const collector = await prisma.collector.findFirst({
    where: { id: userId, schoolId, status: "ACTIVE" },
    include: {
      collectionTypes: {
        where: { collectionType: { isActive: true, schoolId } },
        include: { collectionType: true },
        orderBy: { assignedAt: "desc" },
      },
    },
  });

  if (!collector) {
    return (
      <main className="flex-1 m-4 mt-0">
        <section className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
          <p className="text-sm font-black text-amber-900">Collector access is not active</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-amber-800">
            Ask the school admin or bursar to confirm your collector access before using daily collections.
          </p>
        </section>
      </main>
    );
  }

  const sessions = await prisma.dailyCollectionSession.findMany({
    where: { schoolId, collectorId: collector.id, collectionDate: today },
    include: {
      entries: {
        include: {
          student: {
            select: {
              id: true,
              name: true,
              surname: true,
              admissionNumber: true,
              class: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="flex-1 m-4 mt-0 flex flex-col gap-4">
      <WelcomeBanner
        role="collector"
        name={titledName(collector)}
        subtitle="Daily collection workspace"
        tag={`${collector.collectionTypes.length} assigned setup${collector.collectionTypes.length === 1 ? "" : "s"}`}
      />

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
          <div>
            <p className="text-sm font-black text-blue-900">Daily collection workflow</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-blue-800">
              Open today&apos;s assigned session, mark each active student paid, unpaid, or excused, then submit the total for bursar confirmation.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">Assigned Collections</p>
            <h1 className="mt-1 text-lg font-black text-gray-900">What you are allowed to collect</h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-black text-gray-500">
            <ClipboardCheck size={14} />
            Today
          </div>
        </div>
      </section>

      <DailyCollectionCollectorPanel
        collectionTypes={collector.collectionTypes.map(({ collectionType }) => ({
          id: collectionType.id,
          name: collectionType.name,
          category: collectionType.category,
          amount: Number(collectionType.amount),
          requiresBursarConfirmation: collectionType.requiresBursarConfirmation,
        }))}
        sessions={sessions.map((session) => ({
          id: session.id,
          collectionDate: session.collectionDate.toISOString(),
          status: session.status,
          expectedAmount: Number(session.expectedAmount),
          reportedAmount: Number(session.reportedAmount),
          confirmedAmount: session.confirmedAmount === null ? null : Number(session.confirmedAmount),
          mismatchReason: session.mismatchReason,
          collectionTypeId: session.collectionTypeId,
          entries: session.entries.map((entry) => ({
            id: entry.id,
            status: entry.status,
            amountExpected: Number(entry.amountExpected),
            amountCollected: Number(entry.amountCollected),
            note: entry.note,
            student: entry.student,
          })),
        }))}
      />
    </main>
  );
}
