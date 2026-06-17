"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import UserButtonWrapper from "./UserButtonWrapper";

interface NavbarClientProps {
  user: {
    fullName: string | null;
    role: string;
  };
}

const NavbarClient = ({ user }: NavbarClientProps) => {
  return (
    <motion.div
      suppressHydrationWarning
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-4 lg:px-6 bg-white border-b border-gray-100 sticky top-0 z-10"
    >
      {/* SEARCH BAR */}
      <div className="hidden md:flex flex-1 max-w-xs lg:max-w-sm items-center gap-2 text-xs rounded-full ring-[1.5px] ring-gray-200 px-4 py-2 bg-gray-50 hover:ring-jayPurple transition-all">
        <Image src="/search.png" alt="" width={13} height={13} />
        <input
          type="text"
          placeholder="Search anything..."
          className="w-full min-w-0 bg-transparent outline-none text-gray-500 placeholder:text-gray-400"
        />
      </div>

      {/* ICONS & USER */}
      <div className="flex items-center gap-2 sm:gap-3 justify-end min-w-0">
        {/* Message */}
        <div className="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center cursor-pointer hover:bg-jaySkyLight transition-colors">
          <Image src="/message.png" alt="" width={18} height={18} />
        </div>

        {/* Announcement */}
        <div className="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center cursor-pointer hover:bg-jayPurpleLight transition-colors relative">
          <Image src="/announcement.png" alt="" width={18} height={18} />
          <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center bg-jayPurple text-white rounded-full text-[9px] font-bold">
            1
          </span>
        </div>

        <div className="hidden sm:block w-px h-6 bg-gray-200" />

        {/* User info */}
        <div className="hidden sm:flex flex-col items-end min-w-0">
          <span className="text-xs font-semibold text-gray-800 leading-tight">
            {user.fullName || "User"}
          </span>
          <span className="text-[10px] text-gray-400 capitalize">
            {user.role}
          </span>
        </div>

        <UserButtonWrapper />
      </div>
    </motion.div>
  );
};

export default NavbarClient;
