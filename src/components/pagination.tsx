"use client";

import { useRouter } from "next/navigation";
import { ITEM_PER_PAGE } from "../lib/settings";
import { ChevronLeft, ChevronRight } from "lucide-react";

const Pagination = ({ page, count }: { page: number; count: number }) => {
  const router = useRouter();

  const totalPages  = Math.ceil(count / ITEM_PER_PAGE);
  const hasPrev = ITEM_PER_PAGE * (page - 1) > 0;
  const hasNext = ITEM_PER_PAGE * (page - 1) + ITEM_PER_PAGE < count;

  const changePage = (newPage: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("page", newPage.toString());
    router.push(`${window.location.pathname}?${params}`);
  };
  return (
    <div className="p-4 flex items-center justify-between border-t border-gray-100 bg-white">
      {/* PREVIOUS BUTTON */}
      <button
        disabled={!hasPrev}
        className=" flex items-center gap-1 py-2 px-4 rounded-xl bg-gray-50 text-gray-500 text-xs font-bold transition-all hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-50 border border-gray-200"
        onClick={() => {
          changePage(page - 1);
        }}
      >
        <ChevronLeft size={14} />
        <span>Prev</span>
      </button>
      <div className="flex items-center gap-1.5">
        {Array.from(
          { length: totalPages },
          (_, index) => {
            const pageIndex = index + 1;
            const isActive = page === pageIndex;
            return (
              <button
                key={pageIndex}
                className={`min-w-[32px] h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all duration-200 ${isActive ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-110" : "text-gray-400 hover:bg-indigo-50 hover:text-indigo-600"}`}
                onClick={() => {
                  changePage(pageIndex);
                }}
              >
                {pageIndex}
              </button>
            );
          },
        )}
      </div>
      <button
        disabled={!hasNext}
        className=" flex items-center gap-1 py-2 px-4 rounded-xl bg-gray-50 text-gray-500 text-xs font-bold transition-all hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-50 border border-gray-200"
        onClick={() => {
          changePage(page + 1);
        }}
      >
        <span>Next</span>
        <ChevronRight size={14} />
      </button>
    </div>
  );
};

export default Pagination;
