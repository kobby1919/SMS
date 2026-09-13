import { NextRequest, NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { enforceRateLimit } from "@/src/lib/rate-limit";
import { parseBody, parseSearchParams } from "@/src/lib/validation/parse";
import {
  periodTemplateDeleteQuerySchema,
  periodTemplateSchema,
  periodTemplateUpdateSchema,
} from "@/src/lib/validation/period-templates";
import {
  createPeriodTemplate,
  deletePeriodTemplate,
  listPeriodTemplates,
  PeriodTemplateServiceError,
  updatePeriodTemplate,
} from "@/src/lib/services/period-templates";

function periodTemplateErrorResponse(error: unknown) {
  if (error instanceof PeriodTemplateServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return unauthorizedResponse(error);
}

export async function GET(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin"]);
    const limited = await enforceRateLimit(req, {
      scope: "timetable:periods:read",
      actorId: userId,
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    return NextResponse.json(await listPeriodTemplates(schoolId));
  } catch (error) {
    return periodTemplateErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin"]);
    const limited = await enforceRateLimit(req, {
      scope: "timetable:periods:create",
      actorId: userId,
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const parsed = parseBody(periodTemplateSchema, await req.json());
    if (!parsed.ok) return parsed.response;
    return NextResponse.json(await createPeriodTemplate(schoolId, parsed.data), { status: 201 });
  } catch (error) {
    return periodTemplateErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin"]);
    const limited = await enforceRateLimit(req, {
      scope: "timetable:periods:update",
      actorId: userId,
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const parsed = parseBody(periodTemplateUpdateSchema, await req.json());
    if (!parsed.ok) return parsed.response;
    const { id, ...input } = parsed.data;
    return NextResponse.json(await updatePeriodTemplate(schoolId, id, input));
  } catch (error) {
    return periodTemplateErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin"]);
    const limited = await enforceRateLimit(req, {
      scope: "timetable:periods:delete",
      actorId: userId,
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const parsed = parseSearchParams(periodTemplateDeleteQuerySchema, req.nextUrl.searchParams);
    if (!parsed.ok) return parsed.response;
    await deletePeriodTemplate(schoolId, parsed.data.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return periodTemplateErrorResponse(error);
  }
}
