import type React from "react";
import Link from "next/link";
import { Clock3, Mail, ShieldCheck, UserRoundCheck } from "lucide-react";
import AdminInviteActions from "@/src/components/AdminInviteActions";
import AdminInviteModal from "@/src/components/AdminInviteModal";
import TableSearch from "@/src/components/TableSearch";
import prisma from "@/src/lib/prisma";
import { requirePageSession } from "@/src/lib/authz";
import { Prisma } from "@/src/generated/prisma";

function formatDate(date: Date | null | undefined) {
  if (!date) return "--";
  return date.toLocaleDateString("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function inviteStatus(invite: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }) {
  if (invite.acceptedAt) return "Accepted";
  if (invite.revokedAt) return "Revoked";
  if (invite.expiresAt.getTime() < Date.now()) return "Expired";
  return "Pending";
}

export default async function AdminListPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { schoolId, userId } = await requirePageSession(["admin"]);
  const { search } = await searchParams;
  const searchTerm = search?.trim();

  const adminQuery: Prisma.AdminWhereInput = { schoolId };
  const inviteQuery: Prisma.SchoolInviteWhereInput = {
    schoolId,
    role: "ADMIN",
  };

  if (searchTerm) {
    adminQuery.username = { contains: searchTerm, mode: "insensitive" };
    inviteQuery.email = { contains: searchTerm, mode: "insensitive" };
  }

  const [school, admins, invites, pendingInviteCount] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true },
    }),
    prisma.admin.findMany({
      where: adminQuery,
      orderBy: { username: "asc" },
    }),
    prisma.schoolInvite.findMany({
      where: inviteQuery,
      orderBy: [{ acceptedAt: "asc" }, { expiresAt: "asc" }, { createdAt: "desc" }],
      take: 25,
    }),
    prisma.schoolInvite.count({
      where: {
        schoolId,
        role: "ADMIN",
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    }),
  ]);

  const acceptedInviteByEmail = new Map(
    invites
      .filter((invite) => invite.acceptedAt)
      .map((invite) => [invite.email.toLowerCase(), invite]),
  );

  return (
    <main className="m-4 mt-0 flex flex-col gap-4">
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-edujay-primary">Admin access</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-gray-900">School admins</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-gray-500">
              Invite trusted admins into {school?.name ?? "this school"}. Use this to replace old test access without deleting teachers, parents, bursars, or school records.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <TableSearch />
            <AdminInviteModal />
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Active admins" value={admins.length} icon={<ShieldCheck size={17} />} />
        <StatCard label="Pending invites" value={pendingInviteCount} icon={<Clock3 size={17} />} />
        <StatCard label="Current session" value={admins.some((admin) => admin.id === userId) ? "Admin" : "Unknown"} icon={<UserRoundCheck size={17} />} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-4">
            <h2 className="text-base font-black text-gray-900">Active admin accounts</h2>
            <p className="mt-1 text-xs font-semibold text-gray-400">These accounts can operate the school admin dashboard.</p>
          </div>
          <div className="divide-y divide-gray-100">
            {admins.map((admin) => {
              const acceptedInvite = acceptedInviteByEmail.get(admin.username.toLowerCase());
              return (
                <div key={admin.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-gray-900">{admin.username}</p>
                    <p className="mt-1 text-xs font-semibold text-gray-400">
                      {admin.id === userId ? "Current signed-in admin" : "School admin"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-gray-500">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Active</span>
                    {acceptedInvite && <span>Invite accepted {formatDate(acceptedInvite.acceptedAt)}</span>}
                  </div>
                </div>
              );
            })}
            {admins.length === 0 && (
              <div className="p-6 text-center">
                <p className="text-sm font-black text-gray-500">No admins found for this school.</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-4">
            <h2 className="text-base font-black text-gray-900">Admin invite history</h2>
            <p className="mt-1 text-xs font-semibold text-gray-400">Pending invites can be resent or revoked before use.</p>
          </div>
          <div className="divide-y divide-gray-100">
            {invites.map((invite) => {
              const status = inviteStatus(invite);
              const canManage = status === "Pending";
              return (
                <div key={invite.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Mail size={15} className="text-gray-400" />
                        <p className="truncate text-sm font-black text-gray-900">{invite.email}</p>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-gray-400">
                        Created {formatDate(invite.createdAt)} · Expires {formatDate(invite.expiresAt)}
                      </p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-black text-gray-600">
                      {status}
                    </span>
                  </div>
                  {canManage ? (
                    <div className="mt-3 flex justify-end">
                      <AdminInviteActions inviteId={invite.id} />
                    </div>
                  ) : (
                    <p className="mt-3 text-xs font-semibold text-gray-400">
                      {status === "Accepted" ? "This invite has already been used." : "This invite is no longer usable."}
                    </p>
                  )}
                </div>
              );
            })}
            {invites.length === 0 && (
              <div className="p-6 text-center">
                <p className="text-sm font-black text-gray-500">No admin invites yet.</p>
                <p className="mt-1 text-xs font-semibold text-gray-400">Create one when you want to bring in a proper school admin account.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold leading-6 text-blue-900">
        To replace the old test admin, invite a fresh email, accept the invite with that email, then use the new account for all future admin work. Do not delete the school or existing role records.
        <Link href="/admin" className="ml-1 font-black underline">Back to dashboard</Link>
      </section>
    </main>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-edujay-primaryLight text-edujay-primary">
          {icon}
        </div>
        <div>
          <p className="text-xl font-black text-gray-900">{value}</p>
          <p className="text-xs font-bold text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

