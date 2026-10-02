import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import {
  bulkInviteImportedProfiles,
  PostImportInviteError,
} from "@/src/lib/services/post-import-invites";

const bulkInviteSchema = z.object({
  role: z.enum(["teachers", "parents", "bursars"]),
});

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireRole(["admin"]);
    const json = await req.json();
    const parsed = bulkInviteSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid bulk invite request.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await bulkInviteImportedProfiles(parsed.data.role, {
      schoolId,
      actorId: userId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }
    if (error instanceof PostImportInviteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return unauthorizedResponse(error);
  }
}
