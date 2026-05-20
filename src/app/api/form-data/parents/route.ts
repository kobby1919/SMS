import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";

export async function GET() {
  try {
    const { schoolId } = await requireRole(["admin"]);

    const parents = await prisma.parent.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        surname: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(parents);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
