"use client";
import { Search, X } from "lucide-react";
import { useState } from "react";

const TableSearch = () => {
  const [value, setValue] = useState("");

  return (
    <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3.5 py-2.5 w-full sm:w-64 transition-all focus-within:ring-2 focus-within:ring-indigo-300 focus-within:bg-white">
      <Search size={14} className="text-gray-400 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search through List..."
        className="bg-transparent outline-none text-sm text-gray-700 placeholder:text-gray-400 w-full font-medium"
      />
      {value && (
        <button onClick={() => setValue("")} className="text-gray-400 hover:text-gray-600">
          <X size={13} />
        </button>
      )}
    </div>
  );
};

export default TableSearch;
