import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { purgeExpiredMigrationUploads } from "@/src/lib/services/migration-staging";

export async function POST(req: NextRequest) {
  const secret = process.env.MIGRATION_STAGING_WORKER_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) return NextResponse.json({ error: "Migration cleanup worker is not configured." }, { status: 503 });
  const supplied = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const a = Buffer.from(secret), b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const schools = await prisma.migrationStagedUpload.findMany({ where: { expiresAt: { lte: new Date() }, OR: [{ encryptedPayload: { not: null } }, { encryptedResult: { not: null } }] }, select: { schoolId: true }, distinct: ["schoolId"], take: 100 });
    for (const { schoolId } of schools) await purgeExpiredMigrationUploads(schoolId, "SYSTEM:MIGRATION_RETENTION");
    return NextResponse.json({ processedSchools: schools.length });
  } catch {
    console.error("Migration retention cleanup failed.");
    return NextResponse.json({ error: "Cleanup failed. Retry and check monitoring." }, { status: 500 });
  }
}
