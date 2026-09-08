"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TERM_LABELS } from "@/src/lib/caGrades";

type Props = {
  supervisedClasses: { id: number; name: string }[];
  academicYears: string[];
  activeClassId: number;
  activeTerm: string;
  activeYear: string;
};

export default function ReportCardFilters({
  supervisedClasses,
  academicYears,
  activeClassId,
  activeTerm,
  activeYear,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    router.refresh();
  };

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-3 lg:min-w-[520px]">
      {/* Class Filter */}
      <select
        value={String(activeClassId)}
        onChange={(e) => updateFilter("classId", e.target.value)}
        aria-label="Filter by class"
        className="w-full min-w-0 appearance-none rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none ring-[1.5px] ring-gray-200"
      >
        {supervisedClasses.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {/* Term Filter */}
      <select
        value={activeTerm}
        onChange={(e) => updateFilter("term", e.target.value)}
        aria-label="Filter by term"
        className="w-full min-w-0 appearance-none rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none ring-[1.5px] ring-gray-200"
      >
        {Object.entries(TERM_LABELS).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>

      {/* Year Filter */}
      <select
        value={activeYear}
        onChange={(e) => updateFilter("year", e.target.value)}
        aria-label="Filter by academic year"
        className="w-full min-w-0 appearance-none rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none ring-[1.5px] ring-gray-200"
      >
        {academicYears.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}
