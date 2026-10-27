import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import { getMigrationInventory } from "@/src/lib/services/migration-inventory";
import { getMigrationRecovery, getRecoveryDatabaseReference } from "@/src/lib/services/migration-recovery";
import MigrationRecoveryPanel from "@/src/components/MigrationRecoveryPanel";

export default async function PlatformMigrationRecoveryPage({ params }: { params: Promise<{ schoolId: string }> }) {
  await requirePageSession(["platform_admin"]);
  const { schoolId } = await params;
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true, code: true } });
  if (!school) notFound();
  const [inventory, recovery] = await Promise.all([getMigrationInventory(schoolId), getMigrationRecovery(schoolId)]);
  return (
    <main className="min-w-0 space-y-5 p-4 md:p-6">
      <Link href="/platform/onboarding" className="text-sm font-semibold text-blue-700">Back to school requests</Link>
      <div>
        <p className="text-sm font-semibold text-blue-700">Platform migration controls</p>
        <h1 className="mt-2 break-words text-2xl font-black text-gray-950">{school.name}</h1>
        <p className="mt-2 text-sm text-gray-600">{school.code ?? "No school code"} · Inventory {inventory?.version ?? 0} · {inventory?.status === "CONFIRMED" ? "Confirmed" : "Awaiting confirmed scope"}</p>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">Record technical recovery evidence for this school. Routine imports do not create restore branches. Snapshot checks do not replace isolated restore drills or verified encryption-key recovery.</p>
      </div>
      <MigrationRecoveryPanel schoolId={school.id} initial={recovery} inventoryVersion={inventory?.version ?? 0} production={process.env.NODE_ENV === "production"} databaseReference={getRecoveryDatabaseReference()} />
    </main>
  );
}
