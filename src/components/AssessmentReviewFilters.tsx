"use client";

import type { ReactNode } from "react";

export default function AssessmentReviewFilters({ children }: { children: ReactNode }) {
  return <form action="/list/ca" className="mt-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" onChange={(event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement && ["classId", "year", "term"].includes(target.name)) {
      const subject = event.currentTarget.elements.namedItem("subjectId");
      if (subject instanceof HTMLSelectElement) subject.value = "";
    }
  }}>{children}</form>;
}
