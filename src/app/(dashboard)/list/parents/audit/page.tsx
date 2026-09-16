import Link from "next/link";
import Pagination from "@/src/components/pagination";
import TableSearch from "@/src/components/TableSearch";
import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import { ITEM_PER_PAGE } from "@/src/lib/settings";
import { parentAccessAuditLabel } from "@/src/lib/formatters/parent-access-audit";
import type { ParentAccessAuditAction, Prisma } from "@/src/generated/prisma";
import { ArrowLeft, History, ShieldCheck } from "lucide-react";

const auditActions = [
  "PARENT_INVITED",
  "PARENT_ACCOUNT_ACTIVATED",
  "CHILD_LINKED",
  "CHILD_REMOVED",
  "ACCESS_REVOKED",
  "ACCESS_RESTORED",
  "CHILD_TRANSFERRED",
  "CHILD_GRADUATED",
  "EMAIL_CHANGED",
] as const satisfies readonly ParentAccessAuditAction[];

type AuditActionFilter = (typeof auditActions)[number];

function isAuditAction(value?: string): value is AuditActionFilter {
  return auditActions.includes(value as AuditActionFilter);
}

function actionHref(action?: string, search?: string) {
  const params = new URLSearchParams();
  if (action) params.set("action", action);
  if (search) params.set("search", search);
  const next = params.toString();
  return next ? `/list/parents/audit?${next}` : "/list/parents/audit";
}

const ParentAccessAuditPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; action?: string }>;
}) => {
  const { schoolId } = await requirePageSession(["admin"]);
  const params = await searchParams;
  const page = params.page ? Number.parseInt(params.page, 10) : 1;
  const p = Number.isFinite(page) && page > 0 ? page : 1;
  const searchTerm = params.search?.trim() ?? "";
  const selectedAction = isAuditAction(params.action) ? params.action : undefined;

  const where: Prisma.ParentAccessAuditLogWhereInput = { schoolId };

  if (selectedAction) {
    where.action = selectedAction;
  }

  if (searchTerm) {
    where.OR = [
      { parent: { name: { contains: searchTerm, mode: "insensitive" } } },
      { parent: { surname: { contains: searchTerm, mode: "insensitive" } } },
      { parent: { email: { contains: searchTerm, mode: "insensitive" } } },
      { student: { name: { contains: searchTerm, mode: "insensitive" } } },
      { student: { surname: { contains: searchTerm, mode: "insensitive" } } },
      { performedBy: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  const [logs, count] = await Promise.all([
    prisma.parentAccessAuditLog.findMany({
      where,
      include: {
        parent: { select: { name: true, surname: true, email: true } },
        student: { select: { name: true, surname: true, class: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
    }),
    prisma.parentAccessAuditLog.count({ where }),
  ]);

  return (
    <div className="m-4 mt-0 flex flex-1 flex-col gap-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <Link
              href="/list/parents"
              className="inline-flex items-center gap-2 text-sm font-black text-gray-500 transition hover:text-edujay-primary"
            >
              <ArrowLeft size={15} />
              Back to parents
            </Link>
            <div className="mt-4 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-700">
                <History size={18} />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-gray-800">
                  Parent access history
                </h1>
                <p className="mt-1 max-w-2xl text-sm font-medium text-gray-400">
                  Search and review every parent invite, ward link, access change, and sensitive profile update.
                </p>
              </div>
            </div>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <TableSearch />
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <Link
            href={actionHref(undefined, searchTerm)}
            className={`rounded-xl px-3 py-2 text-xs font-black transition ${
              !selectedAction
                ? "bg-edujay-primary text-white"
                : "bg-gray-50 text-gray-500 ring-1 ring-gray-100 hover:bg-gray-100"
            }`}
          >
            All actions
          </Link>
          {auditActions.map((action) => (
            <Link
              key={action}
              href={actionHref(action, searchTerm)}
              className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                selectedAction === action
                  ? "bg-edujay-primary text-white"
                  : "bg-gray-50 text-gray-500 ring-1 ring-gray-100 hover:bg-gray-100"
              }`}
            >
              {parentAccessAuditLabel(action)}
            </Link>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-black text-gray-800">Audit events</h2>
            <p className="text-sm font-semibold text-gray-400">
              {count} event{count === 1 ? "" : "s"} found.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
            <ShieldCheck size={14} />
            School-scoped history
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {logs.map((log) => {
            const parentName = log.parent
              ? `${log.parent.name} ${log.parent.surname}`.trim()
              : "Pending parent";
            const wardName = log.student
              ? `${log.student.name} ${log.student.surname}`.trim()
              : "No ward attached";

            return (
              <article key={log.id} className="grid gap-3 p-4 md:grid-cols-[1.4fr_1fr_auto] md:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-black text-gray-800">{parentAccessAuditLabel(log.action)}</p>
                  <p className="mt-1 text-sm font-semibold text-gray-500">
                    {parentName}
                    {log.parent?.email ? ` - ${log.parent.email}` : ""}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wide text-gray-300">Ward</p>
                  <p className="mt-1 text-sm font-semibold text-gray-500">
                    {wardName}
                    {log.student?.class?.name ? ` - ${log.student.class.name}` : ""}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-xs font-black text-gray-400">
                    {log.createdAt.toLocaleString("en-GH", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-gray-400">By {log.performedBy}</p>
                </div>
              </article>
            );
          })}

          {logs.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-50 text-gray-500">
                <History size={18} />
              </div>
              <p className="text-sm font-black text-gray-700">No matching access history</p>
              <p className="max-w-md text-sm font-medium text-gray-400">
                Try clearing the search or choosing a different action filter.
              </p>
            </div>
          )}
        </div>
      </section>

      <Pagination page={p} count={count} />
    </div>
  );
};

export default ParentAccessAuditPage;
