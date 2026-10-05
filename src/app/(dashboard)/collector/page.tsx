import { Banknote, ClipboardCheck, ShieldCheck } from "lucide-react";
import WelcomeBanner from "@/src/components/WelcomeBanner";
import { requirePageSession } from "@/src/lib/authz";
import { formatGHS } from "@/src/lib/constants/finance";
import prisma from "@/src/lib/prisma";

export const dynamic = "force-dynamic";

function titledName(collector: { name: string; sex: "MALE" | "FEMALE" }) {
  const title = collector.sex === "FEMALE" ? "Ms." : "Mr.";
  return `${title} ${collector.name}`.trim();
}

export default async function CollectorDashboardPage() {
  const { userId, schoolId } = await requirePageSession(["collector"]);

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
            <p className="text-sm font-black text-blue-900">Collector workspace is being prepared</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-blue-800">
              Edujay can now recognize collector accounts and assigned daily collection setup. Opening today&apos;s session and marking students paid begins in the next step.
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
            Setup only
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {collector.collectionTypes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center md:col-span-2 xl:col-span-3">
              <p className="text-sm font-black text-gray-800">No assigned daily collection setup yet.</p>
              <p className="mt-1 text-sm font-semibold text-gray-400">
                When the bursar assigns feeding or another daily collection type to you, it will appear here.
              </p>
            </div>
          ) : (
            collector.collectionTypes.map(({ collectionType }) => (
              <article key={collectionType.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-gray-900">{collectionType.name}</p>
                    <p className="mt-1 text-xs font-semibold text-gray-400">{collectionType.category}</p>
                  </div>
                  <Banknote className="h-5 w-5 shrink-0 text-blue-600" />
                </div>
                <p className="mt-3 text-xl font-black text-gray-900">{formatGHS(collectionType.amount)}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-gray-500">
                  {collectionType.requiresBursarConfirmation
                    ? "Bursar confirmation required after collection."
                    : "Bursar confirmation not required for this setup."}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
