import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  // Optional: Security check to ensure only admins can fetch the parent list
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;

  if (role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parents = await prisma.parent.findMany({
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
    console.error("Error fetching parents:", error);
    return NextResponse.json({ error: "Failed to fetch parents" }, { status: 500 });
  }
}