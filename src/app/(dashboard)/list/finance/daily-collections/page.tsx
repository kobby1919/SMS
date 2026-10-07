import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Banknote, CheckCircle2, Clock, ShieldCheck, Users } from "lucide-react";
import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import DailyCollectionSetupPanel from "@/src/components/DailyCollectionSetupPanel";
import DailyCollectionReviewPanel from "@/src/components/DailyCollectionReviewPanel";
import { FEE_CATEGORY_LABELS, formatGHS } from "@/src/lib/constants/finance";
import { getDailyCollectionReport } from "@/src/lib/services/daily-collection-report";

export const dynamic = "force-dynamic";

export default async function DailyCollectionsSetupPage() {
  const { schoolId } = await requirePageSession(["admin", "bursar"]);

  const [collectionTypes, activeCollectorCount, auditCount, reviewSessions, report] = await Promise.all([
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
    getDailyCollectionReport(schoolId),
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

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-emerald-600">Today&apos;s Daily Collection Report</p>
            <h2 className="mt-1 text-lg font-black text-gray-900">
              {report.date.toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-gray-500">
              Confirmed money is separated from submitted or flagged sessions so bursars never confuse unchecked collector totals with trusted revenue.
            </p>
          </div>
          <Link
            href="/collector"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-black text-gray-700 transition hover:bg-gray-50"
          >
            Collector workspace
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ReportTile
            icon={<CheckCircle2 size={16} />}
            label="Confirmed today"
            value={formatGHS(report.summary.confirmedAmount)}
            detail={`${report.byStatus.CONFIRMED} confirmed session${report.byStatus.CONFIRMED === 1 ? "" : "s"}`}
            tone="bg-emerald-50 text-emerald-700"
          />
          <ReportTile
            icon={<Clock size={16} />}
            label="Needs review"
            value={report.byStatus.SUBMITTED + report.byStatus.FLAGGED}
            detail={`${report.byStatus.SUBMITTED} submitted - ${report.byStatus.FLAGGED} flagged`}
            tone="bg-amber-50 text-amber-700"
          />
          <ReportTile
            icon={<Users size={16} />}
            label="Unpaid follow-up"
            value={report.summary.unpaidEntries}
            detail={`${formatGHS(report.summary.unpaidAmount)} after submission`}
            tone="bg-rose-50 text-rose-700"
          />
          <ReportTile
            icon={<Banknote size={16} />}
            label="Reported by collectors"
            value={formatGHS(report.summary.reportedAmount)}
            detail="Not counted as confirmed until reviewed"
            tone="bg-blue-50 text-blue-700"
          />
        </div>

        {!report.hasActivity ? (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
            <p className="text-sm font-black text-gray-800">No daily collection session has been opened today.</p>
            <p className="mt-1 text-sm font-semibold text-gray-400">
              Once an assigned collector opens a session, Edujay will show paid, unpaid, excused, submitted, and confirmed totals here.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-gray-900">Collection types today</h3>
                  <p className="text-xs font-semibold text-gray-400">Confirmed, submitted, and in-progress totals by setup.</p>
                </div>
                <Banknote size={17} className="text-emerald-600" />
              </div>
              <div className="mt-3 space-y-2">
                {report.byType.map((item) => (
                  <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-black text-gray-900">{item.name}</p>
                        <p className="mt-0.5 text-xs font-semibold text-gray-400">
                          {FEE_CATEGORY_LABELS[item.category] ?? item.category} - {item.sessionCount} session{item.sessionCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                        {formatGHS(item.confirmedAmount)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 min-[520px]:grid-cols-5">
                      <MiniReportStat label="Reported" value={formatGHS(item.reportedAmount)} />
                      <MiniReportStat label="Paid" value={item.paidEntries} />
                      <MiniReportStat label="Follow-up" value={item.unpaidEntries} />
                      <MiniReportStat label="In progress" value={item.inProgressUnpaidEntries} />
                      <MiniReportStat label="Review" value={item.sessionsNeedingReview} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-gray-900">Unpaid daily follow-up</h3>
                  <p className="text-xs font-semibold text-gray-400">Only submitted, confirmed, or flagged sessions appear here.</p>
                </div>
                <AlertTriangle size={17} className="text-rose-500" />
              </div>
              <div className="mt-3 space-y-2">
                {report.unpaidList.length === 0 ? (
                  <p className="rounded-xl bg-gray-50 p-4 text-sm font-semibold text-gray-400">
                    No unpaid submitted daily collection entries for today.
                  </p>
                ) : (
                  report.unpaidList.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-gray-100 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-gray-900">{entry.studentName}</p>
                          <p className="text-xs font-semibold text-gray-400">
                            {entry.className} - {entry.collectionTypeName} - {entry.collectorName}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700">
                          {formatGHS(entry.amountExpected)}
                        </span>
                      </div>
                      <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
                        {entry.parentContact
                          ? `${entry.parentContact.name} - ${entry.parentContact.phone || entry.parentContact.email || "No phone or email saved"}`
                          : "No active fee-visible parent contact saved"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
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

function ReportTile({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  detail: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-gray-400">{label}</p>
          <p className="mt-2 truncate text-2xl font-black leading-none text-gray-900">{value}</p>
          <p className="mt-1 text-xs font-semibold text-gray-500">{detail}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function MiniReportStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-gray-900">{value}</p>
    </div>
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
