import Pagination from "@/src/components/pagination";
import { requirePageSession } from "@/src/lib/authz";
import TableSearch from "@/src/components/TableSearch";
import ParentInviteActions from "@/src/components/ParentInviteActions";
import ParentInviteModal from "@/src/components/ParentInviteModal";
import ParentWardLinkManager from "@/src/components/ParentWardLinkManager";
import Link from "next/link";
import { Clock3, History, Link2, UserCheck, Users } from "lucide-react";
import { Prisma } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { ITEM_PER_PAGE } from "@/src/lib/settings";
import { parentAccessAuditLabel } from "@/src/lib/formatters/parent-access-audit";

const tabs = [
  { key: "all", label: "Parents" },
  { key: "pending-invites", label: "Pending invites" },
] as const;

type ParentTab = (typeof tabs)[number]["key"];
type ParentInviteRow = Awaited<ReturnType<typeof prisma.parentInvite.findMany>>[number];
type ParentAccessAuditRow = Prisma.ParentAccessAuditLogGetPayload<{
  include: {
    parent: { select: { name: true; surname: true; email: true } };
    student: { select: { name: true; surname: true; class: { select: { name: true } } } };
  };
}>;
type ParentRow = Prisma.ParentGetPayload<{
  include: {
    studentRelationships: {
      include: {
        student: {
          select: {
            id: true;
            name: true;
            surname: true;
            class: { select: { name: true } };
          };
        };
      };
    };
  };
}>;

const ParentListPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { role, schoolId } = await requirePageSession();

  const { page, status, search } = await searchParams;
  const selectedStatus: ParentTab = status === "pending-invites" ? status : "all";
  const p = page ? parseInt(page) : 1;
  const searchTerm = search?.trim() ?? "";

  const parentQuery: Prisma.ParentWhereInput = { schoolId };
  const inviteQuery: Prisma.ParentInviteWhereInput = {
    schoolId,
    status: "PENDING",
    acceptedAt: null,
    revokedAt: null,
  };

  if (searchTerm) {
    parentQuery.OR = [
      { name: { contains: searchTerm, mode: "insensitive" } },
      { surname: { contains: searchTerm, mode: "insensitive" } },
      { email: { contains: searchTerm, mode: "insensitive" } },
      { phone: { contains: searchTerm, mode: "insensitive" } },
    ];

    inviteQuery.OR = [
      { name: { contains: searchTerm, mode: "insensitive" } },
      { surname: { contains: searchTerm, mode: "insensitive" } },
      { email: { contains: searchTerm, mode: "insensitive" } },
      { phone: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  const [
    parents,
    parentCount,
    pendingInvites,
    pendingInviteCount,
    totalParentCount,
    activeRelationshipCount,
    students,
    recentAuditLogs,
    parentAccessAuditCount,
  ] =
    await Promise.all([
      selectedStatus === "all"
        ? prisma.parent.findMany({
            where: parentQuery,
            include: {
              studentRelationships: {
                include: {
                  student: {
                    select: {
                      id: true,
                      name: true,
                      surname: true,
                      class: { select: { name: true } },
                    },
                  },
                },
                orderBy: [{ status: "asc" }, { createdAt: "asc" }],
              },
            },
            orderBy: [{ name: "asc" }, { surname: "asc" }],
            take: ITEM_PER_PAGE,
            skip: ITEM_PER_PAGE * (p - 1),
          })
        : [],
      prisma.parent.count({ where: parentQuery }),
      selectedStatus === "pending-invites"
        ? prisma.parentInvite.findMany({
            where: inviteQuery,
            orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }],
            take: ITEM_PER_PAGE,
            skip: ITEM_PER_PAGE * (p - 1),
          })
        : [],
      prisma.parentInvite.count({ where: inviteQuery }),
      prisma.parent.count({ where: { schoolId } }),
      prisma.parentStudentRelationship.count({
        where: { schoolId, status: "ACTIVE" },
      }),
      role === "admin"
        ? prisma.student.findMany({
            where: { schoolId },
            select: {
              id: true,
              name: true,
              surname: true,
              class: { select: { name: true } },
            },
            orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
          })
        : [],
      role === "admin"
        ? prisma.parentAccessAuditLog.findMany({
            where: { schoolId },
            include: {
              parent: { select: { name: true, surname: true, email: true } },
              student: { select: { name: true, surname: true, class: { select: { name: true } } } },
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          })
        : [],
      role === "admin" ? prisma.parentAccessAuditLog.count({ where: { schoolId } }) : 0,
    ]);

  const count = selectedStatus === "pending-invites" ? pendingInviteCount : parentCount;
  const studentOptions = students.map((student) => ({
    id: student.id,
    name: student.name,
    surname: student.surname,
    className: student.class?.name ?? "No class",
  }));

  return (
    <div className="m-4 mt-0 flex flex-1 flex-col gap-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight text-gray-800">
              Parent management
            </h1>
            <p className="mt-0.5 text-sm font-medium text-gray-400">
              Invite parents, link wards, and keep access controlled by school.
            </p>
          </div>
          <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
            <TableSearch />
            {role === "admin" && <ParentInviteModal students={studentOptions} />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Parents"
          value={totalParentCount}
          icon={<Users size={16} />}
          color="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          label="Pending invites"
          value={pendingInviteCount}
          icon={<Clock3 size={16} />}
          color="bg-violet-50 text-violet-600"
        />
        <StatCard
          label="Active ward links"
          value={activeRelationshipCount}
          icon={<Link2 size={16} />}
          color="bg-emerald-50 text-emerald-600"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const href = tab.key === "all" ? "/list/parents" : `/list/parents?status=${tab.key}`;
          const active = selectedStatus === tab.key;
          return (
            <a
              key={tab.key}
              href={href}
              className={`rounded-xl px-4 py-2 text-sm font-black transition ${
                active
                  ? "bg-edujay-primary text-white shadow-sm shadow-blue-100"
                  : "bg-white text-gray-500 ring-1 ring-gray-100 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </a>
          );
        })}
      </div>

      {selectedStatus === "pending-invites" ? (
        <PendingInviteTable invites={pendingInvites} searchTerm={searchTerm} />
      ) : (
        <ParentTable parents={parents} role={role} searchTerm={searchTerm} students={studentOptions} />
      )}

      {role === "admin" && <ParentAccessAuditTrail logs={recentAuditLogs} totalCount={parentAccessAuditCount} />}

      <Pagination page={p} count={count} />
    </div>
  );
};

function ParentAccessAuditTrail({ logs, totalCount }: { logs: ParentAccessAuditRow[]; totalCount: number }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-black text-gray-800">Access history preview</h2>
          <p className="text-sm font-medium text-gray-400">
            Showing the latest {logs.length} of {totalCount} parent access event{totalCount === 1 ? "" : "s"}.
          </p>
        </div>
        <Link
          href="/list/parents/audit"
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 sm:mt-0"
        >
          <History size={16} />
          View full history
        </Link>
      </div>

      <div className="mt-4 divide-y divide-gray-100">
        {logs.map((log) => {
          const parentName = log.parent
            ? `${log.parent.name} ${log.parent.surname}`.trim()
            : "Pending parent";
          const wardName = log.student
            ? `${log.student.name} ${log.student.surname}`.trim()
            : "No ward attached";

          return (
            <div key={log.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-black text-gray-800">{parentAccessAuditLabel(log.action)}</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-gray-500">
                  {parentName} · {wardName}
                  {log.student?.class?.name ? ` · ${log.student.class.name}` : ""}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs font-black text-gray-400">
                  {log.createdAt.toLocaleString("en-GH", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-gray-400">By {log.performedBy}</p>
              </div>
            </div>
          );
        })}
        {logs.length === 0 && (
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4 text-sm font-semibold text-gray-500">
            <History size={16} />
            No parent access changes have been recorded yet.
          </div>
        )}
      </div>
    </section>
  );
}
function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-black leading-none text-gray-800">{value}</p>
        <p className="mt-0.5 text-xs font-medium text-gray-400">{label}</p>
      </div>
    </div>
  );
}

function ParentTable({
  parents,
  role,
  searchTerm,
  students,
}: {
  parents: ParentRow[];
  role?: string;
  searchTerm: string;
  students: { id: string; name: string; surname: string; className: string }[];
}) {
  return (
    <div className="flex-1 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[460px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-4 py-3.5 text-left text-xs font-black uppercase tracking-wider text-gray-400">
                Parent
              </th>
              <th className="hidden px-3 py-3.5 text-left text-xs font-black uppercase tracking-wider text-gray-400 md:table-cell">
                Active wards
              </th>
              <th className="hidden px-3 py-3.5 text-left text-xs font-black uppercase tracking-wider text-gray-400 lg:table-cell">
                Phone
              </th>
              {role === "admin" && (
                <th className="w-[120px] px-4 py-3.5 text-right text-xs font-black uppercase tracking-wider text-gray-400">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {parents.map((parent) => {
              const activeRelationships = parent.studentRelationships.filter((relationship) => relationship.status === "ACTIVE");
              const wardNames = activeRelationships
                .map((relationship) => relationship.student)
                .filter(Boolean)
                .map((student) => `${student.name} ${student.surname}`.trim()) ?? [];

              return (
                <tr key={parent.id} className="transition-colors duration-150 hover:bg-indigo-50/30">
                  <td className="px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-800">
                        {parent.name} {parent.surname}
                      </p>
                      <p className="truncate text-xs text-gray-400">{parent.email}</p>
                      <p className="mt-1 text-xs font-semibold text-gray-500 md:hidden">
                        {wardNames.length > 0 ? wardNames.join(", ") : "No active ward link"}
                      </p>
                    </div>
                  </td>

                  <td className="hidden px-3 py-3.5 md:table-cell">
                    <span className="text-sm font-medium text-gray-500">
                      {wardNames.length > 0 ? wardNames.join(", ") : "No active ward link"}
                    </span>
                  </td>

                  <td className="hidden px-3 py-3.5 lg:table-cell">
                    <span className="text-sm font-medium text-gray-600">{parent.phone ?? "Not set"}</span>
                  </td>

                  {role === "admin" && (
                    <td className="w-[120px] px-4 py-4 align-top">
                      <div className="flex justify-end">
                        <ParentWardLinkManager parentId={parent.id} relationships={parent.studentRelationships} students={students} />
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {parents.length === 0 && (
              <tr>
                <td colSpan={role === "admin" ? 4 : 3} className="px-4 py-10 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-gray-400">
                    <UserCheck size={28} />
                    <p className="text-sm font-black text-gray-500">
                      {searchTerm ? "No parents match this search." : "No parent accounts yet."}
                    </p>
                    <p className="text-xs font-semibold">
                      Invite parents so Edujay can link each account to the right ward.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PendingInviteTable({
  invites,
  searchTerm,
}: {
  invites: ParentInviteRow[];
  searchTerm: string;
}) {
  const now = new Date();

  return (
    <div className="flex-1 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-4 py-3.5 text-left text-xs font-black uppercase tracking-wider text-gray-400">
                Parent invite
              </th>
              <th className="px-3 py-3.5 text-left text-xs font-black uppercase tracking-wider text-gray-400">
                Status
              </th>
              <th className="hidden px-3 py-3.5 text-left text-xs font-black uppercase tracking-wider text-gray-400 md:table-cell">
                Expires
              </th>
              <th className="hidden px-3 py-3.5 text-left text-xs font-black uppercase tracking-wider text-gray-400 lg:table-cell">
                Last sent
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-black uppercase tracking-wider text-gray-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {invites.map((invite) => {
              const expired = invite.expiresAt.getTime() <= now.getTime();
              return (
                <tr key={invite.id} className="transition-colors duration-150 hover:bg-indigo-50/30">
                  <td className="px-4 py-3.5">
                    <p className="truncate text-sm font-bold text-gray-800">
                      {invite.name} {invite.surname}
                    </p>
                    <p className="truncate text-xs text-gray-400">{invite.email}</p>
                    <p className="mt-1 text-xs font-semibold text-gray-500 md:hidden">
                      Expires {invite.expiresAt.toLocaleDateString("en-GH")}
                    </p>
                  </td>
                  <td className="px-3 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-black ${
                        expired ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-edujay-primary"
                      }`}
                    >
                      {expired ? "Expired" : "Pending"}
                    </span>
                  </td>
                  <td className="hidden px-3 py-3.5 text-sm font-semibold text-gray-500 md:table-cell">
                    {invite.expiresAt.toLocaleDateString("en-GH", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="hidden px-3 py-3.5 text-sm font-semibold text-gray-500 lg:table-cell">
                    {invite.lastSentAt
                      ? invite.lastSentAt.toLocaleDateString("en-GH", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Not sent"}
                  </td>
                  <td className="px-5 py-4">
                    <ParentInviteActions inviteId={invite.id} />
                  </td>
                </tr>
              );
            })}
            {invites.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-gray-400">
                    <Clock3 size={28} />
                    <p className="text-sm font-black text-gray-500">
                      {searchTerm ? "No pending invites match this search." : "No pending parent invites."}
                    </p>
                    <p className="text-xs font-semibold">
                      New parent access should start from a secure invite, not manual login sharing.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ParentListPage;