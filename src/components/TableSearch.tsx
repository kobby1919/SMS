"use client";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";

const TableSearch = () => {
  // const [value, setValue] = useState("");
  const router = useRouter();
  // const searchParams = useSearchParams();

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {

    e.preventDefault();

    const value = (e.currentTarget[0] as HTMLInputElement).value;
    const params = new URLSearchParams(window.location.search);
    params.set("search", value);
    router.push(`${window.location.pathname}?${params}`);
  
  };

  return (
    <form 
      onSubmit={handleSearch}
      className="flex items-center gap-2 bg-gray-100 rounded-xl px-3.5 py-2.5 w-full sm:w-64 transition-all focus-within:ring-2 focus-within:ring-indigo-300 focus-within:bg-white"
    >
      <Search size={14} className="text-gray-400 shrink-0" />
      <input
        type="text"
        // value={value}
        // onChange={(e) => setValue(e.target.value)}
        placeholder="Search through List..."
        className="bg-transparent outline-none text-sm text-gray-700 placeholder:text-gray-400 w-full font-medium"
      />
    
        <button 
          type="button" // Important: Prevents the "X" from submitting the form
          // onClick={() => setValue("")} 
          className="text-gray-400 hover:text-gray-600"
        >
          <X size={13} />
        </button>
      
    </form>
  );
};

export default TableSearch;
