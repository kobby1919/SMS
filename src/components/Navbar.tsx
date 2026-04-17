"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { UserButton } from "@clerk/nextjs";

const Navbar = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-0 z-10"
    >
      {/* SEARCH BAR */}
      <div className="hidden md:flex items-center gap-2 text-xs rounded-full ring-[1.5px] ring-gray-200 px-4 py-2 bg-gray-50 hover:ring-jayPurple transition-all">
        <Image src="/search.png" alt="" width={13} height={13} />
        <input
          type="text"
          placeholder="Search anything..."
          className="w-[200px] bg-transparent outline-none text-gray-500 placeholder:text-gray-400"
        />
      </div>

      {/* ICONS & USER */}
      <div className="flex items-center gap-4 justify-end w-full">
        {/* Message */}
        <div className="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center cursor-pointer hover:bg-jaySkyLight transition-colors">
          <Image src="/message.png" alt="" width={18} height={18} />
        </div>

        {/* Announcement */}
        <div className="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center cursor-pointer hover:bg-jayPurpleLight transition-colors relative">
          <Image src="/announcement.png" alt="" width={18} height={18} />
          <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center bg-jayPurple text-gray-700 rounded-full text-[9px] font-bold">
            1
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200" />

        {/* User info */}
        <div className="flex flex-col items-end">
          <span className="text-xs font-semibold text-gray-800 leading-tight">
            Mr. Jay
          </span>
          <span className="text-[10px] text-gray-400">Administrator</span>
        </div>

        {/* Avatar */}
        {/* <Image
          src="/avatar.png"
          alt=""
          width={36}
          height={36}
          className="rounded-full ring-2 ring-jayPurple cursor-pointer"
        /> */}
        <UserButton />
      </div>
    </motion.div>
  );
};

export default Navbar;