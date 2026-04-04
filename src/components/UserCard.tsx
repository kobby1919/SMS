"use client";

import Image from "next/image";
import { motion } from "framer-motion";

const colorMap: Record<string, { bg: string; accent: string }> = {
  student: { bg: "bg-jaySkyLight", accent: "text-sky-500" },
  teacher: { bg: "bg-jayYellowLight", accent: "text-yellow-500" },
  parent: { bg: "bg-jayPurpleLight", accent: "text-purple-500" },
  staff: { bg: "bg-white", accent: "text-gray-500" },
};

const iconMap: Record<string, string> = {
  student: "🎓",
  teacher: "👩‍🏫",
  parent: "👨‍👩‍👧",
  staff: "💼",
};

const UserCard = ({ type }: { type: string }) => {
  const colors = colorMap[type] ?? colorMap.staff;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300 }}
      className={`${colors.bg} rounded-2xl p-5 w-full shadow-sm border border-gray-100 flex flex-col gap-3`}
    >
      {/* TOP ROW */}
      <div className="flex justify-between items-center">
        <span className="text-[10px] bg-white px-3 py-1 rounded-full text-green-600 font-bold shadow-sm">
          2025/26
        </span>
        <Image src="/more.png" alt="" width={16} height={16} />
      </div>

      {/* ICON + COUNT */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">{iconMap[type]}</span>
        <h1 className="font-nunito font-extrabold text-3xl text-gray-800">
          1,234
        </h1>
      </div>

      {/* LABEL */}
      <div className="flex items-center justify-between">
        <h2 className={`capitalize text-sm font-bold ${colors.accent}`}>
          {type}s
        </h2>
        <span className="text-[10px] text-gray-400">↑ 12% this term</span>
      </div>
    </motion.div>
  );
};

export default UserCard;