"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const Pagination = ({ total = 10 }: { total?: number }) => {
  const [current, setCurrent] = useState(1);

  const pages = Array.from({ length: total }, (_, i) => i + 1);
  const visible = pages.filter(
    (p) => p === 1 || p === total || (p >= current - 1 && p <= current + 1),
  );

  return (
    <div className="px-5 py-4 flex items-center justify-between gap-4">
      <p className="text-xs text-gray-400 font-medium hidden sm:block">
        Showing page <span className="font-bold text-gray-600">{current}</span>{" "}
        of {total}
      </p>

      <div className="flex items-center gap-1 ml-auto">
        {/* Prev */}
        <button
          onClick={() => setCurrent((p) => Math.max(1, p - 1))}
          disabled={current === 1}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft size={14} />
        </button>

        {/* Page numbers */}
        {visible.map((p, i, arr) => (
          <div key={p} className="flex items-center">
            {i > 0 && arr[i - 1] !== p - 1 && (
              <span className="w-8 h-8 flex items-center justify-center text-xs text-gray-400">
                …
              </span>
            )}
            <button
              onClick={() => setCurrent(p)}
              className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-bold transition-all
        ${
          p === current
            ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
            : "text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"
        }`}
            >
              {p}
            </button>
          </div>
        ))}

        {/* Next */}
        <button
          onClick={() => setCurrent((p) => Math.min(total, p + 1))}
          disabled={current === total}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
