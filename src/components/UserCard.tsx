// REMOVE "use client"
import { 
  GraduationCap, 
  Presentation, 
  Users, 
  Briefcase, 
  MoreHorizontal,
  TrendingUp 
} from "lucide-react";
import prisma from "../lib/prisma";

const iconMap: Record<string, React.ElementType> = {
  admin: Briefcase, // Changed from 'staff' to match your type
  teacher: Presentation,
  student: GraduationCap,
  parent: Users,
};

const colorMap: Record<string, { bg: string; accent: string }> = {
  admin: { bg: "bg-white", accent: "text-gray-500" },
  teacher: { bg: "bg-jayYellowLight", accent: "text-yellow-500" },
  student: { bg: "bg-jaySkyLight", accent: "text-sky-500" },
  parent: { bg: "bg-jayPurpleLight", accent: "text-purple-500" },
};

const UserCard = async ({ type }: { type: "admin" | "teacher" | "student" | "parent" }) => {
  const colors = colorMap[type];
  const Icon = iconMap[type];

  // Fetch data on the server
  const data = await (prisma[type] as any).count();

  return (
    <div className={`${colors.bg} rounded-2xl p-5 w-full shadow-sm border border-gray-100 flex flex-col gap-3 hover:scale-[1.02] transition-transform duration-300`}>
      {/* TOP ROW */}
      <div className="flex justify-between items-center">
        <span className="text-[10px] bg-white px-3 py-1 rounded-full text-green-600 font-bold shadow-sm">
          2025/26
        </span>
        <MoreHorizontal className="text-gray-400" size={16} />
      </div>

      {/* ICON + COUNT */}
      <div className="flex items-center gap-3">
        <Icon className={`${colors.accent}`} size={32} strokeWidth={2.5} />
        <h1 className="font-nunito font-extrabold text-3xl text-gray-800">
          {data}
        </h1>
      </div>

      {/* LABEL */}
      <div className="flex items-center justify-between">
        <h2 className={`capitalize text-sm font-bold ${colors.accent}`}>
          {type}s
        </h2>
        <div className="flex items-center gap-1">
           <TrendingUp size={10} className="text-green-500" />
           <span className="text-[10px] text-gray-400">12% this term</span>
        </div>
      </div>
    </div>
  );
};

export default UserCard;