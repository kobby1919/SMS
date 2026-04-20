"use client";

import { GraduationCap, Presentation, Users, Briefcase, MoreHorizontal, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

const iconMap: Record<string, React.ElementType> = {
  student: GraduationCap,
  teacher: Presentation,
  parent:  Users,
  admin:   Briefcase,
};

const colorMap: Record<string, { bg: string; accent: string }> = {
  student: { bg: "bg-jaySkyLight",    accent: "text-sky-500"    },
  teacher: { bg: "bg-jayYellowLight", accent: "text-yellow-500" },
  parent:  { bg: "bg-jayPurpleLight", accent: "text-purple-500" },
  admin:   { bg: "bg-white",          accent: "text-gray-500"   },
};

type Props = {
  type: "admin" | "teacher" | "student" | "parent";
  count: number;
};

const UserCardClient = ({ type, count }: Props) => {
  const colors = colorMap[type] ?? colorMap.admin;
  const Icon   = iconMap[type]  ?? iconMap.admin;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300 }}
      className={`${colors.bg} rounded-2xl p-5 w-full shadow-sm border border-gray-100 flex flex-col gap-3`}
    >
      {/* Top row */}
      <div className="flex justify-between items-center">
        <span className="text-[10px] bg-white px-3 py-1 rounded-full text-green-600 font-bold shadow-sm">
          2025/26
        </span>
        <MoreHorizontal className="text-gray-400" size={16} />
      </div>

      {/* Icon + count */}
      <div className="flex items-center gap-3">
        <Icon className={colors.accent} size={32} strokeWidth={2.5} />
        <h1 className="font-nunito font-extrabold text-3xl text-gray-800">{count}</h1>
      </div>

      {/* Label + trend */}
      <div className="flex items-center justify-between">
        <h2 className={`capitalize text-sm font-bold ${colors.accent}`}>{type}s</h2>
        <div className="flex items-center gap-1">
          <TrendingUp size={10} className="text-green-500" />
          <span className="text-[10px] text-gray-400">12% this term</span>
        </div>
      </div>
    </motion.div>
  );
};

export default UserCardClient;
