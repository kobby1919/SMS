import Pagination from "@/src/components/pagination";
import TableSearch from "@/src/components/TableSearch";
import BursarInviteActions from "@/src/components/BursarInviteActions";
import BursarInviteModal from "@/src/components/BursarInviteModal";
import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import { ITEM_PER_PAGE } from "@/src/lib/settings";
import type { Prisma } from "@/src/generated/prisma";
import Link from "next/link";
import { CheckCircle2, Clock3, ShieldCheck, UserRoundCheck, WalletCards } from "lucide-react";

type BursarTab = "all" | "active" | "suspended" | "pending-invites";
type BursarInviteRow = Awaited<ReturnType<typeof prisma.bursarInvite.findMany>>[number];
type BursarRow = Awaited<ReturnType<typeof prisma.bursar.findMany>>[number];

const tabs: Array<{ key: BursarTab; label: string }> = [
  { key: "all", label: "All bursars" },
  { key: "active", label: "Active" },
  { key: "suspended", label: "Suspended" },
  { key: "pending-invites", label: "Pending invites" },
];

function statusHref(status: BursarTab, searchTerm?: string) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (searchTerm) params.set("search", searchTerm);
  const next = params.toString();
  return next ? `/list/bursars?${next}` : "/list/bursars";
}

const BursarListPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; search?: string }>;
}) => {
  const { schoolId } = await requirePageSession(["admin"]);
  const params = await searchParams;
  const page = params.page ? Number.parseInt(params.page, 10) : 1;
  const p = Number.isFinite(page) && page > 0 ? page : 1;
  const selectedStatus: BursarTab =
    params.status === "active" ||
    params.status === "suspended" ||
    params.status === "pending-invites"
      ? params.status
      : "all";
  const searchTerm = params.search?.trim() ?? "";

  const bursarQuery: Prisma.BursarWhereInput = { schoolId };
  const inviteQuery: Prisma.BursarInviteWhereInput = {
    schoolId,
    status: "PENDING",
    acceptedAt: null,
    revokedAt: null,
  };

  if (selectedStatus === "active") bursarQuery.status = "ACTIVE";
  if (selectedStatus === "suspended") bursarQuery.status = "SUSPENDED";

  if (searchTerm) {
    bursarQuery.OR = [
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
      { staffId: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  const now = new Date();
  const [bursars, bursarCount, activeCount, suspendedCount, pendingInviteRows, pendingInviteListCount, pendingInviteCount] =
    await Promise.all([
      selectedStatus !== "pending-invites"
        ? prisma.bursar.findMany({
            where: bursarQuery,
            orderBy: [{ name: "asc" }, { surname: "asc" }],
            take: ITEM_PER_PAGE,
            skip: ITEM_PER_PAGE * (p - 1),
          })
        : [],
      prisma.bursar.count({ where: bursarQuery }),
      prisma.bursar.count({ where: { schoolId, status: "ACTIVE" } }),
      prisma.bursar.count({ where: { schoolId, status: "SUSPENDED" } }),
      selectedStatus === "pending-invites"
        ? prisma.bursarInvite.findMany({
            where: inviteQuery,
            orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }],
            take: ITEM_PER_PAGE,
            skip: ITEM_PER_PAGE * (p - 1),
          })
        : [],
      prisma.bursarInvite.count({ where: inviteQuery }),
      prisma.bursarInvite.count({
        where: {
          schoolId,
          status: "PENDING",
          acceptedAt: null,
          revokedAt: null,
        },
      }),
    ]);

  const count = selectedStatus === "pending-invites" ? pendingInviteListCount : bursarCount;

  return (
    <div className="m-4 mt-0 flex flex-1 flex-col gap-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight text-gray-800">Bursar management</h1>
            <p className="mt-0.5 text-sm font-medium text-gray-500">
              Invite the school bursar and keep finance access controlled.
            </p>
          </div>
          <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
            <TableSearch />
            <BursarInviteModal />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active bursars" value={activeCount} icon={<UserRoundCheck size={16} />} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Pending invites" value={pendingInviteCount} icon={<Clock3 size={16} />} color="bg-violet-50 text-violet-600" />
        <StatCard label="Suspended" value={suspendedCount} icon={<ShieldCheck size={16} />} color="bg-amber-50 text-amber-600" />
        <StatCard label="Finance role" value="Bursar" icon={<WalletCards size={16} />} color="bg-indigo-50 text-indigo-600" />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => {
            const active = selectedStatus === tab.key;
            return (
              <Link
                key={tab.key}
                href={statusHref(tab.key, searchTerm)}
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-black transition ${
                  active
                    ? "bg-edujay-primary text-white shadow-sm"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {selectedStatus === "pending-invites" ? (
        <PendingInvitesTable invites={pendingInviteRows} now={now} />
      ) : (
        <BursarTable bursars={bursars} />
      )}

      <Pagination page={p} count={count} />
    </div>
  );
};

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number | string;
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

function BursarTable({ bursars }: { bursars: BursarRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-4 py-3.5 text-left text-xs font-black uppercase tracking-wider text-gray-400">Bursar</th>
              <th className="hidden px-3 py-3.5 text-left text-xs font-black uppercase tracking-wider text-gray-400 md:table-cell">Status</th>
              <th className="hidden px-3 py-3.5 text-left text-xs font-black uppercase tracking-wider text-gray-400 lg:table-cell">Phone</th>
              <th className="hidden px-3 py-3.5 text-left text-xs font-black uppercase tracking-wider text-gray-400 lg:table-cell">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {bursars.map((bursar) => (
              <tr key={bursar.id} className="transition-colors hover:bg-indigo-50/30">
                <td className="px-4 py-4">
                  <p className="text-sm font-bold text-gray-800">{bursar.name} {bursar.surname}</p>
                  <p className="mt-0.5 text-xs font-semibold text-gray-400">{bursar.email ?? "No email"}</p>
                  <div className="mt-2 flex flex-wrap gap-1 md:hidden">
                    <StatusPill status={bursar.status} />
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">
                      {bursar.phone ?? "No phone"}
                    </span>
                  </div>
                </td>
                <td className="hidden px-3 py-4 md:table-cell">
                  <StatusPill status={bursar.status} />
                </td>
                <td className="hidden px-3 py-4 text-sm font-semibold text-gray-500 lg:table-cell">
                  {bursar.phone ?? "--"}
                </td>
                <td className="hidden px-3 py-4 text-sm font-semibold text-gray-500 lg:table-cell">
                  {bursar.createdAt.toLocaleDateString("en-GH", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
              </tr>
            ))}
            {bursars.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center">
                  <p className="text-sm font-black text-gray-500">No bursars match this view.</p>
                  <p className="mt-1 text-xs font-semibold text-gray-400">Invite a bursar to give finance access safely.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PendingInvitesTable({ invites, now }: { invites: BursarInviteRow[]; now: Date }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-4 py-3.5 text-left text-xs font-black uppercase tracking-wider text-gray-400">Invitee</th>
              <th className="hidden px-3 py-3.5 text-left text-xs font-black uppercase tracking-wider text-gray-400 lg:table-cell">Expires</th>
              <th className="hidden px-3 py-3.5 text-left text-xs font-black uppercase tracking-wider text-gray-400 xl:table-cell">Last sent</th>
              <th className="px-5 py-3.5 text-right text-xs font-black uppercase tracking-wider text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {invites.map((invite) => {
              const expired = invite.expiresAt.getTime() <= now.getTime();
              return (
                <tr key={invite.id} className="transition-colors hover:bg-indigo-50/30">
                  <td className="px-4 py-4">
                    <p className="text-sm font-bold text-gray-800">{invite.name} {invite.surname}</p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-400">{invite.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1 lg:hidden">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${expired ? "bg-rose-50 text-rose-700" : "bg-violet-50 text-violet-700"}`}>
                        {expired ? "Expired" : "Pending"}
                      </span>
                      {invite.staffId && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">
                          {invite.staffId}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="hidden px-3 py-4 text-sm font-semibold text-gray-600 lg:table-cell">
                    {invite.expiresAt.toLocaleDateString("en-GH", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="hidden px-3 py-4 text-sm font-semibold text-gray-500 xl:table-cell">
                    {invite.lastSentAt
                      ? invite.lastSentAt.toLocaleDateString("en-GH", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Not sent yet"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <BursarInviteActions inviteId={invite.id} />
                  </td>
                </tr>
              );
            })}
            {invites.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center">
                  <p className="text-sm font-black text-gray-500">No pending bursar invites.</p>
                  <p className="mt-1 text-xs font-semibold text-gray-400">Create a new invite when the school is ready to add a bursar.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: BursarRow["status"] }) {
  const styles =
    status === "ACTIVE"
      ? "bg-emerald-50 text-emerald-700"
      : status === "SUSPENDED"
        ? "bg-amber-50 text-amber-700"
        : "bg-gray-100 text-gray-600";
  const label = status === "ACTIVE" ? "Active" : status === "SUSPENDED" ? "Suspended" : "Left school";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${styles}`}>{label}</span>;
}

export default BursarListPage;
