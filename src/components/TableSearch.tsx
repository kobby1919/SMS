"use client";
import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const TableSearch = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("search") ?? "");

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const params = new URLSearchParams(window.location.search);
    params.delete("page");
    if (value.trim()) {
      params.set("search", value.trim());
    } else {
      params.delete("search");
    }
    const next = params.toString();
    router.push(next ? `${pathname}?${next}` : pathname);
  };

  const clearSearch = () => {
    setValue("");
    const params = new URLSearchParams(window.location.search);
    params.delete("search");
    params.delete("page");
    const next = params.toString();
    router.push(next ? `${pathname}?${next}` : pathname);
  };

  return (
    <form
      onSubmit={handleSearch}
      className="flex items-center gap-2 bg-gray-100 rounded-xl px-3.5 py-2.5 w-full sm:w-64 transition-all focus-within:ring-2 focus-within:ring-indigo-300 focus-within:bg-white"
    >
      <Search size={14} className="text-gray-400 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search through List..."
        className="bg-transparent outline-none text-sm text-gray-700 placeholder:text-gray-400 w-full font-medium"
      />
      <button
        type="button"
        onClick={clearSearch}
        className="text-gray-400 hover:text-gray-600"
        aria-label="Clear search"
      >
        <X size={13} />
      </button>
    </form>
  );
};

export default TableSearch;
