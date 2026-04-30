"use client";

import { useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Class Filter */}
      <select
        value={activeClassId}
        onChange={(e) => updateFilter("classId", e.target.value)}
        className="appearance-none ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-sm font-semibold text-gray-700 outline-none bg-white"
      >
        {supervisedClasses.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {/* Term Filter */}
      <select
        value={activeTerm}
        onChange={(e) => updateFilter("term", e.target.value)}
        className="appearance-none ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-sm font-semibold text-gray-700 outline-none bg-white"
      >
        {Object.entries(TERM_LABELS).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>

      {/* Year Filter */}
      <select
        value={activeYear}
        onChange={(e) => updateFilter("year", e.target.value)}
        className="appearance-none ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-sm font-semibold text-gray-700 outline-none bg-white"
      >
        {academicYears.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}