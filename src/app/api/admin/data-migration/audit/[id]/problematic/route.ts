import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { markMigrationBatchProblematic } from "@/src/lib/services/data-migration-audit";

const bodySchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { schoolId, userId } = await requireRole(["admin"]);
    const { id } = await context.params;
    const auditLogId = Number(id);

    if (!Number.isSafeInteger(auditLogId) || auditLogId <= 0) {
      return NextResponse.json({ error: "Invalid import audit record." }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid review note." }, { status: 400 });
    }

    const result = await markMigrationBatchProblematic({
      schoolId,
      actorId: userId,
      auditLogId,
      note: parsed.data.note ?? "Marked for admin review.",
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return unauthorizedResponse(error);
  }
}
