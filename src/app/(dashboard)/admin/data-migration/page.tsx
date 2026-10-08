import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  GraduationCap,
  ReceiptText,
  School,
  ShieldCheck,
  Upload,
  Users,
  WalletCards,
} from "lucide-react";
import { requirePageSession } from "@/src/lib/authz";
import DataMigrationMapper from "@/src/components/DataMigrationMapper";
import MigrationInventoryPanel from "@/src/components/MigrationInventoryPanel";
import { getMigrationInventory } from "@/src/lib/services/migration-inventory";
import MigrationAuditActions from "@/src/components/MigrationAuditActions";
import PostImportInvitePanel from "@/src/components/PostImportInvitePanel";
import SetupAdvanceButton from "@/src/components/SetupAdvanceButton";
import {
  getDataMigrationDashboard,
  type MigrationAreaStatus,
} from "@/src/lib/services/data-migration";
import { getPostImportInviteSummary } from "@/src/lib/services/post-import-invites";
import { setupPathForStep } from "@/src/lib/onboarding/setup-stages";
import { getSchoolOnboardingState } from "@/src/lib/services/onboarding";

const statusMeta: Record<MigrationAreaStatus, { label: string; className: string }> = {
  NOT_STARTED: {
    label: "Not started",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
  HAS_RECORDS: {
    label: "Has records",
    className: "border-blue-100 bg-blue-50 text-blue-700",
  },
  NEEDS_CLEANUP: {
    label: "Needs review",
    className: "border-amber-100 bg-amber-50 text-amber-800",
  },
  READY_FOR_INVITES: {
    label: "Invite review",
    className: "border-violet-100 bg-violet-50 text-violet-700",
  },
  OPERATIONAL: {
    label: "Operational",
    className: "border-emerald-100 bg-emerald-50 text-emerald-700",
  },
};

const areaIcons = {
  students: GraduationCap,
  parents: Users,
  teachers: BookOpen,
  bursars: WalletCards,
  classes: School,
  subjects: BookOpen,
  fees: ReceiptText,
};

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export async function DataMigrationWorkspace({
  schoolId,
  setupContext = "dashboard",
}: {
  schoolId: string;
  setupContext?: "dashboard" | "onboarding";
}) {
  const [dashboard, inviteSummary, inventory] = await Promise.all([
    getDataMigrationDashboard(schoolId),
    getPostImportInviteSummary(schoolId),
    getMigrationInventory(schoolId),
  ]);

  const isFreshSchool = dashboard.isFreshSchool;
  const showStarterGuide = isFreshSchool && setupContext === "dashboard";

  const attentionCount = dashboard.areas.filter((area) =>
    area.status === "NEEDS_CLEANUP" || area.status === "NOT_STARTED"
  ).length;

  const starterSteps = [
    {
      title: "Set up classes",
      copy: "Create the class names the school already uses before importing students.",
      href: "/list/classes",
      icon: School,
    },
    {
      title: "Set up subjects",
      copy: "Add the curriculum subjects before teacher capability or CA setup.",
      href: "/list/subjects",
      icon: BookOpen,
    },
    {
      title: "Import students",
      copy: "Bring admission records and class placement in after the foundation exists.",
      href: "/list/students/import",
      icon: GraduationCap,
    },
    {
      title: "Link parents",
      copy: "Create guardian profiles and connect each parent to the right ward.",
      href: "/list/parents",
      icon: Users,
    },
    {
      title: "Invite staff",
      copy: "Import or invite teachers and bursars only after profile data is clean.",
      href: "/list/teachers",
      icon: FileSpreadsheet,
    },
    {
      title: "Set up fees",
      copy: "Prepare fee structures and balances before parents see finance records.",
      href: "/list/finance/fee-structures",
      icon: ReceiptText,
    },
  ];
  const migrationWorkflow = [
    ["Upload", "Choose the record type, download the template if needed, and upload the school's CSV."],
    ["Map columns", "Match the spreadsheet headers to Edujay's required fields before validation."],
    ["Review issues", "Check missing fields, duplicates, invalid classes, risky links, and skipped rows."],
    ["Import clean records", "Only clean rows enter the live school records; problem rows stay out."],
    ["Send invites", "After profiles and links are reviewed, send secure invites to teachers, parents, and bursars."],
  ];

  return (
    <main className="m-4 mt-0 flex flex-1 flex-col gap-4">
      <section className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white shadow-sm sm:p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-100">
              <Database size={14} />
              School data setup
            </div>
            <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">
              {isFreshSchool ? "Start School Data Setup" : "School Data Migration"}
            </h1>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
              {isFreshSchool
                ? "Use this page to bring an existing school into Edujay in the right order: classes and subjects first, then students, guardians, staff, fees, and secure login invites."
                : "Review the school records already in Edujay, upload spreadsheet data, validate it, and import only clean rows into the live system."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:w-[420px]">
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-2xl font-black">{dashboard.totals.students}</p>
              <p className="mt-1 break-words text-[10px] font-black uppercase leading-snug text-slate-300">
                Existing students
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-2xl font-black">{dashboard.totals.pendingInvites}</p>
              <p className="mt-1 break-words text-[10px] font-black uppercase leading-snug text-slate-300">
                Pending invites
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-2xl font-black">{attentionCount}</p>
              <p className="mt-1 break-words text-[10px] font-black uppercase leading-snug text-slate-300">
                {isFreshSchool ? "Setup areas to start" : "Areas needing attention"}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-2xl font-black">{dashboard.totals.importLogs}</p>
              <p className="mt-1 break-words text-[10px] font-black uppercase leading-snug text-slate-300">
                Import audit logs
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Classes", value: dashboard.totals.classes, icon: School },
          { label: "Subjects", value: dashboard.totals.subjects, icon: BookOpen },
          { label: "Existing parents", value: dashboard.totals.parents, icon: Users },
          { label: "Existing bills", value: dashboard.totals.bills, icon: ReceiptText },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex min-w-0 items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 sm:h-10 sm:w-10">
                <Icon size={17} />
              </span>
              <div className="min-w-0">
                <p className="text-xl font-black leading-none text-gray-900">{stat.value}</p>
                <p className="mt-0.5 break-words text-xs font-bold uppercase leading-snug text-gray-400">
                  {stat.label}
                </p>
              </div>
            </div>
          );
        })}
      </section>

      {showStarterGuide ? (
        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-700">
                <ShieldCheck size={14} />
                Fresh school
              </div>
              <h2 className="mt-3 text-lg font-black text-blue-950">No records imported yet. Start in this order.</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-blue-800">
                For a new school, this page is a starter checklist. Edujay should build the foundation first, then import records, then send login invites.
              </p>
            </div>
            <Link href="/list/classes" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-xs font-black text-white transition hover:bg-blue-800 sm:w-auto">
              Start with classes
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {starterSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Link
                  key={step.title}
                  href={step.href}
                  className="group rounded-2xl border border-blue-100 bg-white p-4 transition hover:border-blue-200 hover:shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <Icon size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-wide text-blue-600">Step {index + 1}</p>
                      <p className="mt-1 text-sm font-black text-gray-950">{step.title}</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">{step.copy}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-gray-900">Migration checklist</h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-gray-500">
              Edujay keeps migration simple: upload, map, review, import, then invite. The counts above are records already inside Edujay, not rows in the file you are previewing.
            </p>
          </div>
          <Upload size={20} className="shrink-0 text-blue-700" />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {migrationWorkflow.map(([title, copy], index) => (
            <div key={title} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs font-black text-blue-700">Step {index + 1}</p>
              <p className="mt-2 text-sm font-black text-gray-900">{title}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <MigrationInventoryPanel initial={inventory} />
      <DataMigrationMapper />

      <PostImportInvitePanel summary={inviteSummary} />

      <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-black text-emerald-950">Ready to review onboarding?</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-emerald-800">
              After imports and secure invites are reviewed, return to the readiness review before opening the live dashboard.
            </p>
          </div>
          <SetupAdvanceButton
            target="review"
            label="Go to readiness review"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-xs font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>
            {isFreshSchool
              ? "Start with classes and subjects before importing students. Login invites should be sent only after student records, guardian links, and staff profiles have been reviewed."
              : "Rows with errors or warnings are kept outside the live system. Review the readiness cards below before sending login invites."}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-black text-gray-900">
          {isFreshSchool ? "Migration areas waiting for setup" : "Existing Edujay data readiness"}
        </h2>
        <p className="max-w-3xl text-sm font-semibold leading-6 text-gray-500">
          {isFreshSchool
            ? "These cards show the record groups Edujay will protect during migration. They are empty now because this school is starting fresh."
            : "These cards check what is already inside Edujay and highlight cleanup work before more records or invites are added."}
        </p>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {dashboard.areas.map((area) => {
          const Icon = areaIcons[area.key];
          const meta = statusMeta[area.status];
          return (
            <article key={area.key} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-black text-gray-900">{area.title}</h2>
                    <p className="mt-1 text-sm font-medium leading-6 text-gray-500">
                      {area.description}
                    </p>
                  </div>
                </div>
                <span className={`w-fit shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${meta.className}`}>
                  {meta.label}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
                <div className="min-w-0 rounded-xl bg-gray-50 p-3">
                  <p className="text-lg font-black text-gray-900">{area.primaryCount}</p>
                  <p className="mt-0.5 break-words text-[10px] font-black uppercase leading-snug text-gray-400">
                    {area.primaryLabel}
                  </p>
                </div>
                <div className="min-w-0 rounded-xl bg-gray-50 p-3">
                  <p className="text-lg font-black text-gray-900">{area.secondaryCount}</p>
                  <p className="mt-0.5 break-words text-[10px] font-black uppercase leading-snug text-gray-400">
                    {area.secondaryLabel}
                  </p>
                </div>
                <div className="min-w-0 rounded-xl bg-gray-50 p-3">
                  <p className={area.riskCount > 0 ? "text-lg font-black text-amber-700" : "text-lg font-black text-gray-900"}>
                    {area.riskCount}
                  </p>
                  <p className="mt-0.5 break-words text-[10px] font-black uppercase leading-snug text-gray-400">
                    {area.riskLabel}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                  Next action
                </p>
                <p className="mt-1 text-sm font-black leading-6 text-gray-800">{area.nextAction}</p>
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-blue-700" />
            <h2 className="text-base font-black text-gray-900">Recent import records</h2>
          </div>
          <div className="mt-4 grid gap-2 lg:grid-cols-2">
            {dashboard.recentImportLogs.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-3 py-3 text-sm font-semibold leading-6 text-gray-500">
                No import activity has been recorded for this school yet.
              </p>
            ) : (
              dashboard.recentImportLogs.map((log) => (
                <div
                  key={log.id}
                  className={`rounded-xl px-3 py-3 ${
                    log.isProblematic
                      ? "border border-amber-100 bg-amber-50"
                      : "bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-black text-gray-900">
                        {log.fileName ?? "Recorded import"}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-gray-500">
                        {log.importType ?? "Import"} · {log.rowCount ?? 0} rows
                      </p>
                      {log.batchId ? (
                        <p className="mt-1 break-all text-[10px] font-bold uppercase tracking-wide text-gray-400">
                          Batch {log.batchId}
                        </p>
                      ) : null}
                    </div>
                    {log.isProblematic ? (
                      <AlertTriangle size={15} className="shrink-0 text-amber-600" />
                    ) : (
                      <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      ["Imported", log.importedRows ?? 0],
                      ["Skipped", log.skippedRows ?? 0],
                      ["Issues", log.errorCount ?? 0],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-white px-2 py-2 ring-1 ring-gray-100">
                        <p className="text-sm font-black text-gray-950">{value}</p>
                        <p className="mt-0.5 text-[9px] font-black uppercase tracking-wide text-gray-400">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>
                  <MigrationAuditActions
                    auditLogId={log.id}
                    hasErrors={(log.errorCount ?? 0) > 0}
                    isProblematic={log.isProblematic}
                  />
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    {log.status ?? "Recorded"} · {formatDateTime(log.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
      </section>
    </main>
  );
}

export default async function DataMigrationPage() {
  const { schoolId } = await requirePageSession(["admin"]);
  const school = await getSchoolOnboardingState(schoolId);

  if (!school) {
    redirect("/sign-in?error=missing_school");
  }

  if (!school.code) {
    redirect("/onboarding/setup");
  }

  if (school.onboardingStatus !== "COMPLETED") {
    if (school.setupStep === "migration") {
      redirect("/onboarding/setup/migration");
    }

    redirect(setupPathForStep(school.setupStep));
  }

  return <DataMigrationWorkspace schoolId={schoolId} />;
}
