import { unstable_cache } from "next/cache";
import type { Prisma } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { referenceDataTag } from "@/src/lib/cacheTags";
import { ITEM_PER_PAGE } from "@/src/lib/settings";

type ClassListFilters = {
  search?: string;
  supervisorId?: string;
};

export async function getClassesPage(
  schoolId: string,
  page: number,
  filters: ClassListFilters,
) {
  const normalizedPage = Number.isFinite(page) && page > 0 ? page : 1;
  const search = filters.search?.trim() ?? "";
  const supervisorId = filters.supervisorId?.trim() ?? "";

  return unstable_cache(
    async () => {
      const where: Prisma.ClassWhereInput = {
        schoolId,
        ...(supervisorId ? { supervisorId } : {}),
        ...(search
          ? { name: { contains: search, mode: "insensitive" } }
          : {}),
      };

      const [classes, count] = await Promise.all([
        prisma.class.findMany({
          where,
          include: {
            supervisor: { select: { name: true, surname: true } },
            grade: { select: { level: true } },
            _count: { select: { students: true } },
          },
          orderBy: [{ grade: { order: "asc" } }, { name: "asc" }],
          take: ITEM_PER_PAGE,
          skip: ITEM_PER_PAGE * (normalizedPage - 1),
        }),
        prisma.class.count({ where }),
      ]);

      return { classes, count };
    },
    [
      "classes-page",
      schoolId,
      String(normalizedPage),
      search || "all",
      supervisorId || "all",
    ],
    {
      revalidate: 60,
      tags: [referenceDataTag(schoolId, "classes")],
    },
  )();
}
